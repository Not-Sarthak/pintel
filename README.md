# Pintel — Distribution Prediction Markets

Because higher precision deserves higher returns

## Deployed Contracts (Sepolia)

| Contract | Address |
|---|---|
| PintelMarket (impl) | [`0xe8fAe54b3358bF79C09b82D140B212828971f52B`](https://sepolia.etherscan.io/address/0xe8fAe54b3358bF79C09b82D140B212828971f52B) |
| PintelMarketFactory | [`0xE41D71CE0F5C2A26946eE999C33B5a523F151759`](https://sepolia.etherscan.io/address/0xE41D71CE0F5C2A26946eE999C33B5a523F151759) |
| ChainlinkResolver | [`0xd480c456A7CbbDE3F209170bB587A977e1A5CFcf`](https://sepolia.etherscan.io/address/0xd480c456A7CbbDE3F209170bB587A977e1A5CFcf) |
| MockERC20 (collateral) | [`0xEb2927E0274d4A1D52685610bf256468b79EEa4d`](https://sepolia.etherscan.io/address/0xEb2927E0274d4A1D52685610bf256468b79EEa4d) |

ENS: `pintel.eth` on Sepolia

## Architecture 

![Pintel Architecture](./arch.png)

## Protocol Integrations

- **Yellow Network** — Off-chain order book for secondary position trading via ERC-7824 state channels
- **ENS** — Subname registration (`*.pintel.eth`) and text records for market indexing and trader reputation
- **Chainlink** — Price feed oracles for settlement and Automation keepers for trustless market resolution at expiry

## Contract Functions

### PintelMarketFactory

| Function | Description |
|---|---|
| `createMarket(params)` | Deploy a new prediction market as an ERC-1167 clone with ENS subname |
| `getAllMarkets()` | Returns all deployed market addresses |
| `getMarketsByCreator(address)` | Returns markets created by a specific address |
| `userStats(address)` | Returns trader reputation: wins, totalClaims, totalPayout |
| `syncReputationToENS(bytes32)` | Writes trader stats to ENS text records |
| `updateMarketRecords(bytes32)` | Updates market ENS records (totalPool, status, positionCount) |
| `recordResolution(bytes32)` | Records final outcome to ENS after market resolves |
| `recordClaim(address,uint256,bool)` | Updates trader stats after a claim |

### PintelMarket

| Function | Description |
|---|---|
| `openPosition(mu, sigma, collateral)` | Open a Gaussian position with predicted mean, confidence, and stake |
| `closePosition(positionId)` | Withdraw collateral before market ends |
| `transferPosition(positionId, newOwner)` | Transfer position ownership to another address |
| `claim(positionId)` | Claim payout after market is resolved |
| `resolve(outcome)` | Oracle-only: resolve market with final outcome value |
| `question()` | Returns the market question string |
| `getActivePositionCount()` | Returns number of active positions |
| `getMarketDistribution()` | Returns aggregate (mu, sigma) across all positions |
| `positions(id)` | Returns full position data: owner, mu, sigma, collateral, active, claimed |

### ChainlinkResolver

| Function | Description |
|---|---|
| `registerMarket(market, priceFeed)` | Register a market with its Chainlink price feed |
| `resolveMarket(market)` | Resolve a single market using live Chainlink price |
| `batchResolve(markets)` | Resolve multiple expired markets in one tx |
| `checkUpkeep(checkData)` | Chainlink Automation: checks if any markets need resolving |
| `performUpkeep(performData)` | Chainlink Automation: resolves eligible markets |

## Contract Architecture

```
PintelMarketFactory.sol ── Creates markets via ERC-1167 clones
  ├── ENS subname registration (*.pintel.eth)
  ├── Text records (question, category, status, endTime)
  └── User reputation tracking (wins, accuracy, payout)

PintelMarket.sol ── Core AMM + positions + settlement
  ├── L² norm CFMM over Gaussian distributions
  ├── Position lifecycle: open → close / resolve → claim
  └── Payout = totalPool × userPDF(outcome) / ΣallPDFs(outcome)

GaussianMath.sol ── Fixed-point Gaussian math (PRBMath SD59x18)
  ├── pdf, l2Norm, scaledPdf, peak, minSigma
  └── All pure functions, no state

ChainlinkResolver.sol ── Automated oracle resolution
  ├── Reads Chainlink price feeds
  ├── Chainlink Automation compatible (checkUpkeep/performUpkeep)
  └── Batch resolve multiple markets
```

## Tech Stack

- **Contracts**: Solidity 0.8.24, Foundry, OpenZeppelin, PRBMath SD59x18, Solady
- **Oracle**: Chainlink Price Feeds + Automation
- **Identity**: ENS subnames + text records
- **Frontend**: Next.js 15, wagmi v2, ConnectKit, Recharts, Binance WebSocket
- **Chain**: Ethereum Sepolia