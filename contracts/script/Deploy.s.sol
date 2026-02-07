// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { PintelMarket } from "../src/PintelMarket.sol";
import { PintelMarketFactory } from "../src/PintelMarketFactory.sol";
import { ChainlinkResolver } from "../src/ChainlinkResolver.sol";
import { MockERC20 } from "../test/mocks/MockERC20.sol";

contract Deploy is Script {
    address constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address constant PUBLIC_RESOLVER = 0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5;

    bytes32 constant PARENT_NODE = 0xffa860d61690ce3f3168d982722c462085234324cbd83f5c8f7acc50a7263e9c;

    address constant BTC_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    address constant ETH_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        PintelMarket marketImpl = new PintelMarket();
        console.log("PintelMarket impl:", address(marketImpl));

        PintelMarketFactory factory = new PintelMarketFactory(
            ENS_REGISTRY,
            PUBLIC_RESOLVER,
            PARENT_NODE,
            address(marketImpl)
        );
        console.log("PintelMarketFactory:", address(factory));

        ChainlinkResolver resolver = new ChainlinkResolver();
        console.log("ChainlinkResolver:", address(resolver));

        MockERC20 token = new MockERC20();
        console.log("MockERC20 (collateral):", address(token));

        address deployer = vm.addr(deployerKey);
        token.mint(deployer, 1_000_000e18);
        console.log("Minted 1M tokens to deployer");

        vm.stopBroadcast();

        console.log("");
        console.log("=== NEXT STEPS ===");
        console.log("1. Register pintel.eth on Sepolia ENS at app.ens.domains");
        console.log("2. Approve factory as operator on ENS:");
        console.log("   cast send 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e 'setApprovalForAll(address,bool)' <FACTORY_ADDR> true");
        console.log("3. Update frontend FACTORY_ADDRESS in lib/contracts/config.ts");
    }
}
