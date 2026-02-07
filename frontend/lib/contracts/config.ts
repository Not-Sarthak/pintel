import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
import type { Abi } from "viem";
import _PintelMarketABI from "./PintelMarket.json";
import _PintelMarketFactoryABI from "./PintelMarketFactory.json";

export const FACTORY_ADDRESS =
	"0xFe0bEcca9014A9564A87D7d350880C44855826E7" as `0x${string}`;
export const COLLATERAL_TOKEN =
	"0x7443EB62Baa26fcd6033d4bD3D7d4A3789F2d137" as `0x${string}`;

export const FACTORY_DEPLOY_BLOCK = BigInt(10203972);

export const PintelMarketABI = _PintelMarketABI as unknown as Abi;
export const PintelMarketFactoryABI = _PintelMarketFactoryABI as unknown as Abi;

export const config = createConfig(
	getDefaultConfig({
		chains: [sepolia, mainnet],
		transports: {
			[sepolia.id]: http(),
			[mainnet.id]: http("https://1rpc.io/sepolia"),
		},
		walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
		appName: "Pintel",
		appDescription: "Distribution Prediction Markets",
	}),
);
