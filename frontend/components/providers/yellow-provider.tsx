"use client";

import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toast } from "sonner";
import { YellowChannel, createYellowChannel } from "@/lib/yellow";
import type { Address } from "viem";
import type {
	AskOrder,
	FillEvent,
	ChatMessage,
	OrderMessage,
} from "@/lib/yellow-types";

interface LedgerBalance {
	asset: string;
	amount: string;
}

interface YellowContextValue {
	isConnected: boolean;
	isAuthenticated: boolean;
	isConnecting: boolean;
	balances: LedgerBalance[];
	error: string | null;

	getAsks: (market: string) => AskOrder[];
	getFills: (market: string) => FillEvent[];
	getChat: (market: string) => ChatMessage[];
	getOnlineTraders: (market: string) => string[];

	joinMarket: (marketAddress: string) => Promise<void>;
	leaveMarket: (marketAddress: string) => void;
	postAsk: (marketAddress: string, ask: Omit<AskOrder, "from" | "ts">) => Promise<void>;
	cancelAsk: (marketAddress: string, positionId: number) => Promise<void>;
	broadcastFill: (marketAddress: string, fill: Omit<FillEvent, "ts">) => Promise<void>;
	sendChat: (marketAddress: string, text: string) => Promise<void>;
	transfer: (destination: Address, amount: string) => Promise<void>;
	requestFaucet: () => Promise<void>;
	refreshBalance: () => Promise<void>;
	refreshMarket: (marketAddress: string) => Promise<void>;
}

const YellowContext = createContext<YellowContextValue | null>(null);

export function useYellowContext() {
	const ctx = useContext(YellowContext);
	if (!ctx) throw new Error("useYellowContext must be used within YellowProvider");
	return ctx;
}

const HEARTBEAT_TIMEOUT = 30_000;

