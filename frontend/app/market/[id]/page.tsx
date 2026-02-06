"use client";

import { use, useCallback } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { DistributionChart } from "@/components/distribution-chart";
import { MarketInfo } from "@/components/market-info";
import { PositionForm } from "@/components/position-form";
import { PositionsTable } from "@/components/positions-table";
import { OrderBook } from "@/components/order-book";
import { useYellowContext } from "@/components/providers/yellow-provider";
import { usePrices } from "@/hooks/use-prices";
import {
	useMarket,
	useMarketPositions,
	useMarketEvents,
	useMarketENS,
} from "@/hooks/use-market";
import { CHART_COLORS } from "@/lib/gaussian";
import { formatAddress } from "@/lib/gaussian";

function detectSymbol(question: string): string | null {
	const q = question.toUpperCase();
	if (q.includes("BTC") || q.includes("BITCOIN")) return "BTC";
	if (q.includes("ETH") || q.includes("ETHEREUM")) return "ETH";
	if (q.includes("SOL") || q.includes("SOLANA")) return "SOL";
	return null;
}

export default function MarketDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const marketAddress = id as `0x${string}`;
	const prices = usePrices();
	const { market, isLoading, refetch } = useMarket(marketAddress);
	const { positions, isLoading: positionsLoading, refetch: refetchPositions } = useMarketPositions(
		marketAddress,
		market?.positionCount ?? 0,
	);
	const events = useMarketEvents(marketAddress);
	const { ensName, category } = useMarketENS(marketAddress);
	const yellow = useYellowContext();
	const yellowAsks = yellow.getAsks(marketAddress);
	const yellowFills = yellow.getFills(marketAddress);

	const refetchAll = useCallback(async () => {
		await refetch();
		// Small delay so on-chain state has propagated
		setTimeout(() => refetchPositions(), 1500);
	}, [refetch, refetchPositions]);

	if (isLoading) {
		return (
			<div className="mx-auto max-w-7xl border-x border-edge px-4 py-6 md:py-8">
				<div className="animate-pulse space-y-6">
					<div className="h-6 w-48 rounded bg-muted" />
					<div className="h-8 w-full rounded bg-muted" />
					<div className="h-64 w-full rounded bg-muted" />
				</div>
			</div>
		);
	}

	if (!market) {
		return (
			<div className="mx-auto max-w-7xl border-x border-edge px-4 py-16 text-center">
				<h1 className="text-xl font-semibold text-foreground mb-2">
					Market Not Found
				</h1>
				<p className="text-muted-foreground text-sm">
					The market you are looking for does not exist or could not be loaded.
				</p>
			</div>
		);
	}

	const symbol = detectSymbol(market.question);
	const livePrice = symbol ? prices.get(symbol) : null;

	const activePositions = positions.filter((p) => p.active);
	const curvePositions = activePositions.map((p, i) => ({
		mu: p.mu,
		sigma: p.sigma,
		label: `${formatAddress(p.owner)} (\u03BC=${p.mu.toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
		color: CHART_COLORS[i % CHART_COLORS.length],
	}));

	const muValues = activePositions.map((p) => p.mu);
	const sigmaValues = activePositions.map((p) => p.sigma);

	function defaultRange(): [number, number] {
		if (livePrice) {
			const spread = livePrice.price * 0.2;
			return [
				Math.round(livePrice.price - spread),
				Math.round(livePrice.price + spread),
			];
		}
		return [0, 100];
	}

	const muRange: [number, number] =
		muValues.length > 0
			? [
					Math.min(...muValues) - Math.max(...sigmaValues) * 3,
					Math.max(...muValues) + Math.max(...sigmaValues) * 3,
				]
			: defaultRange();

	return (
		<div className="mx-auto max-w-7xl border-x border-edge px-4 py-6 md:py-8">
			<div className="mb-6">
				<div className="flex items-center gap-2 mb-2">
					<span className="inline-flex items-center rounded-md bg-lilac-100 px-2 py-0.5 text-xs font-medium text-lilac-700 dark:bg-lilac-900/40 dark:text-lilac-300">
						{category || "Crypto"}
					</span>
					{ensName ? (
						<span className="text-xs text-muted-foreground font-mono">
							{ensName}
						</span>
					) : (
						<span className="text-xs text-muted-foreground font-mono">
							{formatAddress(marketAddress)}
						</span>
					)}
					{livePrice && (
						<span className="ml-auto flex items-center gap-2 text-sm font-mono">
							<span className="font-semibold text-foreground">
								${livePrice.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
							</span>
							<span className={livePrice.change24h >= 0 ? "text-green-500" : "text-red-500"}>
								{livePrice.change24h >= 0 ? "+" : ""}{livePrice.change24h.toFixed(2)}%
							</span>
						</span>
					)}
				</div>
				<h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
					{market.question}
				</h1>
			</div>

			<div className="flex flex-col lg:flex-row gap-6">
				<div className="flex-1 lg:max-w-[65%] space-y-6">
					<div className="rounded-lg border border-border bg-card p-4">
						<h2 className="text-sm font-semibold text-card-foreground mb-3">
							Distribution
						</h2>
						{curvePositions.length > 0 ? (
							<DistributionChart
								positions={curvePositions}
								range={muRange}
								height={320}
							/>
						) : (
							<div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
								No positions yet. Be the first to open one.
							</div>
						)}
					</div>

					<div className="rounded-lg border border-border bg-card p-4">
						<h2 className="text-sm font-semibold text-card-foreground mb-3">
							Positions
						</h2>
						<PositionsTable
							positions={positions}
							resolved={market.resolved}
							marketAddress={marketAddress}
							onTxSuccess={refetchAll}
						/>
					</div>

					<div className="rounded-lg border border-border bg-card p-4">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-semibold text-card-foreground">
								Activity
							</h2>
							{events.length > 0 && (
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
									<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
								</span>
							)}
						</div>
						<ActivityFeed activities={events} yellowAsks={yellowAsks} yellowFills={yellowFills} />
					</div>
				</div>

				<div className="lg:w-[35%] space-y-4">
					<OrderBook marketAddress={marketAddress} positions={positions} market={market} allPositions={activePositions} onTxSuccess={refetchAll} />
					<PositionForm
						muRange={muRange}
						existingPositions={activePositions}
						marketAddress={marketAddress}
						collateralToken={market.collateralToken as `0x${string}`}
						onSuccess={refetchAll}
					/>
					<MarketInfo market={market} />
				</div>
			</div>
		</div>
	);
}
