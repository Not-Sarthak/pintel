-include .env

.PHONY: all build clean test fmt snapshot anvil deploy-anvil deploy-sepolia deploy-sepolia-no-verify

all: clean build

build:
	@forge build

clean:
	@forge clean

test:
	@forge test -vvv

test-gas:
	@forge test --gas-report

snapshot:
	@forge snapshot

fmt:
	@forge fmt

anvil:
	@anvil

deploy-anvil:
	@forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key $(ANVIL_PRIVATE_KEY) --broadcast -vvvv

deploy-sepolia:
	@forge script script/Deploy.s.sol --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast --verify --etherscan-api-key $(ETHERSCAN_API_KEY) -vvvv

deploy-sepolia-no-verify:
	@forge script script/Deploy.s.sol --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast -vvvv

resolve-market:
	@forge script script/ResolveMarket.s.sol --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast -vvvv

create-market:
	@forge script script/CreateMarket.s.sol --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast -vvvv
