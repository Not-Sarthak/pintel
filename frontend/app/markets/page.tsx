"use client";

import { useAccount } from "wagmi";
import { MarketCard } from "@/components/market/market-card";
import { Marquee } from "@/components/ui/marquee";
import { usePrices } from "@/hooks/use-prices";
import { useAllMarkets } from "@/hooks/use-market";
import { cn } from "@/lib/utils";

const ASSET_LOGOS: Record<string, string> = {
	BTC: "/images/logos/btc.png",
	ETH: "/images/logos/eth.png",
	SOL: "/images/logos/solana.png",
};

export default function MarketsPage() {
	const prices = usePrices();
	const { address: account } = useAccount();
	const { markets, isLoading } = useAllMarkets();

	const priceEntries = Array.from(prices.entries());

	return (
		<div className="mx-auto min-w-6xl max-w-6xl border-x border-edge px-4 py-8 md:py-12">
			{priceEntries.length > 0 && (
				<div className="mb-6 rounded-lg border border-border bg-card overflow-hidden">
					<Marquee pauseOnHover className="py-2 [--duration:25s] [--gap:2rem]">
						{priceEntries.map(([sym, data]) => (
							<div key={sym} className="flex items-center gap-2 text-sm">
								{ASSET_LOGOS[sym] && (
									<img src={ASSET_LOGOS[sym]} alt={sym} className="h-5 w-5 rounded-full" />
								)}
								<span className="text-foreground">{sym}</span>
								<span className="text-muted-foreground">
									${data.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
								</span>
								<span className={cn("flex items-center gap-0.5", data.change24h >= 0 ? "text-green-500" : "text-red-500")}>
									<span className="text-[10px]">{data.change24h >= 0 ? "\u25B2" : "\u25BC"}</span>
									{Math.abs(data.change24h).toFixed(2)}%
								</span>
							</div>
						))}
					</Marquee>
				</div>
			)}

			{!account && (
				<div className="py-16 text-center text-muted-foreground">
					Connect your wallet to view markets.
				</div>
			)}

			{account && isLoading && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className="rounded-lg border border-border bg-card p-4 animate-pulse"
						>
							<div className="h-3 w-16 rounded bg-muted mb-3" />
							<div className="h-4 w-full rounded bg-muted mb-2" />
							<div className="h-4 w-2/3 rounded bg-muted mb-4" />
							<div className="h-px bg-border mb-3" />
							<div className="flex justify-between">
								<div className="h-3 w-12 rounded bg-muted" />
								<div className="h-3 w-16 rounded bg-muted" />
							</div>
						</div>
					))}
				</div>
			)}

			{account && !isLoading && markets.length === 0 && (
				<div className="py-16 text-center">
					<p className="text-muted-foreground">No markets yet.</p>
				</div>
			)}

			{account && !isLoading && markets.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{markets.map((addr) => (
						<MarketCard key={addr} address={addr} />
					))}
				</div>
			)}
		</div>
	);
}
