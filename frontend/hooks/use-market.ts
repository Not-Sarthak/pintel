"use client";

import { useState, useEffect, useCallback } from "react";
import {
	useReadContract,
	useReadContracts,
	useWriteContract,
	useWaitForTransactionReceipt,
	useWatchContractEvent,
	usePublicClient,
} from "wagmi";
import {
	FACTORY_ADDRESS,
	FACTORY_DEPLOY_BLOCK,
	PintelMarketABI,
	PintelMarketFactoryABI,
} from "@/lib/contracts/config";

const ERC20_ABI = [
	{
		type: "function",
		name: "approve",
		inputs: [
			{ name: "spender", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "allowance",
		inputs: [
			{ name: "owner", type: "address" },
			{ name: "spender", type: "address" },
		],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
] as const;

export function toSD59x18(value: number): bigint {
	return BigInt(Math.round(value * 1e18));
}

export function fromSD59x18(value: bigint): number {
	return Number(value) / 1e18;
}

export function useAllMarkets() {
	const { data, isLoading, error, refetch } = useReadContract({
		address: FACTORY_ADDRESS,
		abi: PintelMarketFactoryABI,
		functionName: "getAllMarkets",
	});

	return {
		markets: (data as `0x${string}`[] | undefined) ?? [],
		isLoading,
		error,
		refetch,
	};
}

export function useMarketENS(marketAddress: `0x${string}` | undefined) {
	const [ensName, setEnsName] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const client = usePublicClient();

	useEffect(() => {
		if (!client || !marketAddress) return;

		(async () => {
			try {
				const logs = await client.getLogs({
					address: FACTORY_ADDRESS,
					event: {
						type: "event",
						name: "MarketCreated",
						inputs: [
							{ name: "labelHash", type: "bytes32", indexed: true },
							{ name: "market", type: "address", indexed: true },
							{ name: "creator", type: "address", indexed: true },
							{ name: "label", type: "string", indexed: false },
							{ name: "category", type: "string", indexed: false },
						],
					},
					args: { market: marketAddress },
					fromBlock: FACTORY_DEPLOY_BLOCK,
					toBlock: "latest",
				});

				if (logs.length > 0) {
					const label = logs[0].args.label;
					const cat = logs[0].args.category;
					if (label) setEnsName(`${label}.pintel.eth`);
					if (cat) setCategory(cat);
				}
			} catch (err) {
				console.error("[useMarketENS] error:", err);
			}
		})();
	}, [client, marketAddress]);

	return { ensName, category };
}

export interface MarketData {
	address: `0x${string}`;
	question: string;
	oracle: string;
	collateralToken: string;
	k: number;
	b: number;
	endTime: number;
	resolved: boolean;
	outcome: number;
	totalPool: bigint;
	positionCount: number;
	aggMu: number;
	aggSigma: number;
}

export function useMarket(address: `0x${string}` | undefined) {
	const enabled = !!address;

	const { data, isLoading, error, refetch } = useReadContracts({
		contracts: [
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "question",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "oracle",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "collateralToken",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "k",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "b",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "endTime",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "resolved",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "outcome",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "totalPool",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "getActivePositionCount",
			},
			{
				address: address!,
				abi: PintelMarketABI,
				functionName: "getMarketDistribution",
			},
		],
		query: { enabled },
	});

	const market: MarketData | undefined =
		data && data[0]?.result !== undefined
			? {
					address: address!,
					question: data[0].result as string,
					oracle: data[1].result as string,
					collateralToken: data[2].result as string,
					k: fromSD59x18(data[3].result as bigint),
					b: fromSD59x18(data[4].result as bigint),
					endTime: Number(data[5].result as bigint),
					resolved: data[6].result as boolean,
					outcome: fromSD59x18(data[7].result as bigint),
					totalPool: data[8].result as bigint,
					positionCount: Number(data[9].result as bigint),
					aggMu: fromSD59x18(
						(data[10].result as [bigint, bigint])?.[0] ?? BigInt(0),
					),
					aggSigma: fromSD59x18(
						(data[10].result as [bigint, bigint])?.[1] ?? BigInt(0),
					),
				}
			: undefined;

	return { market, isLoading, error, refetch };
}

export interface PositionData {
	id: number;
	owner: string;
	mu: number;
	sigma: number;
	collateral: bigint;
	active: boolean;
	claimed: boolean;
}

export function useMarketPositions(
	marketAddress: `0x${string}` | undefined,
	positionCount: number,
) {
	const enabled = !!marketAddress && positionCount > 0;

	const idContracts = Array.from({ length: positionCount }, (_, i) => ({
		address: marketAddress!,
		abi: PintelMarketABI,
		functionName: "activePositionIds" as const,
		args: [BigInt(i)],
	}));

	const { data: idData, isLoading: idsLoading, refetch: refetchIds } = useReadContracts({
		contracts: idContracts,
		query: { enabled },
	});

	const positionIds: bigint[] = idData
		? idData
				.filter((d) => d.result !== undefined)
				.map((d) => d.result as bigint)
		: [];

	const posContracts = positionIds.map((pid) => ({
		address: marketAddress!,
		abi: PintelMarketABI,
		functionName: "positions" as const,
		args: [pid],
	}));

	const { data: posData, isLoading: posLoading, refetch: refetchPos } = useReadContracts({
		contracts: posContracts,
		query: { enabled: positionIds.length > 0 },
	});

	const positions: PositionData[] = posData
		? posData
				.filter((d) => d.result !== undefined)
				.map((d) => {
					const r = d.result as [
						bigint,
						string,
						bigint,
						bigint,
						bigint,
						boolean,
						boolean,
					];
					return {
						id: Number(r[0]),
						owner: r[1],
						mu: fromSD59x18(r[2]),
						sigma: fromSD59x18(r[3]),
						collateral: r[4],
						active: r[5],
						claimed: r[6],
					};
				})
		: [];

	const refetch = async () => {
		await refetchIds();
		await refetchPos();
	};

	return {
		positions,
		isLoading: idsLoading || posLoading,
		refetch,
	};
}

export interface ActivityEvent {
	id: string;
	type: "open" | "close" | "claim";
	owner: string;
	mu: number;
	sigma: number;
	collateral: bigint;
	timestamp: number;
	txHash: string;
}

export function useMarketEvents(marketAddress: `0x${string}` | undefined) {
	const [events, setEvents] = useState<ActivityEvent[]>([]);

	const onPositionOpened = useCallback(
		(logs: { args: { positionId: bigint; owner: string; mu: bigint; sigma: bigint; collateral: bigint }; transactionHash: string }[]) => {
			const newEvents: ActivityEvent[] = logs.map((log) => ({
				id: `open-${log.transactionHash}-${log.args.positionId}`,
				type: "open" as const,
				owner: log.args.owner,
				mu: fromSD59x18(log.args.mu),
				sigma: fromSD59x18(log.args.sigma),
				collateral: log.args.collateral,
				timestamp: Date.now() / 1000,
				txHash: log.transactionHash,
			}));
			setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
		},
		[],
	);

	const onPositionClosed = useCallback(
		(logs: { args: { positionId: bigint; owner: string; collateralReturned: bigint }; transactionHash: string }[]) => {
			const newEvents: ActivityEvent[] = logs.map((log) => ({
				id: `close-${log.transactionHash}-${log.args.positionId}`,
				type: "close" as const,
				owner: log.args.owner,
				mu: 0,
				sigma: 0,
				collateral: log.args.collateralReturned,
				timestamp: Date.now() / 1000,
				txHash: log.transactionHash,
			}));
			setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
		},
		[],
	);

	const onPayoutClaimed = useCallback(
		(logs: { args: { positionId: bigint; owner: string; payout: bigint }; transactionHash: string }[]) => {
			const newEvents: ActivityEvent[] = logs.map((log) => ({
				id: `claim-${log.transactionHash}-${log.args.positionId}`,
				type: "claim" as const,
				owner: log.args.owner,
				mu: 0,
				sigma: 0,
				collateral: log.args.payout,
				timestamp: Date.now() / 1000,
				txHash: log.transactionHash,
			}));
			setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
		},
		[],
	);

	useWatchContractEvent({
		address: marketAddress,
		abi: PintelMarketABI,
		eventName: "PositionOpened",
		enabled: !!marketAddress,
		onLogs: onPositionOpened as never,
	});

	useWatchContractEvent({
		address: marketAddress,
		abi: PintelMarketABI,
		eventName: "PositionClosed",
		enabled: !!marketAddress,
		onLogs: onPositionClosed as never,
	});

	useWatchContractEvent({
		address: marketAddress,
		abi: PintelMarketABI,
		eventName: "PayoutClaimed",
		enabled: !!marketAddress,
		onLogs: onPayoutClaimed as never,
	});

	return events;
}

export function useOpenPosition(marketAddress: `0x${string}` | undefined) {
	const client = usePublicClient();
	const {
		writeContract: approve,
		data: approveHash,
		isPending: isApproving,
	} = useWriteContract();

	const { isLoading: isApproveConfirming } =
		useWaitForTransactionReceipt({ hash: approveHash });

	const {
		writeContract: openPos,
		data: openHash,
		isPending: isOpening,
	} = useWriteContract();

	const { isLoading: isOpenConfirming, isSuccess: isOpenConfirmed } =
		useWaitForTransactionReceipt({ hash: openHash });

	const open = useCallback(
		(
			mu: number,
			sigma: number,
			collateralAmount: bigint,
			tokenAddress: `0x${string}`,
		) => {
			console.log("[openPosition] start", {
				market: marketAddress,
				mu,
				sigma,
				muSD59x18: toSD59x18(mu).toString(),
				sigmaSD59x18: toSD59x18(sigma).toString(),
				collateral: collateralAmount.toString(),
				token: tokenAddress,
			});
			approve(
				{
					address: tokenAddress,
					abi: ERC20_ABI,
					functionName: "approve",
					args: [marketAddress!, collateralAmount],
				},
				{
					onSuccess: async (hash) => {
						console.log("[openPosition] approve tx sent:", hash);
						console.log("[openPosition] waiting for approve confirmation...");
						await client!.waitForTransactionReceipt({ hash });
						console.log("[openPosition] approve confirmed, sending openPosition...");
						openPos(
							{
								address: marketAddress!,
								abi: PintelMarketABI,
								functionName: "openPosition",
								args: [toSD59x18(mu), toSD59x18(sigma), collateralAmount],
							},
							{
								onSuccess: (hash) => console.log("[openPosition] openPosition tx sent:", hash),
								onError: (err) => console.error("[openPosition] openPosition error:", err),
							},
						);
					},
					onError: (err) => console.error("[openPosition] approve error:", err),
				},
			);
		},
		[marketAddress, approve, openPos, client],
	);

	return {
		open,
		isApproving,
		isApproveConfirming,
		isOpening,
		isOpenConfirming,
		isConfirmed: isOpenConfirmed,
		txHash: openHash,
	};
}

export function useClosePosition(marketAddress: `0x${string}` | undefined) {
	const { writeContract, data: hash, isPending } = useWriteContract();
	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({ hash });

	const close = useCallback(
		(positionId: number) => {
			if (!marketAddress) return;
			writeContract({
				address: marketAddress,
				abi: PintelMarketABI,
				functionName: "closePosition",
				args: [BigInt(positionId)],
			});
		},
		[marketAddress, writeContract],
	);

	return { close, isPending, isConfirming, isConfirmed, txHash: hash };
}

export function useTransferPosition(marketAddress: `0x${string}` | undefined) {
	const { writeContract, data: hash, isPending } = useWriteContract();
	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({ hash });

	const transferPosition = useCallback(
		(positionId: number, newOwner: `0x${string}`) => {
			if (!marketAddress) return;
			console.log("[transferPosition] transferring #" + positionId + " to " + newOwner);
			writeContract({
				address: marketAddress,
				abi: PintelMarketABI,
				functionName: "transferPosition",
				args: [BigInt(positionId), newOwner],
			});
		},
		[marketAddress, writeContract],
	);

	return { transferPosition, isPending, isConfirming, isConfirmed, txHash: hash };
}

export function useClaim(marketAddress: `0x${string}` | undefined) {
	const { writeContract, data: hash, isPending } = useWriteContract();
	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({ hash });

	const claim = useCallback(
		(positionId: number) => {
			if (!marketAddress) return;
			writeContract({
				address: marketAddress,
				abi: PintelMarketABI,
				functionName: "claim",
				args: [BigInt(positionId)],
			});
		},
		[marketAddress, writeContract],
	);

	return { claim, isPending, isConfirming, isConfirmed, txHash: hash };
}

export function useCreateMarket() {
	const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
	const { isLoading: isConfirming, isSuccess: isConfirmed } =
		useWaitForTransactionReceipt({ hash });

	const create = useCallback(
		(params: {
			label: string;
			question: string;
			oracle: `0x${string}`;
			token: `0x${string}`;
			k: number;
			b: number;
			endTime: number;
			category: string;
		}) => {
			const args = {
				label: params.label,
				question: params.question,
				oracle: params.oracle,
				token: params.token,
				k: toSD59x18(params.k),
				b: toSD59x18(params.b),
				endTime: BigInt(params.endTime),
				category: params.category,
			};
			console.log("[useCreateMarket] writeContract args:", {
				address: FACTORY_ADDRESS,
				functionName: "createMarket",
				args: [args],
			});
			writeContract(
				{
					address: FACTORY_ADDRESS,
					abi: PintelMarketFactoryABI,
					functionName: "createMarket",
					args: [args],
				},
				{
					onSuccess: (hash) => console.log("[useCreateMarket] tx sent:", hash),
					onError: (err) => console.error("[useCreateMarket] error:", err),
				},
			);
		},
		[writeContract],
	);

	if (writeError) {
		console.error("[useCreateMarket] writeError:", writeError);
	}

	return { create, isPending, isConfirming, isConfirmed, txHash: hash, error: writeError };
}

export function useComputeCollateral(
	marketAddress: `0x${string}` | undefined,
	mu: number,
	sigma: number,
) {
	const { data, isLoading, error } = useReadContract({
		address: marketAddress!,
		abi: PintelMarketABI,
		functionName: "computeCollateral",
		args: [toSD59x18(mu), toSD59x18(sigma)],
		query: { enabled: !!marketAddress && sigma > 0 },
	});

	return {
		requiredCollateral: data as bigint | undefined,
		isLoading,
		error,
	};
}
