import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
import type { Abi } from "viem";
import _PintelMarketABI from "./PintelMarket.json";
import _PintelMarketFactoryABI from "./PintelMarketFactory.json";

export const FACTORY_ADDRESS =
	"0xE41D71CE0F5C2A26946eE999C33B5a523F151759" as `0x${string}`;
export const COLLATERAL_TOKEN =
	"0xEb2927E0274d4A1D52685610bf256468b79EEa4d" as `0x${string}`;

export const FACTORY_DEPLOY_BLOCK = BigInt(10212392);

export const PintelMarketABI = _PintelMarketABI as unknown as Abi;
export const PintelMarketFactoryABI = _PintelMarketFactoryABI as unknown as Abi;

export const config = createConfig(
	getDefaultConfig({
		chains: [sepolia, mainnet],
		transports: {
			[sepolia.id]: http("https://1rpc.io/sepolia"),
			[mainnet.id]: http("https://mainnet.infura.io/v3/ac32b22de500426487b6e43291cbb008"),
		},
		walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
		appName: "Pintel",
		appDescription: "Distribution Prediction Markets",
	}),
);
