"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { MarketCard } from "@/components/market-card";
import { Button } from "@/components/ui/button";
import { usePrices } from "@/hooks/use-prices";
import { useAllMarkets } from "@/hooks/use-market";
import { CATEGORIES } from "@/lib/gaussian";
import { cn } from "@/lib/utils";

export default function MarketsPage() {
	const [activeCategory, setActiveCategory] = useState("All");
	const prices = usePrices();
	const { address: account } = useAccount();
	const { markets, isLoading } = useAllMarkets();

	return (
		<div className="mx-auto max-w-7xl border-x border-edge px-4 py-8 md:py-12">
			<div className="mb-10 text-center">
				<h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
					Distribution Prediction Markets
				</h1>
				<p className="mt-3 text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
					Place predictions as Gaussian distributions. Express your conviction
					with confidence intervals and earn from market accuracy.
				</p>
				<div className="mt-5 flex justify-center gap-3">
					<Button asChild>
						<Link href="/create">Create Market</Link>
					</Button>
				</div>
			</div>

			<div className="mb-4 flex items-center gap-3">
				<div className="flex items-center gap-2 overflow-x-auto pb-1">
					{CATEGORIES.map((cat) => (
						<button
							key={cat}
							type="button"
							onClick={() => setActiveCategory(cat)}
							className={cn(
								"rounded-full px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
								activeCategory === cat
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
							)}
						>
							{cat}
						</button>
					))}
				</div>
				<div className="flex-1" />
				{prices.size > 0 && (
					<div className="hidden sm:flex items-center gap-4 text-xs font-mono text-muted-foreground">
						{Array.from(prices.entries()).map(([sym, data]) => (
							<span key={sym} className="flex items-center gap-1">
								<span className="font-medium text-foreground">{sym}</span>
								<span>${data.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
								<span className={data.change24h >= 0 ? "text-green-500" : "text-red-500"}>
									{data.change24h >= 0 ? "+" : ""}{data.change24h.toFixed(2)}%
								</span>
							</span>
						))}
					</div>
				)}
			</div>

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
							<div className="h-4 w-20 rounded bg-muted mb-3" />
							<div className="h-5 w-full rounded bg-muted mb-2" />
							<div className="h-5 w-3/4 rounded bg-muted mb-3" />
							<div className="h-12 w-full rounded bg-muted mb-3" />
							<div className="flex justify-between">
								<div className="h-4 w-16 rounded bg-muted" />
								<div className="h-4 w-16 rounded bg-muted" />
							</div>
						</div>
					))}
				</div>
			)}

			{account && !isLoading && markets.length === 0 && (
				<div className="py-16 text-center">
					<p className="text-muted-foreground mb-4">No markets yet.</p>
					<Button asChild>
						<Link href="/create">Create One</Link>
					</Button>
				</div>
			)}

			{account && !isLoading && markets.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{markets.map((addr) => (
						<MarketCard
							key={addr}
							address={addr}
							activeCategory={activeCategory}
						/>
					))}
				</div>
			)}
		</div>
	);
}
