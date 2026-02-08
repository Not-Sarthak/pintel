"use client";

import Link from "next/link";
import { MiniDistributionChart } from "@/components/market/distribution-chart";
import { MagicCard } from "@/components/ui/magic-card";
import { formatUSD } from "@/lib/gaussian";
import { useMarket, useMarketPositions, useMarketENS } from "@/hooks/use-market";
import { useYellowContext } from "@/components/providers/yellow-provider";
import { usePrices } from "@/hooks/use-prices";
import { cn } from "@/lib/utils";

const INTER = { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' } as const;

function detectSymbol(question: string): string | null {
	const q = question.toUpperCase();
	if (q.includes("BTC") || q.includes("BITCOIN")) return "BTC";
	if (q.includes("ETH") || q.includes("ETHEREUM")) return "ETH";
	if (q.includes("SOL") || q.includes("SOLANA")) return "SOL";
	return null;
}

function StatusDot({ resolved, ended }: { resolved: boolean; ended: boolean }) {
	if (resolved) {
		return (
			<span className="relative flex h-2.5 w-2.5" title="Resolved">
				<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
			</span>
		);
	}
	if (ended) {
		return (
			<span className="relative flex h-2.5 w-2.5" title="To Resolve">
				<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
				<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
			</span>
		);
	}
	return (
		<span className="relative flex h-2.5 w-2.5" title="Active">
			<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
			<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
		</span>
	);
}

interface MarketCardProps {
	address: `0x${string}`;
}

export function MarketCard({ address }: MarketCardProps) {
	const { market, isLoading } = useMarket(address);
	const { positions } = useMarketPositions(
		address,
		market?.positionCount ?? 0,
	);
	const { category } = useMarketENS(address);
	const prices = usePrices();
	const yellow = useYellowContext();
	const onlineTraders = yellow.getOnlineTraders(address);

	if (isLoading || !market) {
		return (
			<div className="rounded-xl border border-border bg-card p-4 animate-pulse" style={INTER}>
				<div className="h-3 w-16 rounded bg-muted mb-3" />
				<div className="h-4 w-full rounded bg-muted mb-2" />
				<div className="h-4 w-2/3 rounded bg-muted mb-4" />
				<div className="h-px bg-border mb-3" />
				<div className="flex justify-between">
					<div className="h-3 w-12 rounded bg-muted" />
					<div className="h-3 w-16 rounded bg-muted" />
				</div>
			</div>
		);
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

	return (
		<Link href={`/market/${address}`} className="block group" style={INTER}>
			<MagicCard
				gradientColor="var(--color-muted)"
				gradientFrom="#9E7AFF"
				gradientTo="#FE8BBB"
				gradientSize={250}
				gradientOpacity={0.5}
			>
				<div className="p-4">
					{/* Header: category + status */}
					<div className="flex items-center justify-between mb-3">
						<span className="text-[11px] text-muted-foreground">
							{category || "Crypto"}
						</span>
						<StatusDot resolved={market.resolved} ended={ended} />
					</div>

					{/* Question */}
					<p className="text-sm text-card-foreground line-clamp-2 mb-2">
						{market.question}
					</p>

					{/* Live price row */}
					{livePrice && !market.resolved && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
							<span className="text-foreground">
								${livePrice.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
							</span>
							<span className={cn("flex items-center gap-0.5", livePrice.change24h >= 0 ? "text-green-500" : "text-red-500")}>
								<span className="text-[10px]">{livePrice.change24h >= 0 ? "\u25B2" : "\u25BC"}</span>
								{Math.abs(livePrice.change24h).toFixed(2)}%
							</span>
							<span>
								H: ${livePrice.high24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
								L: ${livePrice.low24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
							</span>
						</div>
					)}

					{/* Resolved outcome */}
					{market.resolved && (
						<div className="flex items-center gap-2 mb-3 text-xs">
							<span className="text-muted-foreground">Answer:</span>
							<span className="text-emerald-600 dark:text-emerald-400">
								{market.outcome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
							</span>
						</div>
					)}

					{/* Distribution chart */}
					{curvePositions.length > 0 && (
						<div className="mb-3 rounded-md bg-muted/40 overflow-hidden">
							<MiniDistributionChart positions={curvePositions} />
						</div>
					)}

					{/* Footer: pool + positions */}
					<div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
						<div className="flex items-center gap-1.5">
							<span className="text-foreground">{formatUSD(totalPoolDisplay)}</span>
							<span>Pool</span>
						</div>
						<div className="flex items-center gap-3">
							{onlineTraders.length > 0 && (
								<div className="flex items-center gap-1">
									<span className="relative flex h-1.5 w-1.5">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
										<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
									</span>
									<span className="text-emerald-600 dark:text-emerald-400">
										{onlineTraders.length} online
									</span>
								</div>
							)}
							<span>{market.positionCount} positions</span>
						</div>
					</div>
				</div>
			</MagicCard>
		</Link>
	);
}
