"use client";

import { use } from "react";
import Link from "next/link";
import { useTraderProfile } from "@/hooks/use-market";
import { formatAddress } from "@/lib/gaussian";

function ReputationBadge({ wins, totalClaims }: { wins: number; totalClaims: number }) {
	if (totalClaims === 0) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span className="text-xl">●</span>
				<span>Newcomer</span>
			</div>
		);
	}
	const accuracy = wins / totalClaims;
	if (accuracy >= 0.7) {
		return (
			<div className="flex items-center gap-2 text-sm text-amber-500">
				<span className="text-xl">★</span>
				<span className="font-semibold">Gold Trader</span>
			</div>
		);
	}
	if (accuracy >= 0.4) {
		return (
			<div className="flex items-center gap-2 text-sm text-blue-400">
				<span className="text-xl">◆</span>
				<span className="font-semibold">Silver Trader</span>
			</div>
		);
	}
	return (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			<span className="text-xl">●</span>
			<span className="font-semibold">Bronze Trader</span>
		</div>
	);
}

export default function TraderProfilePage({
	params,
}: {
	params: Promise<{ address: string }>;
}) {
	const { address } = use(params);
	const traderAddress = address as `0x${string}`;
	const { stats, createdMarkets, isLoading } = useTraderProfile(traderAddress);

	if (isLoading) {
		return (
			<div className="mx-auto min-w-6xl max-w-6xl border-x border-edge px-4 py-6 md:py-8">
				<div className="animate-pulse space-y-6">
					<div className="h-6 w-48 rounded bg-muted" />
					<div className="h-8 w-full rounded bg-muted" />
					<div className="h-64 w-full rounded bg-muted" />
				</div>
			</div>
		);
	}

	const wins = stats?.wins ?? 0;
	const totalClaims = stats?.totalClaims ?? 0;
	const accuracy = totalClaims > 0 ? ((wins / totalClaims) * 100).toFixed(1) : "—";
	const totalPayout = stats ? (Number(stats.totalPayout) / 1e18).toFixed(2) : "0.00";

	return (
		<div className="mx-auto min-w-6xl max-w-6xl border-x border-edge px-4 py-6 md:py-8">
			{/* Header */}
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
					{formatAddress(traderAddress)}
				</h1>
				<button
					onClick={() => navigator.clipboard.writeText(traderAddress)}
					className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					Copy
				</button>
				<a
					href={`https://sepolia.etherscan.io/address/${traderAddress}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs text-lilac-600 hover:text-lilac-500 dark:text-lilac-400 dark:hover:text-lilac-300 transition-colors"
				>
					View on Etherscan
				</a>
			</div>

			{/* Reputation Badge */}
			<div className="mb-6">
				<ReputationBadge wins={wins} totalClaims={totalClaims} />
			</div>

			{/* Stats Row */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
				{[
					{ label: "Wins", value: wins.toString() },
					{ label: "Total Claims", value: totalClaims.toString() },
					{ label: "Accuracy", value: accuracy === "—" ? "—" : `${accuracy}%` },
					{ label: "Total Payout", value: `${totalPayout} USDC` },
				].map((stat) => (
					<div
						key={stat.label}
						className="rounded-lg border border-border bg-card p-4"
					>
						<p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
						<p className="text-lg font-semibold text-foreground">
							{stat.value}
						</p>
					</div>
				))}
			</div>

			{/* Created Markets */}
			<div className="rounded-lg border border-border bg-card p-4 mb-6">
				<h2 className="text-sm font-semibold text-card-foreground mb-3">
					Created Markets
				</h2>
				{createdMarkets.length > 0 ? (
					<ul className="space-y-2">
						{createdMarkets.map((addr) => (
							<li key={addr}>
								<Link
									href={`/market/${addr}`}
									className="text-xs text-lilac-600 hover:text-lilac-500 dark:text-lilac-400 dark:hover:text-lilac-300 transition-colors"
								>
									{formatAddress(addr)}
								</Link>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-muted-foreground">
						No markets created yet.
					</p>
				)}
			</div>

			{/* ENS Sync Note */}
			<div className="rounded-lg border border-border/50 bg-muted/30 p-3">
				<p className="text-xs text-muted-foreground">
					<span className="font-medium text-foreground">ENS Reputation</span>{" "}
					— Trader stats (wins, claims, payout) can be synced on-chain via{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-[11px]">
						syncReputationToENS
					</code>{" "}
					which writes stats as ENS text records under the Pintel subdomain.
				</p>
			</div>
		</div>
	);
}
