"use client";

import { use } from "react";
import Link from "next/link";
import { useTraderProfile } from "@/hooks/use-market";
import { formatAddress } from "@/lib/gaussian";

const INTER = { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' } as const;

function ReputationBadge({ wins, totalClaims }: { wins: number; totalClaims: number }) {
	const accuracy = totalClaims > 0 ? wins / totalClaims : 0;
	const tier = accuracy >= 0.7 ? "Gold" : accuracy >= 0.4 ? "Silver" : "Bronze";
	const colors = {
		Gold: "border-amber-500/50 text-amber-500",
		Silver: "border-blue-400/50 text-blue-400",
		Bronze: "border-yellow-500/50 text-yellow-500",
	};
	return (
		<span className={`inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[10px] ${colors[tier]}`}>
			{tier} Trader
		</span>
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
			<div className="mx-auto min-w-6xl max-w-6xl border-x border-edge px-4 py-6 md:py-8" style={INTER}>
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
	const accuracy = totalClaims > 0 ? ((wins / totalClaims) * 100).toFixed(1) : "\u2014";
	const totalPayout = stats ? (Number(stats.totalPayout) / 1e18).toFixed(2) : "0.00";

	return (
		<div className="mx-auto min-w-6xl max-w-6xl border-x border-edge px-4 py-6 md:py-8" style={INTER}>
			{/* Header */}
			<div className="mb-6 flex items-center gap-3">
				<div
					className="h-10 w-10 rounded-lg shrink-0"
					style={{
						background: `linear-gradient(135deg, hsl(${parseInt(traderAddress.slice(2, 6), 16) % 360}, 70%, 60%), hsl(${parseInt(traderAddress.slice(6, 10), 16) % 360}, 70%, 50%))`,
					}}
				/>
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<h1 className="text-sm text-foreground">
							{formatAddress(traderAddress)}.pintel.eth
						</h1>
						<button
							onClick={() => navigator.clipboard.writeText(traderAddress)}
							className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
							title="Copy address"
						>
							<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
							</svg>
						</button>
						<a
							href={`https://sepolia.etherscan.io/address/${traderAddress}`}
							target="_blank"
							rel="noopener noreferrer"
							className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
						>
							Etherscan &#8599;
						</a>
						<ReputationBadge wins={wins} totalClaims={totalClaims} />
					</div>
				</div>
			</div>

			{/* Stats Row */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				{[
					{ label: "Wins", value: String(wins) },
					{ label: "Claims", value: String(totalClaims) },
					{ label: "Accuracy", value: accuracy === "\u2014" ? "\u2014" : `${accuracy}%` },
					{ label: "Payout", value: `${totalPayout} USDC` },
				].map((s) => (
					<div key={s.label} className="rounded-lg border border-border bg-card p-4">
						<p className="text-xs text-muted-foreground mb-1">{s.label}</p>
						<p className="text-lg text-foreground">{s.value}</p>
					</div>
				))}
			</div>

			{/* Created Markets */}
			{createdMarkets.length > 0 && (
				<div className="rounded-lg border border-border bg-card p-4">
					<h2 className="text-sm text-card-foreground mb-3">Created Markets</h2>
					<div className="space-y-2">
						{createdMarkets.map((addr) => (
							<Link
								key={addr}
								href={`/market/${addr}`}
								className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
							>
								<span>{formatAddress(addr)}</span>
								<span className="text-[11px]">&#8594;</span>
							</Link>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
