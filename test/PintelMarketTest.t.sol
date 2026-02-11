// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { SD59x18, sd } from "@prb/math/SD59x18.sol";
import { PintelMarket } from "../src/PintelMarket.sol";
import { GaussianMath } from "../src/GaussianMath.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

contract PintelMarketTest is Test {
    PintelMarket public market;
    MockERC20 public token;

    address alice;
    address bob;
    address charlie;
    address oracleAddr;

    SD59x18 K = sd(1e18);
    SD59x18 B = sd(10e18);
    uint256 END_TIME;

    function setUp() public {
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        oracleAddr = makeAddr("oracle");

        token = new MockERC20();
        market = new PintelMarket();

        END_TIME = block.timestamp + 1 hours;

        market.initialize("Test market?", oracleAddr, address(token), K, B, END_TIME);

        token.mint(alice, 1000e18);
        token.mint(bob, 1000e18);
        token.mint(charlie, 1000e18);

        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
        vm.prank(bob);
        token.approve(address(market), type(uint256).max);
        vm.prank(charlie);
        token.approve(address(market), type(uint256).max);
    }

    function test_initialize() public view {
        assertEq(market.question(), "Test market?");
        assertEq(market.oracle(), oracleAddr);
        assertEq(market.collateralToken(), address(token));
        assertEq(SD59x18.unwrap(market.k()), SD59x18.unwrap(K));
        assertEq(SD59x18.unwrap(market.b()), SD59x18.unwrap(B));
        assertEq(market.endTime(), END_TIME);
        assertFalse(market.resolved());
    }

    function test_openPosition() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PintelMarket.PositionOpened(0, alice, sd(50e18), sd(5e18), 100e18);
        uint256 posId = market.openPosition(sd(50e18), sd(5e18), 100e18);

        assertEq(posId, 0);
        (uint256 id, address owner, , , uint256 collateral, bool active, bool claimed) = market.positions(0);
        assertEq(id, 0);
        assertEq(owner, alice);
        assertEq(collateral, 100e18);
        assertTrue(active);
        assertFalse(claimed);
        assertEq(market.totalPool(), 100e18);
        assertEq(token.balanceOf(address(market)), 100e18);
    }

    function test_openPosition_revertSigmaTooLow() public {
        vm.prank(alice);
        vm.expectRevert(PintelMarket.SigmaTooLow.selector);
        market.openPosition(sd(50e18), sd(0.001e18), 100e18);
    }

    function test_openPosition_revertAfterExpiry() public {
        vm.warp(END_TIME);
        vm.prank(alice);
        vm.expectRevert(PintelMarket.MarketExpired.selector);
        market.openPosition(sd(50e18), sd(5e18), 100e18);
    }

    function test_closePosition() public {
        vm.prank(alice);
        uint256 posId = market.openPosition(sd(50e18), sd(5e18), 100e18);

        uint256 balBefore = token.balanceOf(alice);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PintelMarket.PositionClosed(posId, alice, 100e18);
        market.closePosition(posId);

        (, , , , , bool active, ) = market.positions(posId);
        assertFalse(active);
        assertEq(token.balanceOf(alice), balBefore + 100e18);
        assertEq(market.totalPool(), 0);
    }

    function test_closePosition_revertNotOwner() public {
        vm.prank(alice);
        uint256 posId = market.openPosition(sd(50e18), sd(5e18), 100e18);

        vm.prank(bob);
        vm.expectRevert(PintelMarket.NotPositionOwner.selector);
        market.closePosition(posId);
    }

    function test_resolve() public {
        vm.warp(END_TIME);
        vm.prank(oracleAddr);
        vm.expectEmit(false, false, false, true);
        emit PintelMarket.OutcomeResolved(sd(50e18));
        market.resolve(sd(50e18));

        assertTrue(market.resolved());
        assertEq(SD59x18.unwrap(market.outcome()), 50e18);
    }

    function test_resolve_revertNotOracle() public {
        vm.warp(END_TIME);
        vm.prank(alice);
        vm.expectRevert(PintelMarket.NotOracle.selector);
        market.resolve(sd(50e18));
    }

    function test_resolve_revertBeforeExpiry() public {
        vm.prank(oracleAddr);
        vm.expectRevert(PintelMarket.MarketNotExpired.selector);
        market.resolve(sd(50e18));
    }

    function test_claim_singlePosition() public {
        vm.prank(alice);
        uint256 posId = market.openPosition(sd(50e18), sd(5e18), 100e18);

        vm.warp(END_TIME);
        vm.prank(oracleAddr);
        market.resolve(sd(50e18));

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.claim(posId);

        uint256 payout = token.balanceOf(alice) - balBefore;
        assertGt(payout, 0);
        assertApproxEqAbs(payout, 100e18, 1e15);
    }

    function test_claim_twoPositions() public {
        vm.prank(alice);
        uint256 posA = market.openPosition(sd(50e18), sd(5e18), 100e18);
        vm.prank(bob);
        uint256 posB = market.openPosition(sd(60e18), sd(5e18), 100e18);

        vm.warp(END_TIME);
        vm.prank(oracleAddr);
        market.resolve(sd(50e18));

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.claim(posA);
        uint256 alicePayout = token.balanceOf(alice) - aliceBefore;

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        market.claim(posB);
        uint256 bobPayout = token.balanceOf(bob) - bobBefore;

        assertGt(alicePayout, bobPayout);
        assertGt(alicePayout + bobPayout, 0);
    }

    function test_claim_revertBeforeResolution() public {
        vm.prank(alice);
        uint256 posId = market.openPosition(sd(50e18), sd(5e18), 100e18);

        vm.prank(alice);
        vm.expectRevert(PintelMarket.MarketNotResolved.selector);
        market.claim(posId);
    }

    function test_claim_revertDoubleClaim() public {
        vm.prank(alice);
        uint256 posId = market.openPosition(sd(50e18), sd(5e18), 100e18);

        vm.warp(END_TIME);
        vm.prank(oracleAddr);
        market.resolve(sd(50e18));

        vm.prank(alice);
        market.claim(posId);

        vm.prank(alice);
        vm.expectRevert(PintelMarket.PositionAlreadyClaimed.selector);
        market.claim(posId);
    }

    function test_fullLifecycle() public {
        vm.prank(alice);
        uint256 posAlice = market.openPosition(sd(50e18), sd(5e18), 100e18);

        vm.prank(bob);
        uint256 posBob = market.openPosition(sd(60e18), sd(10e18), 100e18);

        vm.prank(charlie);
        uint256 posCharlie = market.openPosition(sd(45e18), sd(3e18), 100e18);

        assertEq(market.totalPool(), 300e18);

        vm.warp(END_TIME);
        vm.prank(oracleAddr);
        market.resolve(sd(48e18));

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.claim(posAlice);
        uint256 alicePayout = token.balanceOf(alice) - aliceBefore;

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        market.claim(posBob);
        uint256 bobPayout = token.balanceOf(bob) - bobBefore;

        uint256 charlieBefore = token.balanceOf(charlie);
        vm.prank(charlie);
        market.claim(posCharlie);
        uint256 charliePayout = token.balanceOf(charlie) - charlieBefore;

        assertGt(charliePayout, alicePayout);
        assertGt(alicePayout, bobPayout);
        assertGt(charliePayout + alicePayout + bobPayout, 0);
    }
}
