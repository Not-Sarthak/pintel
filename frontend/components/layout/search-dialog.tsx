"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAllMarkets, useMarket } from "@/hooks/use-market";
import { formatAddress } from "@/lib/gaussian";
import { cn } from "@/lib/utils";

function MarketResult({
	address,
	query,
	selected,
	onSelect,
}: {
	address: `0x${string}`;
	query: string;
	selected: boolean;
	onSelect: () => void;
}) {
	const { market, isLoading } = useMarket(address);

	if (isLoading) {
		return (
			<div className="flex items-center gap-3 px-3 py-3">
				<div className="h-4 w-full animate-pulse rounded bg-muted" />
			</div>
		);
	}

	if (!market) return null;

	const q = query.toLowerCase();
	if (q && !market.question.toLowerCase().includes(q) && !address.toLowerCase().includes(q)) {
		return null;
	}

	const now = Date.now() / 1000;
	const ended = now >= market.endTime;
	const status = market.resolved ? "Resolved" : ended ? "Ending" : "Active";
	const totalPool = (Number(market.totalPool) / 1e18).toFixed(2);

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors",
				selected
					? "bg-accent text-accent-foreground"
					: "hover:bg-muted/50",
			)}
		>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium text-foreground">
					{market.question}
				</p>
				<p className="mt-0.5 text-xs text-muted-foreground">
					{formatAddress(address)}
				</p>
			</div>
			<div className="flex shrink-0 flex-col items-end gap-0.5">
				<span
					className={cn(
						"text-xs font-medium",
						market.resolved
							? "text-emerald-500"
							: ended
								? "text-amber-500"
								: "text-muted-foreground",
					)}
				>
					{status}
				</span>
				<span className="text-xs text-muted-foreground">
					{totalPool} USDC
				</span>
			</div>
		</button>
	);
}

export function SearchDialog({ externalOpen, onClose }: { externalOpen?: boolean; onClose?: () => void } = {}) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = externalOpen ?? internalOpen;
	const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
		const val = typeof v === "function" ? v(open) : v;
		setInternalOpen(val);
		if (!val) onClose?.();
	};
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const { markets } = useAllMarkets();

	const close = useCallback(() => {
		setOpen(false);
		setQuery("");
		setSelectedIndex(0);
	}, []);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
			if (e.key === "Escape") {
				close();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [close]);

	useEffect(() => {
		if (externalOpen) setInternalOpen(true);
	}, [externalOpen]);

	useEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [open]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	const navigateToMarket = useCallback(
		(address: string) => {
			close();
			router.push(`/market/${address}`);
		},
		[close, router],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.min(prev + 1, markets.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (markets[selectedIndex]) {
					navigateToMarket(markets[selectedIndex]);
				}
			}
		},
		[markets, selectedIndex, navigateToMarket],
	);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[100]">
			<div
				className="fixed inset-0 bg-black/50 backdrop-blur-sm"
				onClick={close}
			/>

			<div className="fixed left-1/2 top-[15%] w-full max-w-xl -translate-x-1/2">
				<div className="mx-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
					<div className="flex items-center gap-3 border-b border-border px-4">
						<svg
							className="h-4 w-4 shrink-0 text-muted-foreground"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							ref={inputRef}
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="btc-markets.pintel.eth"
							className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
						/>
						<kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">
							ESC
						</kbd>
					</div>

					<div className="max-h-[60vh] overflow-y-auto p-2">
						{markets.length === 0 ? (
							<div className="px-3 py-8 text-center text-sm text-muted-foreground">
								No markets found.
							</div>
						) : (
							<div>
								<p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Markets
								</p>
								{markets.map((addr, i) => (
									<MarketResult
										key={addr}
										address={addr}
										query={query}
										selected={i === selectedIndex}
										onSelect={() => navigateToMarket(addr)}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="hidden sm:flex h-9 w-64 cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/50 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
		>
			<svg
				className="h-3.5 w-3.5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<span className="flex-1 text-left">Search</span>
			<kbd className="inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px]">
				&#8984;K
			</kbd>
		</button>
	);
}
