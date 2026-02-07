"use client";

import { Countdown } from "@/components/market/countdown";
import { formatAddress, formatUSD } from "@/lib/gaussian";
import type { MarketData } from "@/hooks/use-market";
import { cn } from "@/lib/utils";

interface MarketInfoProps {
	market: MarketData;
}

export function MarketInfo({ market }: MarketInfoProps) {
	const totalPoolDisplay = Number(market.totalPool) / 1e18;

	return (
		<div className="rounded-lg border border-border bg-card p-4 space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-card-foreground">
					Market Info
				</h3>
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
						market.resolved
							? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
							: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
					)}
				>
					<span
						className={cn(
							"h-1.5 w-1.5 rounded-full",
							market.resolved
								? "bg-red-500"
								: "bg-emerald-500 animate-pulse",
						)}
					/>
					{market.resolved ? "Resolved" : "Active"}
				</span>
			</div>

			<div className="space-y-3">
				<InfoRow
					label="Contract"
					value={formatAddress(market.address)}
					mono
				/>
				<InfoRow
					label="Oracle"
					value={formatAddress(market.oracle)}
					mono
				/>
				<InfoRow
					label="Time Remaining"
					value={
						<Countdown
							endTime={market.endTime}
							className="font-mono"
						/>
					}
				/>
				<InfoRow
					label="Total Pool"
					value={formatUSD(totalPoolDisplay)}
					mono
					highlight
				/>
				<InfoRow
					label="Positions"
					value={String(market.positionCount)}
					mono
				/>
				{market.resolved && (
					<InfoRow
						label="Outcome"
						value={market.outcome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
						mono
						highlight
					/>
				)}
			</div>
		</div>
	);
}

function InfoRow({
	label,
	value,
	mono,
	highlight,
}: {
	label: string;
	value: React.ReactNode;
	mono?: boolean;
	highlight?: boolean;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span
				className={cn(
					"text-xs",
					mono && "font-mono",
					highlight
						? "font-semibold text-foreground"
						: "text-card-foreground",
				)}
			>
				{value}
			</span>
		</div>
	);
}
