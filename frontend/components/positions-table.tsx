"use client";

import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { formatAddress, formatUSD } from "@/lib/gaussian";
import type { PositionData } from "@/hooks/use-market";
import { CHART_COLORS } from "@/lib/gaussian";
import { useClosePosition, useClaim } from "@/hooks/use-market";
import { cn } from "@/lib/utils";

interface PositionsTableProps {
	positions: PositionData[];
	resolved?: boolean;
	marketAddress: `0x${string}`;
}

export function PositionsTable({
	positions,
	resolved = false,
	marketAddress,
}: PositionsTableProps) {
	const { address } = useAccount();
	const { close, isPending: isClosing, isConfirming: isCloseConfirming } =
		useClosePosition(marketAddress);
	const { claim, isPending: isClaiming, isConfirming: isClaimConfirming } =
		useClaim(marketAddress);

	const sorted = [...positions]
		.filter((p) => p.active)
		.sort((a, b) => Number(b.collateral - a.collateral));

	const handleClose = (positionId: number) => {
		close(positionId);
	};

	const handleClaim = (positionId: number) => {
		claim(positionId);
	};

	return (
		<div className="w-full overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-border text-xs text-muted-foreground">
						<th className="pb-2 pr-3 text-left font-medium">#</th>
						<th className="pb-2 pr-3 text-left font-medium">Trader</th>
						<th className="pb-2 pr-3 text-right font-medium">Prediction</th>
						<th className="pb-2 pr-3 text-right font-medium">Confidence</th>
						<th className="pb-2 pr-3 text-right font-medium">Collateral</th>
						<th className="pb-2 text-right font-medium">Action</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((pos, idx) => {
						const isOwner =
							address?.toLowerCase() === pos.owner.toLowerCase();
						const colorVar = CHART_COLORS[idx % CHART_COLORS.length];
						const collateralDisplay = Number(pos.collateral) / 1e18;

						return (
							<tr
								key={pos.id}
								className={cn(
									"border-b border-border/50 transition-colors hover:bg-muted/50",
									isOwner && "bg-lilac-50/50 dark:bg-lilac-900/20",
								)}
							>
								<td className="py-2.5 pr-3">
									<div className="flex items-center gap-2">
										<div
											className="h-2.5 w-2.5 rounded-full"
											style={{ backgroundColor: colorVar }}
										/>
										<span className="font-mono text-xs text-muted-foreground">
											{pos.id}
										</span>
									</div>
								</td>
								<td className="py-2.5 pr-3">
									<span className="font-mono text-xs">
										{formatAddress(pos.owner)}
									</span>
									{isOwner && (
										<span className="ml-1.5 text-[10px] font-medium text-lilac-600 dark:text-lilac-400">
											YOU
										</span>
									)}
								</td>
								<td className="py-2.5 pr-3 text-right font-mono text-xs">
									{pos.mu.toLocaleString(undefined, { maximumFractionDigits: 2 })}
								</td>
								<td className="py-2.5 pr-3 text-right font-mono text-xs">
									{pos.sigma.toLocaleString(undefined, { maximumFractionDigits: 2 })}
								</td>
								<td className="py-2.5 pr-3 text-right font-mono text-xs font-medium">
									{formatUSD(collateralDisplay)}
								</td>
								<td className="py-2.5 text-right">
									{isOwner && !resolved && (
										<Button
											variant="outline"
											size="sm"
											className="h-6 text-[11px] px-2"
											onClick={() => handleClose(pos.id)}
											disabled={isClosing || isCloseConfirming}
										>
											{isClosing || isCloseConfirming ? "..." : "Close"}
										</Button>
									)}
									{isOwner && resolved && !pos.claimed && (
										<Button
											variant="default"
											size="sm"
											className="h-6 text-[11px] px-2"
											onClick={() => handleClaim(pos.id)}
											disabled={isClaiming || isClaimConfirming}
										>
											{isClaiming || isClaimConfirming ? "..." : "Claim"}
										</Button>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			{sorted.length === 0 && (
				<div className="py-8 text-center text-sm text-muted-foreground">
					No active positions yet.
				</div>
			)}
		</div>
	);
}
