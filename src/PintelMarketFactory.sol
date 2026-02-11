// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SD59x18 } from "@prb/math/SD59x18.sol";
import { Ownable } from "solady/auth/Ownable.sol";
import { LibString } from "solady/utils/LibString.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { PintelMarket } from "./PintelMarket.sol";

interface IENS {
    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external;
    function owner(bytes32 node) external view returns (address);
}

interface IResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function setAddr(bytes32 node, address a) external;
    function setContenthash(bytes32 node, bytes calldata hash) external;
}

contract PintelMarketFactory is Ownable {
    error LabelAlreadyTaken();
    error MarketNotFound();
    error NotMarketCreator();
    error MarketNotResolved();
    error NotNameOwner();

    struct CreateParams {
        string label;
        string question;
        address oracle;
        address token;
        SD59x18 k;
        SD59x18 b;
        uint256 endTime;
        string category;
    }

    event MarketCreated(
        bytes32 indexed labelHash,
        address indexed market,
        address indexed creator,
        string label,
        string category
    );
    event MarketRecordsUpdated(bytes32 indexed labelHash, address indexed market);
    event MarketResolutionRecorded(bytes32 indexed labelHash, address indexed market, int256 outcome);
    event ContentHashSet(bytes32 indexed labelHash, address indexed market);
    event ReputationSynced(address indexed user, bytes32 indexed ensNode, uint256 wins, uint256 total);

    IENS public immutable ens;
    IResolver public immutable resolver;
    bytes32 public immutable parentNode;
    address public immutable marketImpl;

    struct UserStats {
        uint256 wins;
        uint256 totalClaims;
        uint256 totalPayout;
    }

    mapping(bytes32 => address) public markets;
    mapping(bytes32 => address) public marketCreators;
    mapping(address => address[]) internal _creatorMarkets;
    mapping(bytes32 => address[]) internal _categoryMarkets;
    mapping(address => UserStats) public userStats;
    address[] public allMarkets;

    constructor(address ensRegistry, address _resolver, bytes32 _parentNode, address _marketImpl) {
        _initializeOwner(msg.sender);
        ens = IENS(ensRegistry);
        resolver = IResolver(_resolver);
        parentNode = _parentNode;
        marketImpl = _marketImpl;
    }

    function createMarket(CreateParams calldata p) external returns (address market) {
        bytes32 labelHash = keccak256(bytes(p.label));
        if (markets[labelHash] != address(0)) revert LabelAlreadyTaken();

        market = Clones.clone(marketImpl);
        PintelMarket(market).initialize(p.question, p.oracle, p.token, p.k, p.b, p.endTime);

        bytes32 subnode = keccak256(abi.encodePacked(parentNode, labelHash));
        ens.setSubnodeRecord(parentNode, labelHash, address(this), address(resolver), 0);

        _setInitialRecords(subnode, market, p);

        markets[labelHash] = market;
        marketCreators[labelHash] = msg.sender;
        _creatorMarkets[msg.sender].push(market);
        _categoryMarkets[keccak256(bytes(p.category))].push(market);
        allMarkets.push(market);

        emit MarketCreated(labelHash, market, msg.sender, p.label, p.category);
    }

    function _setInitialRecords(bytes32 subnode, address market, CreateParams calldata p) internal {
        IResolver r = resolver;
        r.setAddr(subnode, market);
        r.setText(subnode, "question", p.question);
        r.setText(subnode, "category", p.category);
        r.setText(subnode, "status", "active");
        r.setText(subnode, "endTime", LibString.toString(p.endTime));
    }

    function updateMarketRecords(bytes32 labelHash) external {
        address market = markets[labelHash];
        if (market == address(0)) revert MarketNotFound();

        PintelMarket m = PintelMarket(market);
        bytes32 subnode = keccak256(abi.encodePacked(parentNode, labelHash));
        IResolver r = resolver;

        r.setText(subnode, "totalPool", LibString.toString(m.totalPool()));
        r.setText(subnode, "status", m.resolved() ? "resolved" : "active");
        r.setText(subnode, "positionCount", LibString.toString(m.getActivePositionCount()));

        if (m.resolved()) {
            r.setText(subnode, "outcome", LibString.toString(SD59x18.unwrap(m.outcome())));
        }

        emit MarketRecordsUpdated(labelHash, market);
    }

    function recordResolution(bytes32 labelHash) external {
        address market = markets[labelHash];
        if (market == address(0)) revert MarketNotFound();

        PintelMarket m = PintelMarket(market);
        if (!m.resolved()) revert MarketNotResolved();

        bytes32 subnode = keccak256(abi.encodePacked(parentNode, labelHash));
        IResolver r = resolver;

        r.setText(subnode, "status", "resolved");
        r.setText(subnode, "outcome", LibString.toString(SD59x18.unwrap(m.outcome())));
        r.setText(subnode, "totalPool", LibString.toString(m.totalPool()));
        r.setText(subnode, "positionCount", LibString.toString(m.getActivePositionCount()));

        emit MarketResolutionRecorded(labelHash, market, SD59x18.unwrap(m.outcome()));
    }

    function setMarketContentHash(bytes32 labelHash, bytes calldata contenthash) external {
        address market = markets[labelHash];
        if (market == address(0)) revert MarketNotFound();
        if (marketCreators[labelHash] != msg.sender) revert NotMarketCreator();

        bytes32 subnode = keccak256(abi.encodePacked(parentNode, labelHash));
        resolver.setContenthash(subnode, contenthash);

        emit ContentHashSet(labelHash, market);
    }

    function getMarketByLabel(string calldata label) external view returns (address) {
        return markets[keccak256(bytes(label))];
    }

    function getMarketsByCreator(address creator) external view returns (address[] memory) {
        return _creatorMarkets[creator];
    }

    function getMarketsByCategory(string calldata category) external view returns (address[] memory) {
        return _categoryMarkets[keccak256(bytes(category))];
    }

    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }

    function marketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    function recordClaim(address user, uint256 payout, bool won) external {
        bool isMarket;
        uint256 len = allMarkets.length;
        for (uint256 i; i < len; ++i) {
            if (allMarkets[i] == msg.sender) { isMarket = true; break; }
        }
        if (!isMarket) revert MarketNotFound();

        userStats[user].totalClaims++;
        userStats[user].totalPayout += payout;
        if (won) userStats[user].wins++;
    }

    function syncReputationToENS(bytes32 userEnsNode) external {
        if (ens.owner(userEnsNode) != msg.sender) revert NotNameOwner();

        UserStats storage s = userStats[msg.sender];
        IResolver r = resolver;

        r.setText(userEnsNode, "com.pintel.wins", LibString.toString(s.wins));
        r.setText(userEnsNode, "com.pintel.total", LibString.toString(s.totalClaims));
        r.setText(userEnsNode, "com.pintel.payout", LibString.toString(s.totalPayout));

        if (s.totalClaims > 0) {
            r.setText(
                userEnsNode,
                "com.pintel.accuracy",
                string.concat(LibString.toString((s.wins * 100) / s.totalClaims), "%")
            );
        }

        emit ReputationSynced(msg.sender, userEnsNode, s.wins, s.totalClaims);
    }
}
