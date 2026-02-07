"use client";

import { useState, useEffect, useRef } from "react";
import {
	Area,
	AreaChart,
	ResponsiveContainer,
} from "recharts";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { gaussianPdf } from "@/lib/gaussian";
import { useOpenPosition } from "@/hooks/use-market";
import { cn } from "@/lib/utils";

interface PositionFormProps {
	muRange: [number, number];
	existingPositions: { mu: number; sigma: number }[];
	marketAddress: `0x${string}`;
	collateralToken: `0x${string}`;
	onSuccess?: () => void;
}

export function PositionForm({
	muRange,
	existingPositions,
	marketAddress,
	collateralToken,
	onSuccess,
}: PositionFormProps) {
	const [muMin, muMax] = muRange;
	const defaultMu = Math.round((muMin + muMax) / 2);
	const rangeSpan = muMax - muMin;
	const defaultSigma = Math.max(1, Math.round(rangeSpan * 0.1));
	const sigmaMin = Math.max(1, Math.round(rangeSpan * 0.01));
	const sigmaMax = Math.max(2, Math.round(rangeSpan * 0.5));

	const [mu, setMu] = useState(defaultMu);
	const [sigma, setSigma] = useState(defaultSigma);
	const [collateral, setCollateral] = useState(1000);

	const { address: account } = useAccount();
	const {
		open,
		isApproving,
		isApproveConfirming,
		isOpening,
		isOpenConfirming,
		isConfirmed,
		txHash,
	} = useOpenPosition(marketAddress);

	const calledOnSuccess = useRef(false);
	useEffect(() => {
		if (isConfirmed && !calledOnSuccess.current) {
			calledOnSuccess.current = true;
			onSuccess?.();
		}
		if (!isConfirmed) {
			calledOnSuccess.current = false;
		}
	}, [isConfirmed, onSuccess]);

	const previewRange: [number, number] = [
		Math.min(muMin, mu - 4 * sigma),
		Math.max(muMax, mu + 4 * sigma),
	];
	const previewMin = previewRange[0];
	const previewMax = previewRange[1];
	const pts = 100;
	const step = (previewMax - previewMin) / (pts - 1);

	const chartData = [];
	for (let i = 0; i < pts; i++) {
		const x = previewMin + step * i;
		let aggY = 0;
		for (const p of existingPositions) {
			aggY += gaussianPdf(x, p.mu, p.sigma);
		}
		const existingAvg =
			existingPositions.length > 0
				? aggY / existingPositions.length
				: 0;
		const userY = gaussianPdf(x, mu, sigma);
		chartData.push({ x, existing: existingAvg, user: userY });
	}

	const handleSubmit = () => {
		if (!account) return;
		const collateralBigInt = BigInt(collateral) * BigInt(1e18);
		open(mu, sigma, collateralBigInt, collateralToken);
	};

	const isBusy = isApproving || isApproveConfirming || isOpening || isOpenConfirming;

	const buttonLabel = isApproving
		? "Approving..."
		: isApproveConfirming
			? "Confirming Approval..."
			: isOpening
				? "Opening Position..."
				: isOpenConfirming
					? "Confirming..."
					: isConfirmed
						? "Position Opened!"
						: !account
							? "Connect Wallet"
							: "Open Position";

	const muFormatted = mu >= 1000 ? mu.toLocaleString() : mu.toString();

	return (
		<div className="rounded-lg border border-border bg-card p-4 space-y-4">
			<h3 className="text-sm font-semibold text-card-foreground">
				Open Position
			</h3>

			<div className="space-y-3">
				<div>
					<div className="flex items-center justify-between mb-1.5">
						<label className="text-xs text-muted-foreground">
							Prediction ({"\u03BC"})
						</label>
						<span className="font-mono text-xs font-medium text-foreground">
							{muFormatted}
						</span>
					</div>
					<input
						type="range"
						min={muMin}
						max={muMax}
						step={rangeSpan > 1000 ? 100 : rangeSpan > 100 ? 10 : 1}
						value={mu}
						onChange={(e) => setMu(Number(e.target.value))}
						className="w-full accent-lilac-500"
					/>
					<div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
						<span className="font-mono">
							{muMin >= 1000 ? muMin.toLocaleString() : muMin}
						</span>
						<span className="font-mono">
							{muMax >= 1000 ? muMax.toLocaleString() : muMax}
						</span>
					</div>
				</div>

				<div>
					<div className="flex items-center justify-between mb-1.5">
						<label className="text-xs text-muted-foreground">
							Confidence Width ({"\u03C3"})
						</label>
						<span className="font-mono text-xs font-medium text-foreground">
							{sigma >= 1000 ? sigma.toLocaleString() : sigma}
						</span>
					</div>
					<input
						type="range"
						min={sigmaMin}
						max={sigmaMax}
						step={sigmaMax > 1000 ? 50 : sigmaMax > 100 ? 5 : 1}
						value={sigma}
						onChange={(e) => setSigma(Number(e.target.value))}
						className="w-full accent-lilac-500"
					/>
					<div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
						<span>High confidence</span>
						<span>Low confidence</span>
					</div>
				</div>

				<div className="rounded-md bg-muted/50 overflow-hidden">
					<ResponsiveContainer width="100%" height={100}>
						<AreaChart
							data={chartData}
							margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
						>
							<Area
								type="monotone"
								dataKey="existing"
								stroke="var(--muted-foreground)"
								fill="var(--muted-foreground)"
								fillOpacity={0.1}
								strokeWidth={1}
								strokeDasharray="4 2"
								dot={false}
								isAnimationActive={false}
							/>
							<Area
								type="monotone"
								dataKey="user"
								stroke="var(--chart-1)"
								fill="var(--chart-1)"
								fillOpacity={0.25}
								strokeWidth={2}
								dot={false}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>

				<div>
					<label className="text-xs text-muted-foreground mb-1.5 block">
						Collateral (tokens)
					</label>
					<div className="relative">
						<input
							type="number"
							min={1}
							value={collateral}
							onChange={(e) =>
								setCollateral(Math.max(1, Number(e.target.value)))
							}
							className={cn(
								"w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono",
								"focus:outline-none focus:ring-2 focus:ring-ring",
							)}
						/>
					</div>
				</div>

				<Button
					className="w-full"
					onClick={handleSubmit}
					disabled={isBusy || !account}
				>
					{buttonLabel}
				</Button>

				{isConfirmed && txHash && (
					<div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-2 text-xs text-emerald-700 dark:text-emerald-400 font-mono break-all">
						Tx: {txHash}
					</div>
				)}

				<div className="rounded-md bg-muted/30 p-3 space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Your prediction</span>
						<span className="font-mono font-medium">{muFormatted}</span>
					</div>
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Confidence range</span>
						<span className="font-mono">
							{(mu - 2 * sigma) >= 1000
								? (mu - 2 * sigma).toLocaleString()
								: (mu - 2 * sigma).toFixed(0)}{" "}
							-{" "}
							{(mu + 2 * sigma) >= 1000
								? (mu + 2 * sigma).toLocaleString()
								: (mu + 2 * sigma).toFixed(0)}
						</span>
					</div>
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Collateral</span>
						<span className="font-mono font-medium">
							{collateral.toLocaleString()} tokens
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
