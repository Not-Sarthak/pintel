"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { useCreateMarket } from "@/hooks/use-market";
import { usePrice } from "@/hooks/use-prices";
import { cn } from "@/lib/utils";
import { COLLATERAL_TOKEN } from "@/lib/contracts/config";

const INTER = { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' } as const;

const CHAINLINK_FEEDS: Record<string, string> = {
	BTC: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
	ETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
	SOL: "0x4Adc67D868eC7aDC99cfA1d4bC3003647de38483",
};

const CRYPTO_ASSETS = [
	{ symbol: "BTC", name: "Bitcoin", logo: "/images/logos/btc.png" },
	{ symbol: "ETH", name: "Ethereum", logo: "/images/logos/eth.png" },
	{ symbol: "SOL", name: "Solana", logo: "/images/logos/solana.png" },
];

const DURATIONS = [
	{ label: "15 min", seconds: 15 * 60 },
	{ label: "1 hour", seconds: 60 * 60 },
	{ label: "24 hours", seconds: 24 * 60 * 60 },
	{ label: "7 days", seconds: 7 * 24 * 60 * 60 },
];

export const OWNER_ADDRESS = "0x880477863CA2B34269DE917aEBe3FDCA860655e3";

type Mode = "crypto" | "custom";

export function CreateMarketModal({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const router = useRouter();
	const { address: account } = useAccount();

	const [mode, setMode] = useState<Mode>("crypto");
	const [selectedAsset, setSelectedAsset] = useState("BTC");
	const [selectedDuration, setSelectedDuration] = useState(DURATIONS[2].seconds);

	const [question, setQuestion] = useState("");
	const [category, setCategory] = useState("Custom");
	const [oracle, setOracle] = useState("");
	const [token, setToken] = useState<string>(COLLATERAL_TOKEN);
	const [endDate, setEndDate] = useState("");
	const [endTime, setEndTime] = useState("");
	const [ensLabel, setEnsLabel] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [kValue, setKValue] = useState("1");
	const [bValue, setBValue] = useState("1");

	const livePrice = usePrice(mode === "crypto" ? selectedAsset : null);

	const { create, isPending, isConfirming, isConfirmed, txHash, error } =
		useCreateMarket();

	const close = useCallback(() => {
		onClose();
	}, [onClose]);

	useEffect(() => {
		if (isConfirmed) {
			const timer = setTimeout(() => {
				close();
				router.push("/markets");
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [isConfirmed, router, close]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") close();
		}
		if (open) {
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}
	}, [open, close]);

	const cryptoQuestion = useMemo(() => {
		const asset = CRYPTO_ASSETS.find((a) => a.symbol === selectedAsset);
		const end = new Date(Date.now() + selectedDuration * 1000);
		const fmt =
			selectedDuration >= 86400
				? end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
				: end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
		return `What will ${asset?.name} (${selectedAsset}) price be at ${fmt}?`;
	}, [selectedAsset, selectedDuration]);

	const cryptoEnsLabel = useMemo(() => {
		const ts = Math.floor(Date.now() / 1000);
		return `${selectedAsset.toLowerCase()}-${ts}`;
	}, [selectedAsset]);

	const finalQuestion = mode === "crypto" ? cryptoQuestion : question;
	const finalCategory = mode === "crypto" ? "Crypto" : category;
	const finalOracle = mode === "crypto" ? CHAINLINK_FEEDS[selectedAsset] : oracle;
	const finalToken = mode === "crypto" ? COLLATERAL_TOKEN : token;
	const finalLabel = mode === "crypto" ? cryptoEnsLabel : ensLabel;
	const finalEndTime =
		mode === "crypto"
			? Math.floor(Date.now() / 1000) + selectedDuration
			: endDate && endTime
				? Math.floor(new Date(`${endDate}T${endTime}`).getTime() / 1000)
				: endDate
					? Math.floor(new Date(endDate).getTime() / 1000)
					: 0;

	const inputClasses = cn(
		"w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
		"focus:outline-none focus:ring-2 focus:ring-ring",
		"placeholder:text-muted-foreground",
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!account) return;
		if (!finalQuestion || !finalOracle || !finalToken || !finalEndTime || !finalLabel) return;

		create({
			label: finalLabel,
			question: finalQuestion,
			oracle: finalOracle as `0x${string}`,
			token: finalToken as `0x${string}`,
			k: Number(kValue),
			b: Number(bValue),
			endTime: finalEndTime,
			category: finalCategory,
		});
	};

	const isBusy = isPending || isConfirming;
	const buttonLabel = isPending
		? "Creating..."
		: isConfirming
			? "Confirming..."
			: isConfirmed
				? "Market Created!"
				: "Create Market";

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[100]" style={INTER}>
			<div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

			<div className="fixed inset-0 flex items-center justify-center p-4">
				<div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
					<div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4 rounded-t-xl">
						<h2 className="text-base text-foreground">Create Market</h2>
						<button
							type="button"
							onClick={close}
							className="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
						>
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form onSubmit={handleSubmit} className="p-5 space-y-5">
						{/* Mode toggle */}
						<div className="flex gap-1.5 rounded-lg bg-muted p-1">
							<button
								type="button"
								onClick={() => setMode("crypto")}
								className={cn(
									"flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs transition-colors",
									mode === "crypto"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Crypto Price
							</button>
							<button
								type="button"
								onClick={() => setMode("custom")}
								className={cn(
									"flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs transition-colors",
									mode === "custom"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Custom
							</button>
						</div>

						{mode === "crypto" ? (
							<div className="space-y-4">
								<div>
									<label className="text-xs text-muted-foreground mb-2 block">Asset</label>
									<div className="grid grid-cols-3 gap-2">
										{CRYPTO_ASSETS.map((asset) => (
											<button
												key={asset.symbol}
												type="button"
												onClick={() => setSelectedAsset(asset.symbol)}
												className={cn(
													"cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-all",
													"flex items-center justify-center gap-2",
													selectedAsset === asset.symbol
														? "border-foreground bg-foreground/5 text-foreground"
														: "border-border text-muted-foreground hover:border-foreground/30",
												)}
											>
												<img src={asset.logo} alt={asset.name} className="h-5 w-5 rounded-full" />
												<span className="text-xs">{asset.symbol}</span>
											</button>
										))}
									</div>
								</div>

								{livePrice && (
									<div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
										<span className="text-xs text-muted-foreground">Current Price</span>
										<div className="flex items-center gap-2">
											<span className="text-sm text-foreground">
												${livePrice.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
											</span>
											<span className={cn("text-xs", livePrice.change24h >= 0 ? "text-green-500" : "text-red-500")}>
												{livePrice.change24h >= 0 ? "+" : ""}{livePrice.change24h.toFixed(2)}%
											</span>
										</div>
									</div>
								)}

								<div>
									<label className="text-xs text-muted-foreground mb-2 block">Duration</label>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
										{DURATIONS.map((d) => (
											<button
												key={d.seconds}
												type="button"
												onClick={() => setSelectedDuration(d.seconds)}
												className={cn(
													"cursor-pointer rounded-lg border px-2 py-2 text-xs transition-all",
													selectedDuration === d.seconds
														? "border-foreground bg-foreground/5 text-foreground"
														: "border-border text-muted-foreground hover:border-foreground/30",
												)}
											>
												{d.label}
											</button>
										))}
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								<div>
									<label className="text-xs text-muted-foreground mb-1.5 block">Question</label>
									<input
										type="text"
										value={question}
										onChange={(e) => setQuestion(e.target.value)}
										placeholder="How many balls are in the bowl?"
										className={inputClasses}
									/>
								</div>

								<div>
									<label className="text-xs text-muted-foreground mb-1.5 block">ENS Label</label>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={ensLabel}
											onChange={(e) => setEnsLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
											placeholder="balls-market"
											className={inputClasses}
										/>
										<span className="text-xs text-muted-foreground whitespace-nowrap">.pintel.eth</span>
									</div>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div>
										<label className="text-xs text-muted-foreground mb-1.5 block">Oracle Address</label>
										<input
											type="text"
											value={oracle}
											onChange={(e) => setOracle(e.target.value)}
											placeholder="0x..."
											className={cn(inputClasses, "text-xs")}
										/>
									</div>
									<div>
										<label className="text-xs text-muted-foreground mb-1.5 block">Collateral Token</label>
										<input
											type="text"
											value={token}
											onChange={(e) => setToken(e.target.value)}
											placeholder="0x..."
											className={cn(inputClasses, "text-xs")}
										/>
									</div>
								</div>

								<div>
									<label className="text-xs text-muted-foreground mb-1.5 block">End Date & Time</label>
									<div className="grid grid-cols-2 gap-2">
										<input
											type="date"
											value={endDate}
											onChange={(e) => setEndDate(e.target.value)}
											className={cn(inputClasses, "cursor-pointer")}
										/>
										<input
											type="time"
											value={endTime}
											onChange={(e) => setEndTime(e.target.value)}
											className={cn(inputClasses, "cursor-pointer")}
										/>
									</div>
								</div>
							</div>
						)}

						{/* Advanced options */}
						<button
							type="button"
							onClick={() => setShowAdvanced(!showAdvanced)}
							className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
						>
							<svg
								className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90")}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
							</svg>
							Advanced Parameters
						</button>

						{showAdvanced && (
							<div className="rounded-lg border border-border p-4 space-y-3">
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="text-xs text-muted-foreground mb-1 block">
											k (scaling factor)
										</label>
										<input
											type="number"
											value={kValue}
											onChange={(e) => setKValue(e.target.value)}
											className={inputClasses}
										/>
										<p className="text-[10px] text-muted-foreground mt-1">Controls the curve shape</p>
									</div>
									<div>
										<label className="text-xs text-muted-foreground mb-1 block">
											b (peak backing)
										</label>
										<input
											type="number"
											value={bValue}
											onChange={(e) => setBValue(e.target.value)}
											className={inputClasses}
										/>
										<p className="text-[10px] text-muted-foreground mt-1">Max allowed peak value</p>
									</div>
								</div>
							</div>
						)}

						{/* ENS Preview */}
						<div className="rounded-lg border border-lilac-500/30 bg-lilac-500/5 px-3 py-2.5 flex items-center gap-2">
							<svg className="h-4 w-4 text-lilac-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9 9 0 013 12c0-1.605.42-3.113 1.157-4.418" />
							</svg>
							<span className="text-sm text-foreground truncate">
								{finalLabel ? finalLabel : <span className="text-muted-foreground">&lt;label&gt;</span>}<span className="text-lilac-500">.pintel.eth</span>
							</span>
						</div>

						{/* Summary */}
						<div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Question</span>
								<span className="text-foreground max-w-[60%] text-right truncate">
									{finalQuestion || "---"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Ends</span>
								<span>{finalEndTime > 0 ? new Date(finalEndTime * 1000).toLocaleString() : "---"}</span>
							</div>
							{showAdvanced && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Parameters</span>
									<span>k={kValue}, b={bValue}</span>
								</div>
							)}
						</div>

						{error && (
							<div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-400">
								<p>Transaction failed</p>
								<p className="mt-1 break-all">{error.message}</p>
							</div>
						)}

						{isConfirmed && txHash && (
							<div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-3 text-xs text-emerald-700 dark:text-emerald-400">
								Market created! Redirecting...
							</div>
						)}

						<Button type="submit" className="w-full cursor-pointer" disabled={isBusy || !account}>
							{buttonLabel}
						</Button>
					</form>
				</div>
			</div>
		</div>
	);
}
