// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SD59x18 } from "@prb/math/SD59x18.sol";
import { Ownable } from "solady/auth/Ownable.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}

interface IPintelMarket {
    function endTime() external view returns (uint256);
    function resolved() external view returns (bool);
    function oracle() external view returns (address);
    function resolve(SD59x18 outcome) external;
}

contract ChainlinkResolver is Ownable, AutomationCompatibleInterface {
    error AlreadyResolved();
    error MarketNotExpired();
    error FeedNotRegistered();
    error OracleMismatch();
    error StalePrice();
    error InvalidPrice();

    event MarketRegistered(address indexed market, address indexed priceFeed);
    event MarketResolved(address indexed market, SD59x18 price);

    mapping(address => address) public priceFeeds;
    mapping(address => bool) public isResolved;
    address[] public registeredMarkets;

    constructor() {
        _initializeOwner(msg.sender);
    }

    function registerMarket(address market, address priceFeed) external onlyOwner {
        if (IPintelMarket(market).oracle() != address(this)) revert OracleMismatch();
        priceFeeds[market] = priceFeed;
        registeredMarkets.push(market);
        emit MarketRegistered(market, priceFeed);
    }

    function resolveMarket(address market) public {
        if (isResolved[market]) revert AlreadyResolved();
        address feed = priceFeeds[market];
        if (feed == address(0)) revert FeedNotRegistered();
        if (block.timestamp < IPintelMarket(market).endTime()) revert MarketNotExpired();

        SD59x18 price = _getPrice(feed);
        isResolved[market] = true;
        IPintelMarket(market).resolve(price);
        emit MarketResolved(market, price);
    }

    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        uint256 len = registeredMarkets.length;
        for (uint256 i; i < len; ++i) {
            address market = registeredMarkets[i];
            if (!isResolved[market] && block.timestamp >= IPintelMarket(market).endTime()) {
                return (true, abi.encode(market));
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        address market = abi.decode(performData, (address));
        resolveMarket(market);
    }

    function getPrice(address market) external view returns (SD59x18) {
        address feed = priceFeeds[market];
        if (feed == address(0)) revert FeedNotRegistered();
        return _getPrice(feed);
    }

    function batchResolve(address[] calldata markets) external {
        uint256 len = markets.length;
        for (uint256 i; i < len; ++i) {
            resolveMarket(markets[i]);
        }
    }

    function getRegisteredMarkets() external view returns (address[] memory) {
        return registeredMarkets;
    }

    function _getPrice(address feed) internal view returns (SD59x18) {
        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        if (answer <= 0) revert InvalidPrice();
        if (updatedAt == 0) revert StalePrice();
        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();
        int256 scaled = answer * int256(10 ** (18 - feedDecimals));
        return SD59x18.wrap(scaled);
    }
}
