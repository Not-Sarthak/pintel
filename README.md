# Pintel — Distribution Prediction Markets

Continuous prediction markets where traders bet on probability distributions, not binary outcomes. Powered by an L² norm CFMM over Gaussian distributions, settled on-chain with ENS integration and Chainlink automation.

## Deployed Contracts (Sepolia)

| Contract | Address |
|---|---|
| PintelMarket (impl) | `0xb6eF6c0470bEBa3FC81989b749A2d59f98427ad5` |
| PintelMarketFactory | `0x91D18534A0b651ddb0Ee17cc9F7eAd06EA922F51` |
| ChainlinkResolver | `0x900921A2f87c3dF0A6E7a05Dc2caE50aa18EaF16` |
| MockERC20 (collateral) | `0x76311a2a8f7d89aD802181c4c47DaD53b7050781` |

ENS: `pintel.eth` on Sepolia

## CLI Commands

All commands use `cast` (from Foundry). Set env vars first:

```bash
export RPC=https://0xrpc.io/sep
export PK=<your-private-key>
export FACTORY=0x91D18534A0b651ddb0Ee17cc9F7eAd06EA922F51
export TOKEN=0x76311a2a8f7d89aD802181c4c47DaD53b7050781
export RESOLVER=0x900921A2f87c3dF0A6E7a05Dc2caE50aa18EaF16
```

### View Markets

```bash
# List all market addresses
cast call $FACTORY "getAllMarkets()(address[])" --rpc-url $RPC

# Read market question
cast call <MARKET> "question()(string)" --rpc-url $RPC

# Check if market is resolved
cast call <MARKET> "resolved()(bool)" --rpc-url $RPC

# Get market end time
cast call <MARKET> "endTime()(uint256)" --rpc-url $RPC

# Get total pool
cast call <MARKET> "totalPool()(uint256)" --rpc-url $RPC

# Get active position count
cast call <MARKET> "getActivePositionCount()(uint256)" --rpc-url $RPC

# Get aggregate distribution (mu, sigma)
cast call <MARKET> "getMarketDistribution()(int256,int256)" --rpc-url $RPC
```

### Resolve a Market

For **custom markets** (balls in bowl, etc.) — the oracle calls resolve with the answer:

```bash
# Resolve with outcome = 42 (value * 1e18 for SD59x18)
cast send <MARKET> "resolve(int256)" 42000000000000000000 --rpc-url $RPC --private-key $PK
```

For **crypto markets** — use ChainlinkResolver (reads price automatically):

```bash
# Register market with Chainlink feed
cast send $RESOLVER "registerMarket(address,address)" <MARKET> <CHAINLINK_FEED> --rpc-url $RPC --private-key $PK

# Resolve (reads live price from Chainlink)
cast send $RESOLVER "resolveMarket(address)" <MARKET> --rpc-url $RPC --private-key $PK

# Batch resolve multiple markets
cast send $RESOLVER "batchResolve(address[])" "[<MARKET1>,<MARKET2>]" --rpc-url $RPC --private-key $PK
```

Chainlink Sepolia feeds:
- BTC/USD: `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`
- ETH/USD: `0x694AA1769357215DE4FAC081bf1f309aDC325306`

### Open a Position

```bash
# Approve collateral first (100 tokens)
cast send $TOKEN "approve(address,uint256)" <MARKET> 100000000000000000000 --rpc-url $RPC --private-key $PK

# Open position: mu=50000 (BTC price), sigma=2000, collateral=100 tokens
# Values are SD59x18 (multiply by 1e18)
cast send <MARKET> "openPosition(int256,int256,uint256)" 50000000000000000000000 2000000000000000000000 100000000000000000000 --rpc-url $RPC --private-key $PK
```

### Close / Claim

```bash
# Close position (before market ends)
cast send <MARKET> "closePosition(uint256)" <POSITION_ID> --rpc-url $RPC --private-key $PK

# Claim payout (after market is resolved)
cast send <MARKET> "claim(uint256)" <POSITION_ID> --rpc-url $RPC --private-key $PK
```

### Mint Test Tokens

```bash
# Mint 1M tokens to any address
cast send $TOKEN "mint(address,uint256)" <ADDRESS> 1000000000000000000000000 --rpc-url $RPC --private-key $PK
```

### ENS Records

```bash
# Update market ENS records (totalPool, status, positionCount)
cast send $FACTORY "updateMarketRecords(bytes32)" <LABEL_HASH> --rpc-url $RPC --private-key $PK

# Record resolution to ENS permanently
cast send $FACTORY "recordResolution(bytes32)" <LABEL_HASH> --rpc-url $RPC --private-key $PK

# Get label hash
cast keccak "btc-test"
```

## Architecture

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

## Dev Setup

```bash
# Contracts
cd contracts
forge build
forge test -vvv

# Frontend
cd frontend
bun install
bun dev
```

## Deploy

```bash
cd contracts
cp .env.example .env  # Fill in PRIVATE_KEY and SEPOLIA_RPC_URL
make deploy-sepolia-no-verify
```

## Tech Stack

- **Contracts**: Solidity 0.8.24, Foundry, OpenZeppelin Clones, PRBMath SD59x18, Solady
- **Oracle**: Chainlink Price Feeds + Automation
- **Identity**: ENS subnames + text records
- **Frontend**: Next.js 15, wagmi v2, ConnectKit, Recharts, Binance WebSocket
- **Chain**: Ethereum Sepolia

## Key Math

```
Position = Gaussian(μ, σ) on L² hypersphere with norm = k
Collateral = computed from L² norm constraint
Settlement payout = totalPool × PDF_user(x*) / Σ PDF_all(x*)
PDF(x) = (1/(σ√2π)) × e^(-z²/2), z = (x-μ)/σ
```
