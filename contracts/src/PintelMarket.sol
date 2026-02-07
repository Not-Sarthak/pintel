// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SD59x18, sd } from "@prb/math/SD59x18.sol";
import { Initializable } from "solady/utils/Initializable.sol";
import { ReentrancyGuard } from "solady/utils/ReentrancyGuard.sol";
import { SafeTransferLib } from "solady/utils/SafeTransferLib.sol";
import { GaussianMath } from "./GaussianMath.sol";

contract PintelMarket is Initializable, ReentrancyGuard {
    error MarketResolved();
    error MarketNotResolved();
    error MarketExpired();
    error MarketNotExpired();
    error NotOracle();
    error NotPositionOwner();
    error PositionInactive();
    error PositionAlreadyClaimed();
    error SigmaTooLow();
    error PeakExceedsBacking();
    error ZeroCollateral();
    error NoPayout();
    error TransferToSelf();
    error ZeroAddress();

    struct Position {
        uint256 id;
        address owner;
        SD59x18 mu;
        SD59x18 sigma;
        uint256 collateral;
        bool active;
        bool claimed;
    }

    event MarketInitialized(string question, address oracle, address token, SD59x18 k, SD59x18 b, uint256 endTime);
    event PositionOpened(uint256 indexed positionId, address indexed owner, SD59x18 mu, SD59x18 sigma, uint256 collateral);
    event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 collateralReturned);
    event OutcomeResolved(SD59x18 outcome);
    event PayoutClaimed(uint256 indexed positionId, address indexed owner, uint256 payout);
    event PositionTransferred(uint256 indexed positionId, address indexed from, address indexed to);

    string public question;
    address public oracle;
    address public collateralToken;
    SD59x18 public k;
    SD59x18 public b;
    uint256 public endTime;
    bool public resolved;
    SD59x18 public outcome;

    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;
    uint256 public totalPool;
    uint256[] public activePositionIds;

    function initialize(
        string calldata _question,
        address _oracle,
        address _token,
        SD59x18 _k,
        SD59x18 _b,
        uint256 _endTime
    ) external initializer {
        question = _question;
        oracle = _oracle;
        collateralToken = _token;
        k = _k;
        b = _b;
        endTime = _endTime;

        emit MarketInitialized(_question, _oracle, _token, _k, _b, _endTime);
    }

    function openPosition(
        SD59x18 mu,
        SD59x18 sigma,
        uint256 collateralAmount
    ) external nonReentrant returns (uint256 positionId) {
        if (resolved) revert MarketResolved();
        if (block.timestamp >= endTime) revert MarketExpired();
        if (collateralAmount == 0) revert ZeroCollateral();

        SD59x18 _minSigma = GaussianMath.minSigma(k, b);
        if (sigma < _minSigma) revert SigmaTooLow();

        SD59x18 peakVal = GaussianMath.peak(k, sigma);
        if (peakVal > b) revert PeakExceedsBacking();

        positionId = nextPositionId++;

        positions[positionId] = Position({
            id: positionId,
            owner: msg.sender,
            mu: mu,
            sigma: sigma,
            collateral: collateralAmount,
            active: true,
            claimed: false
        });

        activePositionIds.push(positionId);
        totalPool += collateralAmount;

        SafeTransferLib.safeTransferFrom(collateralToken, msg.sender, address(this), collateralAmount);

        emit PositionOpened(positionId, msg.sender, mu, sigma, collateralAmount);
    }

    function closePosition(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionInactive();
        if (resolved) revert MarketResolved();

        pos.active = false;
        uint256 refund = pos.collateral;
        totalPool -= refund;

        _removeActivePosition(positionId);

        SafeTransferLib.safeTransfer(collateralToken, msg.sender, refund);

        emit PositionClosed(positionId, msg.sender, refund);
    }

    function transferPosition(uint256 positionId, address newOwner) external nonReentrant {
        if (newOwner == address(0)) revert ZeroAddress();
        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionInactive();
        if (newOwner == msg.sender) revert TransferToSelf();

        pos.owner = newOwner;

        emit PositionTransferred(positionId, msg.sender, newOwner);
    }

    function resolve(SD59x18 _outcome) external {
        if (msg.sender != oracle) revert NotOracle();
        if (block.timestamp < endTime) revert MarketNotExpired();
        if (resolved) revert MarketResolved();

        resolved = true;
        outcome = _outcome;

        emit OutcomeResolved(_outcome);
    }

    function claim(uint256 positionId) external nonReentrant {
        if (!resolved) revert MarketNotResolved();

        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionInactive();
        if (pos.claimed) revert PositionAlreadyClaimed();

        SD59x18 userPdf = GaussianMath.pdf(outcome, pos.mu, pos.sigma);

        SD59x18 sumPdfs = sd(0);
        uint256 len = activePositionIds.length;
        for (uint256 i; i < len; ++i) {
            Position storage p = positions[activePositionIds[i]];
            if (p.active) {
                sumPdfs = sumPdfs + GaussianMath.pdf(outcome, p.mu, p.sigma);
            }
        }

        if (sumPdfs <= sd(0)) revert NoPayout();

        pos.claimed = true;

        SD59x18 share = userPdf.div(sumPdfs);
        uint256 payout = uint256(SD59x18.unwrap(share * sd(int256(totalPool))));

        SafeTransferLib.safeTransfer(collateralToken, msg.sender, payout);

        emit PayoutClaimed(positionId, msg.sender, payout);
    }

    function getMarketDistribution() external view returns (SD59x18 aggMu, SD59x18 aggSigma) {
        SD59x18 totalWeight = sd(0);
        aggMu = sd(0);
        aggSigma = sd(0);

        uint256 len = activePositionIds.length;
        for (uint256 i; i < len; ++i) {
            Position storage p = positions[activePositionIds[i]];
            if (p.active) {
                SD59x18 w = sd(int256(p.collateral));
                totalWeight = totalWeight + w;
                aggMu = aggMu + w * p.mu;
                aggSigma = aggSigma + w * p.sigma;
            }
        }

        if (totalWeight > sd(0)) {
            aggMu = aggMu.div(totalWeight);
            aggSigma = aggSigma.div(totalWeight);
        }
    }

    function getPositionValue(uint256 positionId) external view returns (SD59x18) {
        Position storage pos = positions[positionId];
        if (!pos.active) return sd(0);

        SD59x18 sumPdfs = sd(0);
        SD59x18 userPdf = sd(0);

        (SD59x18 aggMu, SD59x18 aggSigma) = this.getMarketDistribution();

        if (aggSigma <= sd(0)) return sd(int256(pos.collateral));

        userPdf = GaussianMath.pdf(aggMu, pos.mu, pos.sigma);

        uint256 len = activePositionIds.length;
        for (uint256 i; i < len; ++i) {
            Position storage p = positions[activePositionIds[i]];
            if (p.active) {
                sumPdfs = sumPdfs + GaussianMath.pdf(aggMu, p.mu, p.sigma);
            }
        }

        if (sumPdfs <= sd(0)) return sd(int256(pos.collateral));

        return sd(int256(totalPool)) * userPdf / sumPdfs;
    }

    function computeCollateral(SD59x18 mu, SD59x18 sigma) external view returns (uint256) {
        SD59x18 _minSigma = GaussianMath.minSigma(k, b);
        if (sigma < _minSigma) revert SigmaTooLow();

        SD59x18 peakVal = GaussianMath.peak(k, sigma);
        if (peakVal > b) revert PeakExceedsBacking();

        SD59x18 scaledPeak = GaussianMath.scaledPdf(mu, mu, sigma, k);

        uint256 raw = uint256(SD59x18.unwrap(scaledPeak));
        return raw > 0 ? raw : 1;
    }

    function getActivePositionCount() external view returns (uint256) {
        return activePositionIds.length;
    }

    function _removeActivePosition(uint256 positionId) internal {
        uint256 len = activePositionIds.length;
        for (uint256 i; i < len; ++i) {
            if (activePositionIds[i] == positionId) {
                activePositionIds[i] = activePositionIds[len - 1];
                activePositionIds.pop();
                return;
            }
        }
    }
}