export function YellowProvider({ children }: { children: ReactNode }) {
	const { address: account } = useAccount();
	const { data: walletClient } = useWalletClient();
	const channelRef = useRef<YellowChannel | null>(null);

	const [isConnected, setIsConnected] = useState(false);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [balances, setBalances] = useState<LedgerBalance[]>([]);
	const [error, setError] = useState<string | null>(null);

	const [asksByMarket, setAsksByMarket] = useState<Map<string, AskOrder[]>>(new Map());
	const [fillsByMarket, setFillsByMarket] = useState<Map<string, FillEvent[]>>(new Map());
	const [chatByMarket, setChatByMarket] = useState<Map<string, ChatMessage[]>>(new Map());
	const heartbeatMap = useRef<Map<string, Map<string, number>>>(new Map());
	const [onlineByMarket, setOnlineByMarket] = useState<Map<string, string[]>>(new Map());

	const filledPositionIds = useRef<Set<number>>(new Set());

	const joinedMarketsRef = useRef<Set<string>>(new Set());

	const reconnectAttemptRef = useRef(0);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const discoveryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const asksByMarketRef = useRef(asksByMarket);
	asksByMarketRef.current = asksByMarket;
	const chatByMarketRef = useRef(chatByMarket);
	chatByMarketRef.current = chatByMarket;

	const handleSessionMessageRef = useRef<(data: unknown) => void>(() => {});

	useEffect(() => {
		const interval = setInterval(() => {
			const now = Date.now();
			const updated = new Map<string, string[]>();
			for (const [market, traders] of heartbeatMap.current) {
				const online: string[] = [];
				for (const [addr, lastSeen] of traders) {
					if (now - lastSeen < HEARTBEAT_TIMEOUT) {
						online.push(addr);
					}
				}
				updated.set(market, online);
			}
			setOnlineByMarket(updated);
		}, 5_000);
		return () => clearInterval(interval);
	}, []);

	const connectPromiseRef = useRef<Promise<void> | null>(null);

	const ensureConnected = useCallback(async () => {
		if (channelRef.current?.isAuthenticated) return;
		if (connectPromiseRef.current) return connectPromiseRef.current;

		if (!walletClient?.account) {
			throw new Error("Wallet not connected");
		}

		const doConnect = async () => {
			setIsConnecting(true);
			setError(null);

			try {
				const channel = createYellowChannel({
					walletAddress: walletClient.account.address,
					walletClient,
				});

				channel.setDisconnectHandler(() => {
					console.log("[YellowProvider] Connection dropped, resetting state");
					channelRef.current = null;
					connectPromiseRef.current = null;
					setIsConnected(false);
					setIsAuthenticated(false);

					if (walletClient?.account && joinedMarketsRef.current.size > 0) {
						const attempt = reconnectAttemptRef.current++;
						const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
						console.log(`[YellowProvider] Auto-reconnecting in ${delay}ms (attempt ${attempt + 1})`);
						toast.error(`Yellow connection lost. Reconnecting in ${Math.round(delay / 1000)}s...`);
						reconnectTimerRef.current = setTimeout(async () => {
							try {
								await ensureConnected();
								const markets = Array.from(joinedMarketsRef.current);
								for (const market of markets) {
									await channelRef.current?.joinMarketSession(market);
								}
								reconnectAttemptRef.current = 0;
								toast.success("Yellow reconnected!");
							} catch (err) {
								console.error("[YellowProvider] Reconnect failed:", err);
							}
						}, delay);
					} else {
						toast.error("Yellow connection lost.");
					}
				});

				let authResolved = false;
				const authPromise = new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						if (!authResolved) {
							authResolved = true;
							reject(new Error("Authentication timed out"));
						}
					}, 30_000);

					channel.setMessageHandler((method, data) => {
						switch (method) {
							case "authenticated":
								setIsAuthenticated(true);
								if (!authResolved) {
									authResolved = true;
									clearTimeout(timeout);
									resolve();
								}
								break;
							case "balances": {
								const b = data as { ledgerBalances?: LedgerBalance[]; ledger_balances?: LedgerBalance[] };
								setBalances(b.ledgerBalances ?? b.ledger_balances ?? []);
								break;
							}
							case "balance_update":
								channelRef.current?.getBalance();
								break;
							case "faucet":
								console.log("[YellowProvider] Faucet result:", data);
								setTimeout(() => channelRef.current?.getBalance(), 2000);
								break;
							case "transfer": {
								const t = data as { status?: string; error?: string };
								if (t.error) {
									setError(t.error);
								}
								channelRef.current?.getBalance();
								break;
							}
							case "session_created":
								setError(null);
								break;
							case "session_message":
								handleSessionMessageRef.current(data);
								break;
							case "session_invite":
								console.log("[YellowProvider] Session invite received");
								break;
							case "error": {
								const errMsg =
									typeof data === "object" && data !== null && "message" in data
										? String((data as { message: unknown }).message)
										: typeof data === "object" && data !== null && "error" in data
											? String((data as { error: unknown }).error)
											: String(data);
								setError(errMsg);
								if (!authResolved) {
									authResolved = true;
									clearTimeout(timeout);
									reject(new Error(errMsg));
								}
								break;
							}
							default:
								break;
						}
					});
				});

				await channel.connect();
				setIsConnected(true);
				channelRef.current = channel;

				await channel.authenticate();
				await authPromise;
				await channel.getBalance();
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Connection failed";
				console.error("[YellowProvider] Connect failed:", msg);
				setError(msg);
				if (channelRef.current) {
					channelRef.current.disconnect();
					channelRef.current = null;
				}
				setIsConnected(false);
				setIsAuthenticated(false);
				connectPromiseRef.current = null;
				throw err;
			} finally {
				setIsConnecting(false);
			}
		};

		connectPromiseRef.current = doConnect();
		return connectPromiseRef.current;
	}, [walletClient]);

	useEffect(() => {
		if (!account && channelRef.current) {
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}
			if (syncIntervalRef.current) {
				clearInterval(syncIntervalRef.current);
				syncIntervalRef.current = null;
			}
			if (discoveryIntervalRef.current) {
				clearInterval(discoveryIntervalRef.current);
				discoveryIntervalRef.current = null;
			}
			reconnectAttemptRef.current = 0;
			channelRef.current.disconnect();
			channelRef.current = null;
			connectPromiseRef.current = null;
			setIsConnected(false);
			setIsAuthenticated(false);
			setBalances([]);
			setAsksByMarket(new Map());
			setFillsByMarket(new Map());
			setChatByMarket(new Map());
			setOnlineByMarket(new Map());
			heartbeatMap.current.clear();
			joinedMarketsRef.current.clear();
		}
	}, [account]);

	useEffect(() => {
		return () => {
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current);
			}
			if (syncIntervalRef.current) {
				clearInterval(syncIntervalRef.current);
			}
			if (discoveryIntervalRef.current) {
				clearInterval(discoveryIntervalRef.current);
			}
			channelRef.current?.disconnect();
		};
	}, []);

	const handleSessionMessage = useCallback((data: unknown) => {
		const msg = data as OrderMessage & { type: string };
		if (!msg?.type) return;

		const markets = msg.type === "sync" && (msg as { market?: string }).market
			? [(msg as { market: string }).market.toLowerCase()]
			: Array.from(joinedMarketsRef.current);

		switch (msg.type) {
			case "ask": {
				const ask = msg as unknown as AskOrder & { type: string };
				if (filledPositionIds.current.has(ask.positionId)) break;
				for (const market of markets) {
					setAsksByMarket((prev) => {
						const next = new Map(prev);
						const existing = next.get(market) ?? [];
						const filtered = existing.filter(
							(a) => !(a.positionId === ask.positionId && a.from === ask.from),
						);
						next.set(market, [{ positionId: ask.positionId, price: ask.price, mu: ask.mu, sigma: ask.sigma, collateral: ask.collateral, from: ask.from, ts: ask.ts }, ...filtered].slice(0, 50));
						return next;
					});
				}
				break;
			}
			case "cancel_ask": {
				const cancel = msg as { positionId: number; from: string };
				for (const market of markets) {
					setAsksByMarket((prev) => {
						const next = new Map(prev);
						const existing = next.get(market) ?? [];
						next.set(market, existing.filter((a) => !(a.positionId === cancel.positionId && a.from === cancel.from)));
						return next;
					});
				}
				break;
			}
			case "fill": {
				const fill = msg as unknown as FillEvent & { type: string };
				if (filledPositionIds.current.has(fill.positionId)) break;
				filledPositionIds.current.add(fill.positionId);
				for (const market of markets) {
					setAsksByMarket((prev) => {
						const next = new Map(prev);
						const existing = next.get(market) ?? [];
						next.set(market, existing.filter((a) => a.positionId !== fill.positionId));
						return next;
					});
					setFillsByMarket((prev) => {
						const next = new Map(prev);
						const existing = next.get(market) ?? [];
						if (existing.some((f) => f.positionId === fill.positionId)) return prev;
						next.set(market, [{ positionId: fill.positionId, price: fill.price, buyer: fill.buyer, seller: fill.seller, ts: fill.ts }, ...existing].slice(0, 50));
						return next;
					});
				}
				break;
			}
			case "chat": {
				const chat = msg as unknown as ChatMessage & { type: string };
				for (const market of markets) {
					setChatByMarket((prev) => {
						const next = new Map(prev);
						const existing = next.get(market) ?? [];
						next.set(market, [...existing, { text: chat.text, from: chat.from, ts: chat.ts }].slice(-100));
						return next;
					});
				}
				break;
			}
			case "heartbeat": {
				const hb = msg as { from: string; ts: number };
				for (const market of markets) {
					if (!heartbeatMap.current.has(market)) {
						heartbeatMap.current.set(market, new Map());
					}
					heartbeatMap.current.get(market)!.set(hb.from.toLowerCase(), Date.now());
				}
				break;
			}
			case "sync": {
				const sync = msg as {
					from: string;
					ts: number;
					asks: AskOrder[];
					chat: ChatMessage[];
					market: string;
				};
				const senderAddr = sync.from.toLowerCase();

				console.log("[YellowProvider] Sync received:", {
					from: senderAddr,
					askCount: sync.asks?.length,
					market: sync.market ?? "all",
				});

				for (const market of markets) {
					if (!heartbeatMap.current.has(market)) {
						heartbeatMap.current.set(market, new Map());
					}
					heartbeatMap.current.get(market)!.set(senderAddr, Date.now());
				}

				for (const market of markets) {
					setAsksByMarket((prev) => {
						const next = new Map(prev);
						const existing = next.get(market) ?? [];
						const others = existing.filter(
							(a) => a.from.toLowerCase() !== senderAddr && !filledPositionIds.current.has(a.positionId),
						);
						const synced = (sync.asks ?? [])
							.filter((a) => !filledPositionIds.current.has(a.positionId))
							.map((a) => ({
								positionId: a.positionId,
								price: a.price,
								mu: a.mu,
								sigma: a.sigma,
								collateral: a.collateral,
								from: a.from,
								ts: a.ts,
							}));
						console.log("[YellowProvider] Updating asks for market:", market, "synced:", synced.length, "others:", others.length, "filled:", filledPositionIds.current.size);
						next.set(market, [...synced, ...others].slice(0, 50));
						return next;
					});
				}

				if (sync.chat?.length) {
					for (const market of markets) {
						setChatByMarket((prev) => {
							const next = new Map(prev);
							const existing = next.get(market) ?? [];
							const existingKeys = new Set(existing.map((c) => `${c.from}-${c.ts}`));
							const newMsgs = sync.chat.filter((c) => !existingKeys.has(`${c.from}-${c.ts}`));
							if (newMsgs.length === 0) return prev;
							next.set(market, [...existing, ...newMsgs].sort((a, b) => a.ts - b.ts).slice(-100));
							return next;
						});
					}
				}
				break;
			}
		}
	}, []);

	handleSessionMessageRef.current = handleSessionMessage;

	const joinMarket = useCallback(async (marketAddress: string) => {
		const key = marketAddress.toLowerCase();
		joinedMarketsRef.current.add(key);

		try {
			await ensureConnected();
		} catch {
			return;
		}

		if (!channelRef.current) return;

		if (!heartbeatMap.current.has(key)) {
			heartbeatMap.current.set(key, new Map());
		}
		heartbeatMap.current.get(key)!.set(channelRef.current.address.toLowerCase(), Date.now());

		try {
			await channelRef.current.joinMarketSession(marketAddress);
		} catch (err) {
			console.error("[YellowProvider] Failed to join market:", err);
		}

		if (!syncIntervalRef.current) {
			const broadcastSync = async () => {
				if (!channelRef.current) return;
				for (const market of joinedMarketsRef.current) {
					const myAddr = channelRef.current.address.toLowerCase();
					const allAsks = asksByMarketRef.current.get(market) ?? [];
					const myAsks = allAsks.filter((a) => a.from.toLowerCase() === myAddr);
					const recentChat = (chatByMarketRef.current.get(market) ?? []).slice(-20);
					try {
						await channelRef.current.broadcastToMarket(market, {
							type: "sync",
							from: channelRef.current.address,
							ts: Date.now(),
							asks: myAsks,
							chat: recentChat,
							market,
						});
					} catch {
					}
				}
			};
			broadcastSync();
			syncIntervalRef.current = setInterval(broadcastSync, 10_000);
		}

		if (!discoveryIntervalRef.current) {
			const discoverSessions = () => {
				channelRef.current?.getAppSessions();
			};
			setTimeout(discoverSessions, 2000);
			discoveryIntervalRef.current = setInterval(discoverSessions, 10_000);
		}
	}, [ensureConnected]);

	const leaveMarket = useCallback((marketAddress: string) => {
		const key = marketAddress.toLowerCase();
		joinedMarketsRef.current.delete(key);
		channelRef.current?.leaveMarketSession(marketAddress);
		if (joinedMarketsRef.current.size === 0) {
			if (syncIntervalRef.current) {
				clearInterval(syncIntervalRef.current);
				syncIntervalRef.current = null;
			}
			if (discoveryIntervalRef.current) {
				clearInterval(discoveryIntervalRef.current);
				discoveryIntervalRef.current = null;
			}
		}
	}, []);

	const broadcastSyncNow = useCallback(async (market: string, extraAsks?: AskOrder[]) => {
		if (!channelRef.current) return;
		const myAddr = channelRef.current.address.toLowerCase();
		const allAsks = asksByMarketRef.current.get(market) ?? [];
		let myAsks = allAsks.filter(
			(a) => a.from.toLowerCase() === myAddr && !filledPositionIds.current.has(a.positionId),
		);
		if (extraAsks) {
			for (const ea of extraAsks) {
				if (!filledPositionIds.current.has(ea.positionId) && !myAsks.some((a) => a.positionId === ea.positionId && a.from === ea.from)) {
					myAsks = [ea, ...myAsks];
				}
			}
		}
		const recentChat = (chatByMarketRef.current.get(market) ?? []).slice(-20);
		await channelRef.current.broadcastToMarket(market, {
			type: "sync",
			from: channelRef.current.address,
			ts: Date.now(),
			asks: myAsks,
			chat: recentChat,
			market,
		});
	}, []);

	const postAsk = useCallback(async (marketAddress: string, ask: Omit<AskOrder, "from" | "ts">) => {
		if (!channelRef.current) throw new Error("Not connected");
		const key = marketAddress.toLowerCase();
		const ts = Date.now();
		const fullAsk: AskOrder = { ...ask, from: channelRef.current.address, ts };
		setAsksByMarket((prev) => {
			const next = new Map(prev);
			const existing = next.get(key) ?? [];
			const filtered = existing.filter(
				(a) => !(a.positionId === fullAsk.positionId && a.from === fullAsk.from),
			);
			next.set(key, [fullAsk, ...filtered].slice(0, 50));
			return next;
		});
		await broadcastSyncNow(key, [fullAsk]);
	}, [broadcastSyncNow]);

	const cancelAsk = useCallback(async (marketAddress: string, positionId: number) => {
		if (!channelRef.current) throw new Error("Not connected");
		const key = marketAddress.toLowerCase();
		setAsksByMarket((prev) => {
			const next = new Map(prev);
			const existing = next.get(key) ?? [];
			next.set(key, existing.filter((a) => !(a.positionId === positionId && a.from === channelRef.current!.address)));
			return next;
		});
		await broadcastSyncNow(key);
	}, [broadcastSyncNow]);

	const broadcastFill = useCallback(async (marketAddress: string, fill: Omit<FillEvent, "ts">) => {
		if (!channelRef.current) throw new Error("Not connected");
		const key = marketAddress.toLowerCase();
		const ts = Date.now();
		const fullFill: FillEvent = { ...fill, ts };
		filledPositionIds.current.add(fill.positionId);
		setAsksByMarket((prev) => {
			const next = new Map(prev);
			const existing = next.get(key) ?? [];
			next.set(key, existing.filter((a) => a.positionId !== fill.positionId));
			return next;
		});
		setFillsByMarket((prev) => {
			const next = new Map(prev);
			const existing = next.get(key) ?? [];
			if (existing.some((f) => f.positionId === fill.positionId)) return prev;
			next.set(key, [fullFill, ...existing].slice(0, 50));
			return next;
		});
		await channelRef.current.broadcastToMarket(key, {
			type: "fill" as const,
			positionId: fill.positionId,
			price: fill.price,
			buyer: fill.buyer,
			seller: fill.seller,
			ts,
		});
	}, []);

	const sendChat = useCallback(async (marketAddress: string, text: string) => {
		if (!channelRef.current) throw new Error("Not connected");
		const key = marketAddress.toLowerCase();
		const ts = Date.now();
		setChatByMarket((prev) => {
			const next = new Map(prev);
			const existing = next.get(key) ?? [];
			next.set(key, [...existing, { text, from: channelRef.current!.address, ts }].slice(-100));
			return next;
		});
		await broadcastSyncNow(key);
	}, [broadcastSyncNow]);

	const transferYellow = useCallback(async (destination: Address, amount: string) => {
		if (!channelRef.current) throw new Error("Not connected");
		setError(null);
		await channelRef.current.transfer(destination, "ytest.usd", amount);
	}, []);

	const requestFaucet = useCallback(async () => {
		if (!channelRef.current) return;
		await channelRef.current.requestFaucet();
	}, []);

	const refreshBalance = useCallback(async () => {
		if (!channelRef.current) return;
		await channelRef.current.getBalance();
	}, []);

	const refreshMarket = useCallback(async (marketAddress: string) => {
		if (!channelRef.current) return;
		await channelRef.current.getAppSessions();
		await channelRef.current.joinMarketSession(marketAddress);
		await channelRef.current.getBalance();
	}, []);

	const getAsks = useCallback((market: string) => asksByMarket.get(market.toLowerCase()) ?? [], [asksByMarket]);
	const getFills = useCallback((market: string) => fillsByMarket.get(market.toLowerCase()) ?? [], [fillsByMarket]);
	const getChat = useCallback((market: string) => chatByMarket.get(market.toLowerCase()) ?? [], [chatByMarket]);
	const getOnlineTraders = useCallback((market: string) => onlineByMarket.get(market.toLowerCase()) ?? [], [onlineByMarket]);

	return (
		<YellowContext.Provider
			value={{
				isConnected,
				isAuthenticated,
				isConnecting,
				balances,
				error,
				getAsks,
				getFills,
				getChat,
				getOnlineTraders,
				joinMarket,
				leaveMarket,
				postAsk,
				cancelAsk,
				broadcastFill,
				sendChat,
				transfer: transferYellow,
				requestFaucet,
				refreshBalance,
				refreshMarket,
			}}
		>
			{children}
		</YellowContext.Provider>
	);
}
