"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { useCreateMarket } from "@/hooks/use-market";
import { usePrice } from "@/hooks/use-prices";
import { cn } from "@/lib/utils";

const CHAINLINK_FEEDS: Record<string, string> = {
	BTC: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
	ETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
	SOL: "0x4Adc67D868eC7aDC99cfA1d4bC3003647de38483",
};

import { COLLATERAL_TOKEN } from "@/lib/contracts/config";

const CRYPTO_ASSETS = [
	{ symbol: "BTC", name: "Bitcoin", icon: "₿" },
	{ symbol: "ETH", name: "Ethereum", icon: "Ξ" },
	{ symbol: "SOL", name: "Solana", icon: "◎" },
];

const DURATIONS = [
	{ label: "15 min", seconds: 15 * 60 },
	{ label: "1 hour", seconds: 60 * 60 },
	{ label: "24 hours", seconds: 24 * 60 * 60 },
	{ label: "7 days", seconds: 7 * 24 * 60 * 60 },
];

type Mode = "crypto" | "custom";

export default function CreateMarketPage() {
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
	const [ensLabel, setEnsLabel] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [kValue, setKValue] = useState("1");
	const [bValue, setBValue] = useState("1");

	const livePrice = usePrice(mode === "crypto" ? selectedAsset : null);

	const { create, isPending, isConfirming, isConfirmed, txHash, error } =
		useCreateMarket();

	useEffect(() => {
		if (isConfirmed) {
			const timer = setTimeout(() => {
				router.push("/markets");
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [isConfirmed, router]);

	const cryptoQuestion = useMemo(() => {
		const asset = CRYPTO_ASSETS.find((a) => a.symbol === selectedAsset);
		const endTime = new Date(Date.now() + selectedDuration * 1000);
		const fmt = selectedDuration >= 86400
			? endTime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
			: endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
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
	const finalEndTime = mode === "crypto"
		? Math.floor(Date.now() / 1000) + selectedDuration
		: endDate ? Math.floor(new Date(endDate).getTime() / 1000) : 0;

	const inputClasses = cn(
		"w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
		"focus:outline-none focus:ring-2 focus:ring-ring",
		"placeholder:text-muted-foreground",
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		console.log("[Create] Submit clicked");
		console.log("[Create] account:", account);
		console.log("[Create] finalQuestion:", finalQuestion);
		console.log("[Create] finalOracle:", finalOracle);
		console.log("[Create] finalToken:", finalToken);
		console.log("[Create] finalEndTime:", finalEndTime);
		console.log("[Create] finalLabel:", finalLabel);
		console.log("[Create] k:", kValue, "b:", bValue);

		if (!account) {
			console.error("[Create] No wallet connected");
			return;
		}
		if (!finalQuestion || !finalOracle || !finalToken || !finalEndTime || !finalLabel) {
			console.error("[Create] Missing fields:", {
				question: !finalQuestion,
				oracle: !finalOracle,
				token: !finalToken,
				endTime: !finalEndTime,
				label: !finalLabel,
			});
			return;
		}

		const params = {
			label: finalLabel,
			question: finalQuestion,
			oracle: finalOracle as `0x${string}`,
			token: finalToken as `0x${string}`,
			k: Number(kValue),
			b: Number(bValue),
			endTime: finalEndTime,
			category: finalCategory,
		};
		console.log("[Create] Calling create with:", params);
		create(params);
	};

	const isBusy = isPending || isConfirming;
	const buttonLabel = isPending
		? "Creating..."
		: isConfirming
			? "Confirming..."
			: isConfirmed
				? "Market Created!"
				: !account
					? "Connect Wallet"
					: "Create Market";

	return (
		<div className="mx-auto min-w-6xl max-w-6xl border-x border-edge px-4 py-8 md:py-12">
			<div className="mb-8">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">
					Create Market
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Deploy a new distribution prediction market with ENS integration.
				</p>
			</div>

			<div className="flex gap-2 mb-6">
				<button
					type="button"
					onClick={() => setMode("crypto")}
					className={cn(
						"flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
						mode === "crypto"
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:bg-accent",
					)}
				>
					Crypto Price
				</button>
				<button
					type="button"
					onClick={() => setMode("custom")}
					className={cn(
						"flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
						mode === "custom"
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:bg-accent",
					)}
				>
					Custom Market
				</button>
			</div>

			<form onSubmit={handleSubmit} className="space-y-6">
				{mode === "crypto" ? (
					<div className="rounded-lg border border-border bg-card p-6 space-y-5">
						<div>
							<label className="text-sm font-medium text-card-foreground mb-3 block">
								Asset
							</label>
							<div className="grid grid-cols-3 gap-2">
								{CRYPTO_ASSETS.map((asset) => (
									<button
										key={asset.symbol}
										type="button"
										onClick={() => setSelectedAsset(asset.symbol)}
										className={cn(
											"rounded-md border px-3 py-3 text-sm font-medium transition-all",
											"flex flex-col items-center gap-1",
											selectedAsset === asset.symbol
												? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
												: "border-border bg-background text-muted-foreground hover:border-primary/50",
										)}
									>
										<span className="text-lg">{asset.icon}</span>
										<span className="font-mono text-xs">{asset.symbol}</span>
									</button>
								))}
							</div>
						</div>

						{livePrice && (
							<div className="rounded-md bg-muted/50 p-3 flex items-center justify-between">
								<span className="text-xs text-muted-foreground">Current Price</span>
								<div className="flex items-center gap-2">
									<span className="font-mono text-sm font-semibold text-foreground">
										${livePrice.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
									</span>
									<span className={cn(
										"text-xs font-mono",
										livePrice.change24h >= 0 ? "text-green-500" : "text-red-500",
									)}>
										{livePrice.change24h >= 0 ? "+" : ""}{livePrice.change24h.toFixed(2)}%
									</span>
								</div>
							</div>
						)}

						<div>
							<label className="text-sm font-medium text-card-foreground mb-3 block">
								Duration
							</label>
							<div className="grid grid-cols-4 gap-2">
								{DURATIONS.map((d) => (
									<button
										key={d.seconds}
										type="button"
										onClick={() => setSelectedDuration(d.seconds)}
										className={cn(
											"rounded-md border px-2 py-2 text-xs font-medium transition-all",
											selectedDuration === d.seconds
												? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
												: "border-border bg-background text-muted-foreground hover:border-primary/50",
										)}
									>
										{d.label}
									</button>
								))}
							</div>
						</div>
					</div>
				) : (
					<div className="rounded-lg border border-border bg-card p-6 space-y-5">
						<div>
							<label className="text-sm font-medium text-card-foreground mb-1.5 block">
								Question
							</label>
							<input
								type="text"
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								placeholder="How many balls are in the bowl?"
								className={inputClasses}
							/>
						</div>

						<div>
							<label className="text-sm font-medium text-card-foreground mb-1.5 block">
								ENS Label
							</label>
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={ensLabel}
									onChange={(e) => setEnsLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
									placeholder="balls-market"
									className={inputClasses}
								/>
								<span className="text-sm text-muted-foreground whitespace-nowrap">
									.pintel.eth
								</span>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-medium text-card-foreground mb-1.5 block">
									Oracle Address
								</label>
								<input
									type="text"
									value={oracle}
									onChange={(e) => setOracle(e.target.value)}
									placeholder="0x..."
									className={cn(inputClasses, "font-mono text-xs")}
								/>
							</div>
							<div>
								<label className="text-sm font-medium text-card-foreground mb-1.5 block">
									Collateral Token
								</label>
								<input
									type="text"
									value={token}
									onChange={(e) => setToken(e.target.value)}
									placeholder="0x..."
									className={cn(inputClasses, "font-mono text-xs")}
								/>
							</div>
						</div>

						<div>
							<label className="text-sm font-medium text-card-foreground mb-1.5 block">
								End Time
							</label>
							<input
								type="datetime-local"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								className={inputClasses}
							/>
						</div>
					</div>
				)}

				<button
					type="button"
					onClick={() => setShowAdvanced(!showAdvanced)}
					className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
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
					<div className="rounded-lg border border-border bg-card p-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-xs font-medium text-card-foreground mb-1 block">
									k (scaling factor)
								</label>
								<input
									type="number"
									value={kValue}
									onChange={(e) => setKValue(e.target.value)}
									className={cn(inputClasses, "font-mono")}
								/>
								<p className="text-[10px] text-muted-foreground mt-1">
									Controls the curve shape
								</p>
							</div>
							<div>
								<label className="text-xs font-medium text-card-foreground mb-1 block">
									b (peak backing)
								</label>
								<input
									type="number"
									value={bValue}
									onChange={(e) => setBValue(e.target.value)}
									className={cn(inputClasses, "font-mono")}
								/>
								<p className="text-[10px] text-muted-foreground mt-1">
									Max allowed peak value
								</p>
							</div>
						</div>
					</div>
				)}

				<div className="rounded-lg border border-border bg-card p-4">
					<h3 className="text-sm font-semibold text-card-foreground mb-3">
						Preview
					</h3>
					<div className="space-y-2 text-xs">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Question</span>
							<span className="font-medium text-foreground max-w-[60%] text-right">
								{finalQuestion || "---"}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Category</span>
							<span className="font-medium">{finalCategory}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">ENS Name</span>
							<span className="font-mono">
								{finalLabel ? `${finalLabel}.pintel.eth` : "---"}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Ends</span>
							<span className="font-mono">
								{finalEndTime > 0
									? new Date(finalEndTime * 1000).toLocaleString()
									: "---"}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Parameters</span>
							<span className="font-mono">
								k={kValue}, b={bValue}
							</span>
						</div>
					</div>
				</div>

				{error && (
					<div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
						<p className="font-medium">Transaction failed</p>
						<p className="text-xs mt-1 break-all font-mono">{error.message}</p>
					</div>
				)}

				{isConfirmed && txHash && (
					<div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-700 dark:text-emerald-400">
						Market created successfully! Redirecting...
						<div className="font-mono text-xs mt-1 break-all">
							Tx: {txHash}
						</div>
					</div>
				)}

				<Button
					type="submit"
					className="w-full"
					size="lg"
					disabled={isBusy || !account}
				>
					{buttonLabel}
				</Button>
			</form>
		</div>
	);
}
