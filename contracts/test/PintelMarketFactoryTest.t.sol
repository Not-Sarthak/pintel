// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { SD59x18, sd } from "@prb/math/SD59x18.sol";
import { PintelMarket } from "../src/PintelMarket.sol";
import { PintelMarketFactory } from "../src/PintelMarketFactory.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockENS } from "./mocks/MockENS.sol";
import { MockResolver } from "./mocks/MockResolver.sol";

contract PintelMarketFactoryTest is Test {
    PintelMarketFactory public factory;
    PintelMarket public impl;
    MockERC20 public token;
    MockENS public ens;
    MockResolver public resolver;

    bytes32 constant PARENT_NODE = keccak256("pintel.eth");
    address creator;
    address oracleAddr;

    function setUp() public {
        creator = makeAddr("creator");
        oracleAddr = makeAddr("oracle");

        token = new MockERC20();
        ens = new MockENS();
        resolver = new MockResolver();
        impl = new PintelMarket();

        factory = new PintelMarketFactory(address(ens), address(resolver), PARENT_NODE, address(impl));
    }

    function _defaultParams(string memory label) internal view returns (PintelMarketFactory.CreateParams memory) {
        return PintelMarketFactory.CreateParams({
            label: label,
            question: "Will BTC hit 100k?",
            oracle: oracleAddr,
            token: address(token),
            k: sd(1e18),
            b: sd(10e18),
            endTime: block.timestamp + 1 hours,
            category: "crypto"
        });
    }

    function test_createMarket() public {
        PintelMarketFactory.CreateParams memory p = _defaultParams("btc-100k");

        vm.prank(creator);
        vm.expectEmit(false, false, true, false);
        emit PintelMarketFactory.MarketCreated(bytes32(0), address(0), creator, "btc-100k", "crypto");
        address market = factory.createMarket(p);

        assertTrue(market != address(0));
        bytes32 labelHash = keccak256(bytes("btc-100k"));
        assertEq(factory.markets(labelHash), market);
        assertEq(factory.marketCreators(labelHash), creator);
        assertEq(factory.marketCount(), 1);

        address[] memory creatorMarkets = factory.getMarketsByCreator(creator);
        assertEq(creatorMarkets.length, 1);
        assertEq(creatorMarkets[0], market);
    }

    function test_createMarket_setsENSRecords() public {
        PintelMarketFactory.CreateParams memory p = _defaultParams("btc-100k");

        vm.prank(creator);
        address market = factory.createMarket(p);

        bytes32 labelHash = keccak256(bytes("btc-100k"));
        bytes32 subnode = keccak256(abi.encodePacked(PARENT_NODE, labelHash));

        assertEq(resolver.addrs(subnode), market);
        assertEq(resolver.texts(subnode, "question"), "Will BTC hit 100k?");
        assertEq(resolver.texts(subnode, "category"), "crypto");
        assertEq(resolver.texts(subnode, "status"), "active");
    }

    function test_createMarket_revertDuplicateLabel() public {
        PintelMarketFactory.CreateParams memory p = _defaultParams("btc-100k");

        vm.prank(creator);
        factory.createMarket(p);

        vm.prank(creator);
        vm.expectRevert(PintelMarketFactory.LabelAlreadyTaken.selector);
        factory.createMarket(p);
    }

    function test_getMarketByLabel() public {
        PintelMarketFactory.CreateParams memory p = _defaultParams("btc-100k");

        vm.prank(creator);
        address market = factory.createMarket(p);

        assertEq(factory.getMarketByLabel("btc-100k"), market);
    }

    function test_getMarketsByCategory() public {
        PintelMarketFactory.CreateParams memory p1 = _defaultParams("btc-100k");

        PintelMarketFactory.CreateParams memory p2 = PintelMarketFactory.CreateParams({
            label: "eth-10k",
            question: "Will ETH hit 10k?",
            oracle: oracleAddr,
            token: address(token),
            k: sd(1e18),
            b: sd(10e18),
            endTime: block.timestamp + 1 hours,
            category: "crypto"
        });

        vm.startPrank(creator);
        address m1 = factory.createMarket(p1);
        address m2 = factory.createMarket(p2);
        vm.stopPrank();

        address[] memory cryptoMarkets = factory.getMarketsByCategory("crypto");
        assertEq(cryptoMarkets.length, 2);
        assertEq(cryptoMarkets[0], m1);
        assertEq(cryptoMarkets[1], m2);
    }

    function test_updateMarketRecords() public {
        PintelMarketFactory.CreateParams memory p = _defaultParams("btc-100k");

        vm.prank(creator);
        factory.createMarket(p);

        bytes32 labelHash = keccak256(bytes("btc-100k"));

        vm.expectEmit(true, false, false, false);
        emit PintelMarketFactory.MarketRecordsUpdated(labelHash, factory.markets(labelHash));
        factory.updateMarketRecords(labelHash);

        bytes32 subnode = keccak256(abi.encodePacked(PARENT_NODE, labelHash));
        assertEq(resolver.texts(subnode, "totalPool"), "0");
        assertEq(resolver.texts(subnode, "status"), "active");
    }

    function test_recordResolution() public {
        PintelMarketFactory.CreateParams memory p = PintelMarketFactory.CreateParams({
            label: "btc-100k",
            question: "Will BTC hit 100k?",
            oracle: address(this),
            token: address(token),
            k: sd(1e18),
            b: sd(10e18),
            endTime: block.timestamp + 1 hours,
            category: "crypto"
        });

        vm.prank(creator);
        address market = factory.createMarket(p);

        vm.warp(block.timestamp + 2 hours);
        PintelMarket(market).resolve(sd(100000e18));

        bytes32 labelHash = keccak256(bytes("btc-100k"));

        vm.expectEmit(true, false, false, false);
        emit PintelMarketFactory.MarketResolutionRecorded(labelHash, market, 100000e18);
        factory.recordResolution(labelHash);

        bytes32 subnode = keccak256(abi.encodePacked(PARENT_NODE, labelHash));
        assertEq(resolver.texts(subnode, "status"), "resolved");
    }

    function test_setMarketContentHash() public {
        PintelMarketFactory.CreateParams memory p = _defaultParams("btc-100k");

        vm.prank(creator);
        factory.createMarket(p);

        bytes32 labelHash = keccak256(bytes("btc-100k"));
        bytes memory contenthash = hex"e301017012200000000000000000000000000000000000000000000000000000000000000001";
        address marketAddr = factory.markets(labelHash);

        vm.expectEmit(true, false, false, false);
        emit PintelMarketFactory.ContentHashSet(labelHash, marketAddr);
        vm.prank(creator);
        factory.setMarketContentHash(labelHash, contenthash);

        bytes32 subnode = keccak256(abi.encodePacked(PARENT_NODE, labelHash));
        assertEq(resolver.contenthashes(subnode), contenthash);
    }
}
