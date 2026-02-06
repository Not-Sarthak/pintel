"use client";

import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { MiniDistributionChart } from "@/components/distribution-chart";
import { formatUSD } from "@/lib/gaussian";
import { useMarket, useMarketPositions, useMarketENS } from "@/hooks/use-market";
import { useYellowContext } from "@/components/providers/yellow-provider";
import { usePrices } from "@/hooks/use-prices";
import { cn } from "@/lib/utils";

function detectSymbol(question: string): string | null {
	const q = question.toUpperCase();
	if (q.includes("BTC") || q.includes("BITCOIN")) return "BTC";
	if (q.includes("ETH") || q.includes("ETHEREUM")) return "ETH";
	if (q.includes("SOL") || q.includes("SOLANA")) return "SOL";
	return null;
}

interface MarketCardProps {
	address: `0x${string}`;
	activeCategory?: string;
}

export function MarketCard({ address, activeCategory }: MarketCardProps) {
	const { market, isLoading } = useMarket(address);
	const { positions } = useMarketPositions(
		address,
		market?.positionCount ?? 0,
	);
	const { ensName, category } = useMarketENS(address);
	const prices = usePrices();
	const yellow = useYellowContext();
	const onlineTraders = yellow.getOnlineTraders(address);

	if (isLoading || !market) {
		return (
			<div className="rounded-lg border border-border bg-card p-4 animate-pulse">
				<div className="h-4 w-20 rounded bg-muted mb-3" />
				<div className="h-5 w-full rounded bg-muted mb-2" />
				<div className="h-5 w-3/4 rounded bg-muted mb-3" />
				<div className="h-12 w-full rounded bg-muted mb-3" />
				<div className="flex justify-between">
					<div className="h-4 w-16 rounded bg-muted" />
					<div className="h-4 w-16 rounded bg-muted" />
				</div>
			</div>
		);
	}

	if (activeCategory && activeCategory !== "All") {
		return null;
	}

	const symbol = detectSymbol(market.question);
	const livePrice = symbol ? prices.get(symbol) : null;

	const curvePositions = positions
		.filter((p) => p.active)
		.map((p, i) => ({
			mu: p.mu,
			sigma: p.sigma,
			label: `Position ${i}`,
		}));

	const totalPoolDisplay = Number(market.totalPool) / 1e18;
	const now = Date.now() / 1000;
	const ended = now >= market.endTime;
	const status = market.resolved ? "Resolved" : ended ? "To Resolve" : "Active";

	return (
		<Link href={`/market/${address}`} className="block group">
			<div
				className={cn(
					"rounded-lg border border-border bg-card p-4 transition-all",
					"hover:border-lilac-400/50 hover:shadow-md",
					"dark:hover:border-lilac-500/40 dark:hover:shadow-lilac-900/20",
				)}
			>
				<div className="flex items-start justify-between gap-2 mb-3">
					<span className="inline-flex items-center rounded-md bg-lilac-100 px-2 py-0.5 text-xs font-medium text-lilac-700 dark:bg-lilac-900/40 dark:text-lilac-300">
						{category || "Crypto"}
					</span>
					<span className={cn(
						"text-xs font-medium",
						market.resolved ? "text-emerald-500" : ended ? "text-amber-500" : "text-muted-foreground",
					)}>
						{status}
					</span>
				</div>

				<h3 className="text-sm font-semibold text-card-foreground mb-1 line-clamp-2 group-hover:text-lilac-600 dark:group-hover:text-lilac-400 transition-colors">
					{market.question}
				</h3>

				{ensName && (
					<p className="text-xs font-mono text-muted-foreground mb-2">
						{ensName}
					</p>
				)}

				{market.resolved && (
					<div className="flex items-center gap-2 mb-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5">
						<span className="text-xs text-emerald-600 dark:text-emerald-400">Answer:</span>
						<span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300">
							{market.outcome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
						</span>
					</div>
				)}

				{livePrice && !market.resolved && (
					<div className="flex items-center gap-2 mb-3 text-xs font-mono">
						<span className="text-foreground font-medium">
							${livePrice.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
						</span>
						<span className={livePrice.change24h >= 0 ? "text-green-500" : "text-red-500"}>
							{livePrice.change24h >= 0 ? "+" : ""}{livePrice.change24h.toFixed(2)}%
						</span>
						<span className="text-muted-foreground">
							H: ${livePrice.high24h.toLocaleString(undefined, { maximumFractionDigits: 0 })} L: ${livePrice.low24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
						</span>
					</div>
				)}

				{curvePositions.length > 0 && (
					<div className="mb-3 rounded-md bg-muted/50 overflow-hidden">
						<MiniDistributionChart positions={curvePositions} />
					</div>
				)}

				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<div className="flex items-center gap-3">
						<span className="font-mono font-medium text-foreground">
							{formatUSD(totalPoolDisplay)}
						</span>
						<span>Pool</span>
					</div>
					<div className="flex items-center gap-3">
						{onlineTraders.length > 0 && (
							<div className="flex items-center gap-1">
								<span className="relative flex h-1.5 w-1.5">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
									<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
								</span>
								<span className="text-emerald-600 dark:text-emerald-400 font-medium">
									{onlineTraders.length} online
								</span>
							</div>
						)}
						<div className="flex items-center gap-1">
							<span className="font-mono">{market.positionCount}</span>
							<span>positions</span>
						</div>
					</div>
				</div>
			</div>
		</Link>
	);
}
