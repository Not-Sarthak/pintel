"use client";

import { formatAddress } from "@/lib/gaussian";
import type { ActivityEvent } from "@/hooks/use-market";
import { cn } from "@/lib/utils";
import type { AskOrder, FillEvent } from "@/lib/yellow-types";

export interface YellowActivityEvent {
	id: string;
	source: "yellow";
	type: "ask" | "fill" | "listed";
	description: string;
	from: string;
	timestamp: number;
}

type CombinedEvent =
	| (ActivityEvent & { source: "chain" })
	| YellowActivityEvent;

interface ActivityFeedProps {
	activities: ActivityEvent[];
	yellowAsks?: AskOrder[];
	yellowFills?: FillEvent[];
}

function timeAgo(timestamp: number): string {
	const now = Date.now() / 1000;
	const diff = now - timestamp;

	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}

function ActivityIcon({ type, source }: { type: string; source: "chain" | "yellow" }) {
	if (source === "yellow") {
		return (
			<div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
				<span className="text-xs text-amber-600 dark:text-amber-400">&#9889;</span>
			</div>
		);
	}

	if (type === "open") {
		return (
			<div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
				<svg
					className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
				</svg>
			</div>
		);
	}
	if (type === "close") {
		return (
			<div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
				<svg
					className="h-3 w-3 text-red-600 dark:text-red-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
				</svg>
			</div>
		);
	}
	return (
		<div className="flex h-6 w-6 items-center justify-center rounded-full bg-lilac-100 dark:bg-lilac-900/40">
			<svg
				className="h-3 w-3 text-lilac-600 dark:text-lilac-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
			>
				<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>
	);
}

export function ActivityFeed({ activities, yellowAsks = [], yellowFills = [] }: ActivityFeedProps) {
	// Merge on-chain and Yellow events into a unified timeline
	const chainEvents: CombinedEvent[] = activities.map((a) => ({ ...a, source: "chain" as const }));

	const yellowEvents: YellowActivityEvent[] = [
		...yellowFills.map((f) => ({
			id: `fill-${f.positionId}-${f.ts}`,
			source: "yellow" as const,
			type: "fill" as const,
			description: `${formatAddress(f.buyer)} bought #${f.positionId} for ${f.price} ytest.usd`,
			from: f.buyer,
			timestamp: f.ts / 1000,
		})),
		...yellowAsks.map((a) => ({
			id: `ask-${a.positionId}-${a.ts}`,
			source: "yellow" as const,
			type: "listed" as const,
			description: `${formatAddress(a.from)} listed #${a.positionId} for ${a.price} ytest.usd`,
			from: a.from,
			timestamp: a.ts / 1000,
		})),
	];

	const combined: CombinedEvent[] = [...chainEvents, ...yellowEvents].sort(
		(a, b) => b.timestamp - a.timestamp,
	);

	return (
		<div className="max-h-64 overflow-y-auto space-y-0">
			{combined.map((event, i) => {
				if (event.source === "yellow") {
					return (
						<div
							key={event.id}
							className={cn(
								"flex items-start gap-3 py-2.5 px-1",
								i < combined.length - 1 && "border-b border-border/40",
							)}
						>
							<ActivityIcon type={event.type} source="yellow" />
							<div className="flex-1 min-w-0">
								<p className="text-xs leading-relaxed text-foreground">
									{event.description}
								</p>
							</div>
							<span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
								{timeAgo(event.timestamp)}
							</span>
						</div>
					);
				}

				const activity = event;
				const actionWord =
					activity.type === "open"
						? "opened"
						: activity.type === "close"
							? "closed"
							: "claimed";
				const collateralDisplay = Number(activity.collateral) / 1e18;

				return (
					<div
						key={activity.txHash ? `${activity.txHash}-${activity.id}` : activity.id}
						className={cn(
							"flex items-start gap-3 py-2.5 px-1",
							i < combined.length - 1 && "border-b border-border/40",
						)}
					>
						<ActivityIcon type={activity.type} source="chain" />
						<div className="flex-1 min-w-0">
							<p className="text-xs leading-relaxed">
								<span className="font-mono font-medium text-foreground">
									{formatAddress(activity.owner)}
								</span>{" "}
								<span className="text-muted-foreground">{actionWord} position</span>
								{activity.type === "open" && (
									<>
										{" "}
										<span className="font-mono text-foreground">
											{"\u03BC"}={activity.mu.toLocaleString(undefined, { maximumFractionDigits: 2 })}
										</span>{" "}
										<span className="font-mono text-foreground">
											{"\u03C3"}={activity.sigma.toLocaleString(undefined, { maximumFractionDigits: 2 })}
										</span>
									</>
								)}
								{" "}
								<span className="text-muted-foreground">with</span>{" "}
								<span className="font-mono font-medium text-foreground">
									{collateralDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
								</span>
							</p>
						</div>
						<span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
							{timeAgo(activity.timestamp)}
						</span>
					</div>
				);
			})}
			{combined.length === 0 && (
				<div className="py-6 text-center text-sm text-muted-foreground">
					No activity yet.
				</div>
			)}
		</div>
	);
}
