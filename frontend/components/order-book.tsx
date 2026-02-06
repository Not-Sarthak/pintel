"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useYellowContext } from "@/components/providers/yellow-provider";
import { useTransferPosition } from "@/hooks/use-market";
import { formatAddress } from "@/lib/gaussian";
import { cn } from "@/lib/utils";
import type { PositionData } from "@/hooks/use-market";
import type { AskOrder } from "@/lib/yellow-types";

interface OrderBookProps {
	marketAddress: `0x${string}`;
	positions?: PositionData[];
	onTxSuccess?: () => void;
}

function timeAgo(ts: number): string {
	const diff = (Date.now() - ts) / 1000;
	if (diff < 5) return "just now";
	if (diff < 60) return `${Math.floor(diff)}s ago`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	return `${Math.floor(diff / 3600)}h ago`;
}

export function OrderBook({ marketAddress, positions = [], onTxSuccess }: OrderBookProps) {
	const { address: account } = useAccount();
	const yellow = useYellowContext();
	const {
		transferPosition,
		isPending: isTransferring,
		isConfirming: isTransferConfirming,
		isConfirmed: isTransferConfirmed,
	} = useTransferPosition(marketAddress);

	const [enabled, setEnabled] = useState(false);
	const [askPrice, setAskPrice] = useState("");
	const [sellPositionId, setSellPositionId] = useState<number | null>(null);
	const [posting, setPosting] = useState(false);
	const [buying, setBuying] = useState<number | null>(null);
	const [chatInput, setChatInput] = useState("");
	const [faucetLoading, setFaucetLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const chatEndRef = useRef<HTMLDivElement>(null);

	// Tick every 5s to expire old fills from display
	const [, setTick] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setTick((c) => c + 1), 5_000);
		return () => clearInterval(t);
	}, []);

	// Only join market session when user clicks "Enable Yellow"
	useEffect(() => {
		if (!enabled || !account) return;
		yellow.joinMarket(marketAddress);
		return () => {
			yellow.leaveMarket(marketAddress);
		};
	}, [enabled, account, marketAddress]); // eslint-disable-line react-hooks/exhaustive-deps

	// Get market-scoped state
	const asks = yellow.getAsks(marketAddress);
	const fills = yellow.getFills(marketAddress);
	const chatMessages = yellow.getChat(marketAddress);
	const onlineTraders = yellow.getOnlineTraders(marketAddress);

	const usdBalance = yellow.balances.find((b) => b.asset === "ytest.usd");

	const myPositions = positions.filter(
		(p) => p.active && account && p.owner.toLowerCase() === account.toLowerCase(),
	);
	const selectedPosition = myPositions.find((p) => p.id === sellPositionId);

	// All asks sorted by price descending (highest at top like exchange)
	const allAsks = [...asks].sort((a, b) => Number(b.price) - Number(a.price));
	// Incoming asks only (for buy buttons)
	const incomingAsks = asks.filter(
		(a) => account && a.from.toLowerCase() !== account.toLowerCase(),
	);
	// My asks
	const myAsks = asks.filter(
		(a) => account && a.from.toLowerCase() === account.toLowerCase(),
	);

	// Track pending auto-transfers
	const pendingTransfers = useRef<Map<number, string>>(new Map());

	useEffect(() => {
		if (isTransferConfirmed && pendingTransfers.current.size > 0) {
			toast.success("Position transferred on-chain!");
			pendingTransfers.current.clear();
			onTxSuccess?.();
		}
	}, [isTransferConfirmed, onTxSuccess]);

	// Also clear fills immediately when on-chain transfer is confirmed (seller side)
	useEffect(() => {
		if (isTransferConfirmed) {
			setTick((c) => c + 1); // force re-render to drop expired fills
		}
	}, [isTransferConfirmed]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatMessages.length]);

	const handlePostAsk = async () => {
		if (!selectedPosition || !askPrice) return;
		setPosting(true);
		try {
			await yellow.postAsk(marketAddress, {
				positionId: selectedPosition.id,
				price: askPrice,
				mu: selectedPosition.mu,
				sigma: selectedPosition.sigma,
				collateral: (Number(selectedPosition.collateral) / 1e18).toFixed(0),
			});
			toast.success("Ask posted to order book!");
			setSellPositionId(null);
			setAskPrice("");
		} catch (err) {
			console.error("[OrderBook] Post ask failed:", err);
			toast.error("Failed to post ask");
		} finally {
			setPosting(false);
		}
	};

	const handleBuy = useCallback(async (ask: AskOrder) => {
		setBuying(ask.positionId);
		try {
			await yellow.transfer(ask.from as `0x${string}`, ask.price);
			toast.success("Payment sent! Waiting for position transfer...");
			await yellow.broadcastFill(marketAddress, {
				positionId: ask.positionId,
				price: ask.price,
				buyer: account!,
				seller: ask.from,
			});
		} catch (err) {
			console.error("[OrderBook] Buy failed:", err);
			toast.error("Buy failed");
		} finally {
			setBuying(null);
		}
	}, [yellow, marketAddress, account]);

	// Auto-transfer on fill
	useEffect(() => {
		if (!account) return;
		for (const fill of fills) {
			if (
				fill.seller.toLowerCase() === account.toLowerCase() &&
				!pendingTransfers.current.has(fill.positionId)
			) {
				const pos = myPositions.find((p) => p.id === fill.positionId);
				if (pos) {
					pendingTransfers.current.set(fill.positionId, fill.buyer);
					transferPosition(fill.positionId, fill.buyer as `0x${string}`);
					toast.info(`Auto-transferring position #${fill.positionId} on-chain...`);
				}
			}
		}
	}, [fills, account, myPositions, transferPosition]);

	const handleChat = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!chatInput.trim()) return;
		try {
			await yellow.sendChat(marketAddress, chatInput.trim());
			setChatInput("");
		} catch {
			toast.error("Failed to send message");
		}
	};

	const handleFaucet = async () => {
		setFaucetLoading(true);
		try {
			await yellow.requestFaucet();
			toast.success("Tokens requested!");
		} finally {
			setFaucetLoading(false);
		}
	};

	const handleEnable = () => {
		setEnabled(true);
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await yellow.refreshMarket(marketAddress);
			toast.success("Order book refreshed");
		} catch {
			toast.error("Refresh failed");
		} finally {
			setRefreshing(false);
		}
	};

	// Compute cumulative totals for depth bars
	const asksCumulative = (() => {
		// Sort ascending for cumulative (bottom ask = smallest price, top = largest)
		const sorted = [...allAsks].sort((a, b) => Number(a.price) - Number(b.price));
		let total = 0;
		const result = sorted.map((a) => {
			total += Number(a.collateral);
			return { ...a, cumTotal: total };
		});
		// Reverse back to descending for display
		return result.reverse();
	})();

	// Only show fills from the last 30s in the green rows; older ones auto-expire
	const FILL_DISPLAY_MS = 30_000;
	const recentFills = fills.filter((f) => Date.now() - f.ts < FILL_DISPLAY_MS);

	const fillsCumulative = (() => {
		const sorted = [...recentFills].sort((a, b) => Number(b.price) - Number(a.price));
		let total = 0;
		return sorted.map((f) => {
			total += Number(f.price);
			return { ...f, cumTotal: total };
		});
	})();

	const maxAskTotal = asksCumulative.length > 0 ? Math.max(...asksCumulative.map((a) => a.cumTotal)) : 1;
	const maxFillTotal = fillsCumulative.length > 0 ? Math.max(...fillsCumulative.map((f) => f.cumTotal)) : 1;

	// ── NOT ENABLED: show "Enable Yellow" button ──
	if (!account) {
		return (
			<div className="rounded-lg border border-border bg-card p-4">
				<h3 className="text-sm font-semibold text-card-foreground mb-2">Order Book</h3>
				<p className="text-xs text-muted-foreground">Connect your wallet to join the live trading floor.</p>
			</div>
		);
	}

	if (!enabled) {
		return (
			<div className="rounded-lg border border-border bg-card overflow-hidden">
				<div className="p-3 border-b border-border">
					<h3 className="text-sm font-semibold text-card-foreground">Order Book</h3>
				</div>
				<div className="p-4 space-y-3">
					<div className="rounded-md bg-muted/30 p-3 space-y-2">
						<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Real-time P2P Trading</p>
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							Trade positions <strong className="text-foreground">instantly</strong> with other users via <strong className="text-foreground">Yellow Network</strong> state channels. Zero gas, millisecond settlement.
						</p>
					</div>
					<Button
						onClick={handleEnable}
						size="sm"
						className="w-full"
					>
						Enable Yellow Network
					</Button>
				</div>
			</div>
		);
	}

	if (!yellow.isAuthenticated) {
		return (
			<div className="rounded-lg border border-border bg-card overflow-hidden">
				<div className="p-3 border-b border-border">
					<h3 className="text-sm font-semibold text-card-foreground">Order Book</h3>
				</div>
				<div className="p-4 space-y-2">
					<div className="flex items-center gap-2">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
						</span>
						<p className="text-xs text-muted-foreground">
							{yellow.isConnecting ? "Connecting to Yellow Network..." : "Sign the wallet prompt to authenticate..."}
						</p>
					</div>
					{yellow.error && (
						<div className="space-y-2">
							<p className="text-xs text-red-500">{yellow.error}</p>
							<Button
								onClick={() => { setEnabled(false); setTimeout(() => setEnabled(true), 100); }}
								size="sm"
								variant="outline"
								className="text-xs w-full"
							>
								Retry Connection
							</Button>
						</div>
					)}
				</div>
			</div>
		);
	}

	// ── MAIN ORDER BOOK ──
	return (
		<div className="rounded-lg border border-border bg-card overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b border-border">
				<div className="flex items-center gap-2">
					<span className="relative flex h-2 w-2">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
						<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
					</span>
					<h3 className="text-sm font-semibold text-card-foreground">Order Book</h3>
					{onlineTraders.length > 0 && (
						<span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded font-medium">
							{onlineTraders.length} online
						</span>
					)}
					<button
						type="button"
						onClick={handleRefresh}
						disabled={refreshing}
						className={cn(
							"text-xs text-muted-foreground hover:text-foreground transition-colors",
							refreshing && "animate-spin",
						)}
						title="Refresh order book"
					>
						&#8635;
					</button>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="font-mono text-xs font-semibold text-foreground">
						{usdBalance ? usdBalance.amount : "0"}
					</span>
					<span className="text-[10px] text-muted-foreground">ytest.usd</span>
					<button type="button" onClick={() => yellow.refreshBalance()} className="text-[10px] text-muted-foreground hover:text-foreground ml-0.5">&#8635;</button>
					{!usdBalance && (
						<button type="button" onClick={handleFaucet} disabled={faucetLoading} className="text-[10px] text-lilac-500 hover:text-lilac-600 font-medium ml-1">
							{faucetLoading ? "..." : "Get tokens"}
						</button>
					)}
				</div>
			</div>

			{/* ── EXCHANGE-STYLE ORDER BOOK ── */}
			<div className="font-mono text-[11px]">
				{/* Column headers */}
				<div className="grid grid-cols-4 px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border/50">
					<span>Price</span>
					<span className="text-right">Size</span>
					<span className="text-right">Total</span>
					<span className="text-right">Action</span>
				</div>

				{/* ASKS (sell side) — red, sorted price descending */}
				<div className="relative">
					{asksCumulative.length === 0 ? (
						<div className="px-3 py-4 text-center text-[10px] text-muted-foreground">
							No asks — list a position below
						</div>
					) : (
						asksCumulative.map((ask) => {
							const depthPct = (ask.cumTotal / maxAskTotal) * 100;
							const isOwn = account && ask.from.toLowerCase() === account.toLowerCase();
							const canBuy = !isOwn;
							return (
								<div
									key={`${ask.positionId}-${ask.from}-${ask.ts}`}
									className="relative grid grid-cols-4 items-center px-3 py-1 hover:bg-red-500/5 transition-colors group"
								>
									{/* Depth bar */}
									<div
										className="absolute right-0 top-0 bottom-0 bg-red-500/10 dark:bg-red-500/15 pointer-events-none"
										style={{ width: `${depthPct}%` }}
									/>
									<span className="relative text-red-500 dark:text-red-400 font-medium">
										{Number(ask.price).toFixed(2)}
									</span>
									<span className="relative text-right text-foreground" title={`#${ask.positionId} ${formatAddress(ask.from)}`}>
										{ask.collateral}
									</span>
									<span className="relative text-right text-foreground">
										{ask.cumTotal.toFixed(0)}
									</span>
									<span className="relative text-right">
										{canBuy ? (
											<button
												type="button"
												onClick={() => handleBuy(ask)}
												disabled={buying !== null}
												className="text-[10px] font-semibold text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
											>
												{buying === ask.positionId ? "..." : "Buy"}
											</button>
										) : (
											<span className="text-[10px] text-muted-foreground">you</span>
										)}
									</span>
								</div>
							);
						})
					)}
				</div>

				{/* ── SPREAD / MID ── */}
				<div className="px-3 py-1.5 border-y border-border/50 flex items-center gap-2">
					{fills.length > 0 ? (
						<>
							<span className="text-sm font-bold text-foreground">
								{Number(fills[0].price).toFixed(2)}
							</span>
							<span className="text-[10px] text-muted-foreground">
								last trade
							</span>
						</>
					) : allAsks.length > 0 ? (
						<>
							<span className="text-sm font-bold text-foreground">
								{Number(allAsks[allAsks.length - 1].price).toFixed(2)}
							</span>
							<span className="text-[10px] text-muted-foreground">
								best ask
							</span>
						</>
					) : (
						<span className="text-[10px] text-muted-foreground">No trades yet</span>
					)}
				</div>

				{/* RECENT FILLS (buy side) — green, most recent first */}
				<div className="relative">
					{fillsCumulative.length === 0 ? (
						<div className="px-3 py-4 text-center text-[10px] text-muted-foreground">
							No trades yet
						</div>
					) : (
						fillsCumulative.slice(0, 10).map((fill) => {
							const depthPct = (fill.cumTotal / maxFillTotal) * 100;
							return (
								<div
									key={`${fill.positionId}-${fill.ts}`}
									className="relative grid grid-cols-4 items-center px-3 py-1"
								>
									<div
										className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 dark:bg-emerald-500/15 pointer-events-none"
										style={{ width: `${depthPct}%` }}
									/>
									<span className="relative text-emerald-500 dark:text-emerald-400 font-medium">
										{Number(fill.price).toFixed(2)}
									</span>
									<span className="relative text-right text-foreground">
										#{fill.positionId}
									</span>
									<span className="relative text-right text-foreground">
										{fill.cumTotal.toFixed(0)}
									</span>
									<span className="relative text-right text-[10px] text-muted-foreground">
										{timeAgo(fill.ts)}
									</span>
								</div>
							);
						})
					)}
				</div>
			</div>

			{/* ── ACTIONS BELOW BOOK ── */}
			<div className="border-t border-border p-3 space-y-3">
				{/* Post Ask — only show if user has positions */}
				{myPositions.length > 0 && (
					<div className="space-y-2">
						<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
							Sell Position
						</p>
						<div className="flex gap-2">
							<select
								value={sellPositionId ?? ""}
								onChange={(e) => setSellPositionId(e.target.value ? Number(e.target.value) : null)}
								className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
							>
								<option value="">Position...</option>
								{myPositions.map((p) => (
									<option key={p.id} value={p.id}>
										#{p.id} {"\u03BC"}={p.mu.toLocaleString(undefined, { maximumFractionDigits: 0 })}
									</option>
								))}
							</select>
							<div className="relative w-24">
								<input
									type="text"
									placeholder="Price"
									value={askPrice}
									onChange={(e) => setAskPrice(e.target.value)}
									className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							</div>
							<Button
								onClick={handlePostAsk}
								disabled={posting || !askPrice || sellPositionId === null}
								size="sm"
								variant="destructive"
								className="text-xs h-auto px-3"
							>
								{posting ? "..." : "Ask"}
							</Button>
						</div>
						{selectedPosition && (
							<div className="grid grid-cols-3 gap-2 text-center text-[10px] rounded bg-muted/30 p-1.5">
								<div>
									<span className="font-mono font-semibold text-foreground">{selectedPosition.mu.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
									<span className="text-muted-foreground ml-0.5">{"\u03BC"}</span>
								</div>
								<div>
									<span className="font-mono font-semibold text-foreground">{selectedPosition.sigma.toFixed(0)}</span>
									<span className="text-muted-foreground ml-0.5">{"\u03C3"}</span>
								</div>
								<div>
									<span className="font-mono font-semibold text-foreground">{(Number(selectedPosition.collateral) / 1e18).toFixed(0)}</span>
									<span className="text-muted-foreground ml-0.5">col</span>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Auto-transfer indicator */}
				{(isTransferring || isTransferConfirming) && (
					<div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-2 flex items-center gap-2">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
						</span>
						<span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
							{isTransferring ? "Transferring position on-chain..." : "Confirming on-chain..."}
						</span>
					</div>
				)}

				{/* Chat */}
				<div className="space-y-1.5">
					<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
						Chat
					</p>
					<div className="rounded-md border border-border bg-background p-2 max-h-24 overflow-y-auto space-y-0.5">
						{chatMessages.length === 0 && (
							<p className="text-[10px] text-muted-foreground text-center py-1">No messages</p>
						)}
						{chatMessages.map((msg, i) => (
							<div key={`${msg.from}-${msg.ts}-${i}`} className="text-[10px]">
								<span className="font-mono font-medium text-lilac-600 dark:text-lilac-400">
									{formatAddress(msg.from)}
								</span>
								<span className="text-muted-foreground">: </span>
								<span className="text-foreground">{msg.text}</span>
							</div>
						))}
						<div ref={chatEndRef} />
					</div>
					<form onSubmit={handleChat} className="flex gap-1.5">
						<input
							type="text"
							placeholder="Message..."
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						<Button type="submit" size="sm" variant="outline" className="text-xs h-7 px-2">
							Send
						</Button>
					</form>
				</div>

				{/* Get tokens */}
				<Button onClick={handleFaucet} disabled={faucetLoading} size="sm" variant="ghost" className="w-full text-[10px] h-6">
					{faucetLoading ? "Requesting..." : "+ Get Test Tokens"}
				</Button>
			</div>

			{yellow.error && (
				<div className="px-3 pb-3">
					<p className="text-xs text-red-500">{yellow.error}</p>
				</div>
			)}
		</div>
	);
}
