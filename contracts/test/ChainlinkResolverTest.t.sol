// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { SD59x18, sd } from "@prb/math/SD59x18.sol";
import { PintelMarket } from "../src/PintelMarket.sol";
import { ChainlinkResolver } from "../src/ChainlinkResolver.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockAggregator } from "./mocks/MockAggregator.sol";

contract ChainlinkResolverTest is Test {
    ChainlinkResolver public resolver;
    MockERC20 public token;
    MockAggregator public feed;
    PintelMarket public market;

    uint256 END_TIME;

    function setUp() public {
        resolver = new ChainlinkResolver();
        token = new MockERC20();
        feed = new MockAggregator();

        END_TIME = block.timestamp + 1 hours;

        market = new PintelMarket();
        market.initialize("BTC price?", address(resolver), address(token), sd(1e18), sd(10e18), END_TIME);

        feed.setPrice(50000e8);
    }

    function test_registerMarket() public {
        resolver.registerMarket(address(market), address(feed));
        assertEq(resolver.priceFeeds(address(market)), address(feed));
    }

    function test_resolveMarket() public {
        resolver.registerMarket(address(market), address(feed));

        vm.warp(END_TIME);
        resolver.resolveMarket(address(market));

        assertTrue(market.resolved());
        assertTrue(resolver.isResolved(address(market)));
    }

    function test_resolveMarket_revertBeforeExpiry() public {
        resolver.registerMarket(address(market), address(feed));

        vm.expectRevert(ChainlinkResolver.MarketNotExpired.selector);
        resolver.resolveMarket(address(market));
    }

    function test_resolveMarket_priceConversion() public {
        feed.setPrice(50000e8);
        resolver.registerMarket(address(market), address(feed));

        vm.warp(END_TIME);
        resolver.resolveMarket(address(market));

        assertEq(SD59x18.unwrap(market.outcome()), 50000e18);
    }

    function test_checkUpkeep_returnsTrue() public {
        resolver.registerMarket(address(market), address(feed));

        vm.warp(END_TIME);
        (bool needed, bytes memory performData) = resolver.checkUpkeep("");
        assertTrue(needed);
        address decoded = abi.decode(performData, (address));
        assertEq(decoded, address(market));
    }

    function test_checkUpkeep_returnsFalse() public {
        resolver.registerMarket(address(market), address(feed));

        (bool needed, ) = resolver.checkUpkeep("");
        assertFalse(needed);
    }

    function test_batchResolve() public {
        PintelMarket market2 = new PintelMarket();
        market2.initialize("ETH price?", address(resolver), address(token), sd(1e18), sd(10e18), END_TIME);

        MockAggregator feed2 = new MockAggregator();
        feed2.setPrice(3000e8);

        resolver.registerMarket(address(market), address(feed));
        resolver.registerMarket(address(market2), address(feed2));

        vm.warp(END_TIME);

        address[] memory markets = new address[](2);
        markets[0] = address(market);
        markets[1] = address(market2);
        resolver.batchResolve(markets);

        assertTrue(market.resolved());
        assertTrue(market2.resolved());
    }

    function test_fullFlow_withChainlink() public {
        feed.setPrice(50000e8);
        resolver.registerMarket(address(market), address(feed));

        address alice = makeAddr("alice");
        token.mint(alice, 1000e18);
        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
        vm.prank(alice);
        market.openPosition(sd(50000e18), sd(5000e18), 100e18);

        vm.warp(END_TIME);
        resolver.resolveMarket(address(market));

        assertTrue(market.resolved());
        assertEq(SD59x18.unwrap(market.outcome()), 50000e18);

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.claim(0);
        uint256 payout = token.balanceOf(alice) - balBefore;
        assertGt(payout, 0);
    }
}
