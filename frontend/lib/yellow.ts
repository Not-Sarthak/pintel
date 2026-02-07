import {
	createAuthRequestMessage,
	createAuthVerifyMessageFromChallenge,
	createAppSessionMessage,
	createCloseAppSessionMessage,
	createSubmitAppStateMessage,
	createGetAppSessionsMessageV2,
	createGetLedgerBalancesMessage,
	createTransferMessage,
	createECDSAMessageSigner,
	createEIP712AuthMessageSigner,
	parseAnyRPCResponse,
} from "@erc7824/nitrolite";
import { getAddress, type Address, type Hex, type WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { OrderMessage } from "./yellow-types";

const CLEARNODE_WS = "wss://clearnet-sandbox.yellow.com/ws";

interface YellowConfig {
	walletAddress: Address;
	walletClient: WalletClient;
}

type YellowMessageHandler = (method: string, data: unknown) => void;

export class YellowChannel {
	private ws: WebSocket | null = null;
	private walletAddress: Address;
	private walletClient: WalletClient;
	private signer: ReturnType<typeof createECDSAMessageSigner>;
	private sessionAddress: Address;
	private authParams: {
		session_key: Address;
		allowances: { asset: string; amount: string }[];
		expires_at: bigint;
		scope: string;
	};
	private onMessage: YellowMessageHandler | null = null;
	private onDisconnect: (() => void) | null = null;
	private authenticated = false;
	private intentionalClose = false;

	private marketSessions = new Map<string, string>();
	private sessionToMarket = new Map<string, string>();
	private pendingJoins = new Map<number, string>();

	private bilateralSessions = new Map<string, string>();
	private bilateralCreatedByUs = new Set<string>();
	private pendingBilateral = new Map<number, string>();
	private bilateralAttempted = new Set<string>();

	private remoteUsers = new Map<string, Set<string>>();
	private ownSessionIds = new Set<string>();

	private processedSessionData = new Set<string>();

	constructor(config: YellowConfig) {
		this.walletAddress = config.walletAddress;
		this.walletClient = config.walletClient;
		const sessionKey = generatePrivateKey();
		this.sessionAddress = privateKeyToAccount(sessionKey).address;
		this.signer = createECDSAMessageSigner(sessionKey);
		this.authParams = {
			session_key: this.sessionAddress,
			allowances: [{ asset: "ytest.usd", amount: "1000000000" }],
			expires_at: BigInt(Math.floor(Date.now() / 1000) + 86400),
			scope: "console",
		};
	}

	get address() {
		return this.walletAddress;
	}

	get isConnected() {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	get isAuthenticated() {
		return this.authenticated;
	}

	private send(msg: string) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.error("[Yellow] Cannot send -- WebSocket not open");
			this.onMessage?.("error", { error: "Connection lost. Please reconnect." });
			return;
		}
		this.ws.send(msg);
	}

	setMessageHandler(handler: YellowMessageHandler) {
		this.onMessage = handler;
	}

	setDisconnectHandler(handler: () => void) {
		this.onDisconnect = handler;
	}

	async connect(): Promise<void> {
		this.intentionalClose = false;
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(CLEARNODE_WS);

				this.ws.onopen = () => {
					console.log("[Yellow] Connected to ClearNode");
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const response = parseAnyRPCResponse(event.data);
						this.handleResponse(response);
					} catch {
						try {
							const raw = JSON.parse(event.data);
							this.handleResponse(raw);
						} catch (err2) {
							console.error("[Yellow] Failed to parse message:", err2, event.data);
						}
					}
				};

				this.ws.onclose = () => {
					console.log("[Yellow] Disconnected from ClearNode");
					this.authenticated = false;
					if (!this.intentionalClose) {
						console.warn("[Yellow] Connection dropped unexpectedly");
						this.onMessage?.("error", { error: "Connection lost. Please reconnect." });
					}
					this.onDisconnect?.();
				};

				this.ws.onerror = (err) => {
					console.error("[Yellow] WebSocket error:", err);
					reject(err);
				};
			} catch (err) {
				reject(err);
			}
		});
	}

	disconnect() {
		this.intentionalClose = true;
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.authenticated = false;
		this.marketSessions.clear();
		this.sessionToMarket.clear();
		this.pendingJoins.clear();
		this.bilateralSessions.clear();
		this.bilateralCreatedByUs.clear();
		this.pendingBilateral.clear();
		this.bilateralAttempted.clear();
		this.remoteUsers.clear();
		this.ownSessionIds.clear();
		this.processedSessionData.clear();
	}

	async authenticate(): Promise<void> {
		if (!this.ws) throw new Error("Not connected");

		const authReq = await createAuthRequestMessage({
			address: this.walletAddress,
			session_key: this.authParams.session_key,
			application: "pintel",
			allowances: this.authParams.allowances,
			expires_at: this.authParams.expires_at,
			scope: this.authParams.scope,
		});
		console.log("[Yellow] Sending auth request...");
		this.send(authReq);
	}

	async getBalance(): Promise<void> {
		if (!this.ws) return;
		const msg = await createGetLedgerBalancesMessage(
			this.signer,
			this.walletAddress,
		);
		this.send(msg);
	}

	async requestFaucet(): Promise<void> {
		console.log("[Yellow] Requesting faucet tokens...");
		const res = await fetch("https://clearnet-sandbox.yellow.com/faucet/requestTokens", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userAddress: this.walletAddress }),
		});
		const data = await res.json();
		console.log("[Yellow] Faucet response:", data);
		this.onMessage?.("faucet", data);
	}

	async transfer(destination: Address, asset: string, amount: string): Promise<void> {
		if (!this.ws) throw new Error("Not connected");
		const msg = await createTransferMessage(this.signer, {
			destination,
			allocations: [{ asset, amount }],
		});
		console.log("[Yellow] Sending transfer:", { destination, asset, amount });
		this.send(msg);
	}

	async getAppSessions(): Promise<void> {
		if (!this.ws) return;
		const msg = createGetAppSessionsMessageV2(
			this.walletAddress,
			"open" as Parameters<typeof createGetAppSessionsMessageV2>[1],
		);
		this.send(msg);
	}

	private checksumAddress(addr: string): Address {
		try {
			return getAddress(addr);
		} catch {
			return addr as Address;
		}
	}

	async joinMarketSession(marketAddress: string): Promise<void> {
		if (!this.ws) throw new Error("Not connected");
		const key = marketAddress.toLowerCase();

		if (this.marketSessions.has(key)) {
			console.log("[Yellow] Already in market session:", key);
			return;
		}

		const nonce = Date.now();
		this.pendingJoins.set(nonce, key);

		const msg = await createAppSessionMessage(this.signer, {
			definition: {
				protocol: "NitroRPC/0.2" as never,
				application: "pintel",
				participants: [this.walletAddress, "0x0000000000000000000000000000000000000000" as Address],
				weights: [50, 50],
				quorum: 50,
				challenge: 0,
				nonce,
			},
			allocations: [
				{
					participant: this.walletAddress,
					asset: "ytest.usd",
					amount: "0",
				},
				{
					participant: "0x0000000000000000000000000000000000000000" as Address,
					asset: "ytest.usd",
					amount: "0",
				},
			],
		});
		console.log("[Yellow] Joining market session for:", key);
		this.send(msg);
	}

	async createBilateralSession(remoteAddress: string): Promise<void> {
		if (!this.ws) return;
		const remote = remoteAddress.toLowerCase();

		if (this.bilateralSessions.has(remote) || this.bilateralAttempted.has(remote)) {
			return;
		}
		this.bilateralAttempted.add(remote);

		const remoteChecksummed = this.checksumAddress(remoteAddress);

		const nonce = Date.now() + Math.floor(Math.random() * 1000);
		this.pendingBilateral.set(nonce, remote);

		try {
			const msg = await createAppSessionMessage(this.signer, {
				definition: {
					protocol: "NitroRPC/0.2" as never,
					application: "pintel",
					participants: [this.walletAddress, remoteChecksummed],
					weights: [100, 100],
					quorum: 100,
					challenge: 0,
					nonce,
				},
				allocations: [
					{
						participant: this.walletAddress,
						asset: "ytest.usd",
						amount: "0",
					},
					{
						participant: remoteChecksummed,
						asset: "ytest.usd",
						amount: "0",
					},
				],
			});
			console.log("[Yellow] Creating outbound bilateral session with:", remoteChecksummed.slice(0, 10));
			this.send(msg);
		} catch (err) {
			console.error("[Yellow] Failed to create bilateral session:", err);
			this.pendingBilateral.delete(nonce);
		}
	}

	async broadcastToMarket(marketAddress: string, message: OrderMessage): Promise<void> {
		if (!this.ws) throw new Error("Not connected");
		const key = marketAddress.toLowerCase();
		const sessionData = JSON.stringify(message);

		const ownSid = this.marketSessions.get(key);
		if (ownSid) {
			try {
				const msg = await createSubmitAppStateMessage(this.signer, {
					app_session_id: ownSid as Hex,
					allocations: [
						{ participant: this.walletAddress, asset: "ytest.usd", amount: "0" },
						{ participant: "0x0000000000000000000000000000000000000000" as Address, asset: "ytest.usd", amount: "0" },
					],
					session_data: sessionData,
				});
				this.send(msg);
			} catch (err) {
				console.error("[Yellow] Failed to submit to own session:", err);
			}
		}

		for (const [remoteAddrLower, sid] of this.bilateralSessions) {
			if (!this.bilateralCreatedByUs.has(sid)) continue;

			try {
				const remoteChecksummed = this.checksumAddress(remoteAddrLower);
				const msg = await createSubmitAppStateMessage(this.signer, {
					app_session_id: sid as Hex,
					allocations: [
						{ participant: this.walletAddress, asset: "ytest.usd", amount: "0" },
						{ participant: remoteChecksummed, asset: "ytest.usd", amount: "0" },
					],
					session_data: sessionData,
				});
				this.send(msg);
			} catch (err) {
			}
		}
	}

	async leaveMarketSession(marketAddress: string): Promise<void> {
		if (!this.ws) return;
		const key = marketAddress.toLowerCase();
		const sessionId = this.marketSessions.get(key);
		if (!sessionId) return;

		try {
			const msg = await createCloseAppSessionMessage(this.signer, {
				app_session_id: sessionId as Hex,
				allocations: [
					{ participant: this.walletAddress, asset: "ytest.usd", amount: "0" },
					{ participant: "0x0000000000000000000000000000000000000000" as Address, asset: "ytest.usd", amount: "0" },
				] as Parameters<typeof createCloseAppSessionMessage>[1]["allocations"],
			});
			this.send(msg);
		} catch (err) {
			console.error("[Yellow] Error closing market session:", err);
		}

		this.ownSessionIds.delete(sessionId);
		this.sessionToMarket.delete(sessionId);
		this.marketSessions.delete(key);
	}

	private handleResponse(response: unknown) {
		const res = response as {
			res?: [number, string, unknown, number?];
			req?: [number, string, unknown, number?];
			error?: { code: number; message: string };
			method?: string;
			params?: unknown;
			type?: string;
			event?: string;
			app_session_id?: string;
			appSessionId?: string;
		};

		if (res.error) {
			console.error("[Yellow] Error:", res.error);
			this.onMessage?.("error", res.error);
			return;
		}

		let method: string;
		let data: unknown;

		if (res.method) {
			method = res.method;
			data = res.params;
		} else if (res.res || res.req) {
			const rpcData = res.res || res.req;
			if (!rpcData || !Array.isArray(rpcData)) return;
			[, method, data] = rpcData;
		} else if (res.type || res.event) {
			method = (res.type || res.event)!;
			data = res;
		} else if (res.app_session_id || res.appSessionId) {
			method = "asu";
			data = res;
		} else {
			this.onMessage?.("unknown", res);
			return;
		}

		switch (method) {
			case "auth_challenge":
				this.handleAuthChallenge(data);
				break;
			case "auth_verify":
				this.authenticated = true;
				console.log("[Yellow] Authenticated");
				this.onMessage?.("authenticated", data);
				break;
			case "get_channels":
				this.onMessage?.("channels", data);
				break;
			case "get_ledger_balances":
				this.onMessage?.("balances", data);
				break;
			case "transfer":
				console.log("[Yellow] Transfer result:", data);
				this.onMessage?.("transfer", data);
				break;
			case "bu":
				this.onMessage?.("balance_update", data);
				break;
			case "create_app_session": {
				const rawCreated = Array.isArray(data) ? (data as unknown[])[0] : data;
				const created = rawCreated as Record<string, unknown>;
				const sid = (created?.app_session_id ?? created?.appSessionId) as string | undefined;
				console.log("[Yellow] create_app_session response:", { sid: sid?.slice(0, 10), nonce: created?.nonce, participants: created?.participants, pendingBilateral: this.pendingBilateral.size, pendingJoins: this.pendingJoins.size, isArray: Array.isArray(data) });
				if (!sid) break;

				const rawNonce = created?.nonce;
				const nonceNum = typeof rawNonce === "string" ? Number(rawNonce) : (rawNonce as number ?? 0);

				let bilateralRemote = this.pendingBilateral.get(nonceNum);

				if (!bilateralRemote && this.pendingBilateral.size > 0 && this.pendingJoins.size === 0) {
					const entry = this.pendingBilateral.entries().next().value as [number, string];
					bilateralRemote = entry[1];
					this.pendingBilateral.delete(entry[0]);
					console.log("[Yellow] Bilateral matched via fallback (no pending markets)");
				} else if (bilateralRemote) {
					this.pendingBilateral.delete(nonceNum);
				}

				if (bilateralRemote) {
					const isOutboundOnly = bilateralRemote.startsWith("out:");
					const actualRemote = isOutboundOnly ? bilateralRemote.slice(4) : bilateralRemote;
					this.bilateralSessions.set(actualRemote, sid);
					this.bilateralCreatedByUs.add(sid);
					this.ownSessionIds.add(sid);
					console.log("[Yellow] Outbound bilateral created:", actualRemote.slice(0, 10), "sid:", sid.slice(0, 10));
					this.onMessage?.("session_created", data);
					break;
				}

				let marketKey = this.pendingJoins.get(nonceNum);
				if (marketKey) {
					this.pendingJoins.delete(nonceNum);
				} else {
					for (const [n, mk] of this.pendingJoins) {
						if (!this.marketSessions.has(mk)) {
							this.pendingJoins.delete(n);
							marketKey = mk;
							break;
						}
					}
				}

				if (marketKey) {
					this.marketSessions.set(marketKey, sid);
					this.sessionToMarket.set(sid, marketKey);
					this.ownSessionIds.add(sid);
					console.log("[Yellow] Market session created:", marketKey, "sid:", sid.slice(0, 10));
					this.getAppSessions();
				}

				this.onMessage?.("session_created", data);
				break;
			}
			case "get_app_sessions": {
				const sessionsData = data as {
					appSessions?: Array<Record<string, unknown>>;
					app_sessions?: Array<Record<string, unknown>>;
				};
				const sessions = sessionsData?.appSessions ?? sessionsData?.app_sessions ?? [];
				const myAddr = this.walletAddress.toLowerCase();
				const newRemoteUsers = new Set<string>();

				for (const s of sessions) {
					const app = (s.application ?? "") as string;
					const sid = (s.appSessionId ?? s.app_session_id) as string | undefined;
					if (!sid || app !== "pintel") continue;

					if (this.ownSessionIds.has(sid)) continue;

					const participants = (s.participants ?? []) as string[];

					const otherParticipant = participants.find(
						(p) =>
							p.toLowerCase() !== myAddr &&
							p.toLowerCase() !== "0x0000000000000000000000000000000000000000",
					);

					const weAreParticipant = participants.some(
						(p) => p.toLowerCase() === myAddr,
					);

					if (weAreParticipant && otherParticipant) {
						const otherKey = otherParticipant.toLowerCase();

						if (!this.bilateralSessions.has(otherKey)) {
							this.bilateralSessions.set(otherKey, sid);
							this.ownSessionIds.add(sid);
							console.log("[Yellow] Adopted inbound bilateral session from:", otherKey.slice(0, 10), "sid:", sid.slice(0, 10));
						}

						const sessionData = (s.sessionData ?? s.session_data) as string | undefined;
						if (sessionData) {
							const dataKey = `${sid}-${sessionData.length}-${sessionData.slice(0, 20)}`;
							if (!this.processedSessionData.has(dataKey)) {
								this.processedSessionData.add(dataKey);
								try {
									const parsed = JSON.parse(sessionData);
									if (parsed?.from?.toLowerCase() !== myAddr) {
										console.log("[Yellow] SessionData from polling:", sid.slice(0, 10), "type:", parsed?.type, "from:", parsed?.from?.slice(0, 10));
										this.onMessage?.("session_message", parsed);
									}
								} catch {
								}
							}
						}

						newRemoteUsers.add(otherKey);
						continue;
					}

					if (!weAreParticipant && otherParticipant) {
						const ownerKey = otherParticipant.toLowerCase();
						if (!this.remoteUsers.has(ownerKey)) {
							this.remoteUsers.set(ownerKey, new Set());
						}
						this.remoteUsers.get(ownerKey)!.add(sid);
						newRemoteUsers.add(ownerKey);
					}
				}

				for (const remoteAddr of newRemoteUsers) {
					if (!this.bilateralSessions.has(remoteAddr) && !this.bilateralAttempted.has(remoteAddr)) {
						console.log("[Yellow] Discovered remote user:", remoteAddr.slice(0, 10), "- creating outbound bilateral");
						this.createBilateralSession(remoteAddr);
					} else if (
						this.bilateralSessions.has(remoteAddr) &&
						!this.bilateralCreatedByUs.has(this.bilateralSessions.get(remoteAddr)!) &&
						!this.bilateralAttempted.has(remoteAddr)
					) {
						console.log("[Yellow] Have inbound from:", remoteAddr.slice(0, 10), "- creating outbound bilateral");
						this.bilateralAttempted.add(remoteAddr);
						this.createOutboundOnly(remoteAddr);
					}
				}

				const outbound = [...this.bilateralSessions.values()].filter((sid) => this.bilateralCreatedByUs.has(sid)).length;
				const inbound = this.bilateralSessions.size - outbound;
				console.log("[Yellow] Sessions: outbound:", outbound, "inbound:", inbound, "remoteUsers:", this.remoteUsers.size);

				this.onMessage?.("app_sessions", { sessions });
				break;
			}
			case "asu": {
				const raw = data as Record<string, unknown>;
				const appSession = raw?.app_session as Record<string, unknown> | undefined;
				const sid = (appSession?.app_session_id ?? appSession?.appSessionId ?? raw?.app_session_id ?? raw?.appSessionId) as string | undefined;
				const sessionData = (appSession?.session_data ?? appSession?.sessionData ?? raw?.session_data ?? raw?.sessionData) as string | undefined;

				if (sessionData) {
					try {
						const parsed = JSON.parse(sessionData);
						const fromAddr = (parsed?.from as string) ?? "?";
						const fromLower = fromAddr.toLowerCase();

						if (fromLower === this.walletAddress.toLowerCase()) {
							break;
						}

						console.log("[Yellow] ASU:", sid?.slice(0, 10), "type:", parsed?.type, "from:", fromAddr.slice(0, 10));
						this.onMessage?.("session_message", parsed);
					} catch {
						this.onMessage?.("session_message", data);
					}
				} else {
					console.log("[Yellow] ASU without sessionData:", sid?.slice(0, 10));
					this.onMessage?.("session_invite", data);
				}
				break;
			}
			case "submit_app_state": {
				break;
			}
			case "close_app_session": {
				const closed = data as Record<string, unknown>;
				const closedSid = (closed?.app_session_id ?? closed?.appSessionId) as string | undefined;
				if (closedSid) {
					const marketKey = this.sessionToMarket.get(closedSid);
					if (marketKey) {
						this.marketSessions.delete(marketKey);
					}
					this.sessionToMarket.delete(closedSid);
					this.ownSessionIds.delete(closedSid);
					this.bilateralCreatedByUs.delete(closedSid);
					for (const [addr, sid] of this.bilateralSessions) {
						if (sid === closedSid) {
							this.bilateralSessions.delete(addr);
							this.bilateralAttempted.delete(addr);
							break;
						}
					}
				}
				this.onMessage?.("session_closed", data);
				break;
			}
			case "error": {
				const errData = data as { error?: string; message?: string };
				const errMsg = errData?.error ?? errData?.message ?? String(data);

				if (typeof errMsg === "string" && (
					errMsg.includes("non-participant") ||
					errMsg.includes("not a participant") ||
					errMsg.includes("unauthorized")
				)) {
					console.log("[Yellow] Suppressed expected error:", errMsg);
					break;
				}

				console.error("[Yellow] ClearNode error:", errMsg);
				this.onMessage?.("error", data);
				break;
			}
			default:
				this.onMessage?.(method, data);
		}
	}

	private async createOutboundOnly(remoteAddrLower: string): Promise<void> {
		if (!this.ws) return;

		const remoteChecksummed = this.checksumAddress(remoteAddrLower);
		const nonce = Date.now() + Math.floor(Math.random() * 10000);

		const outboundKey = `out:${remoteAddrLower}`;
		this.pendingBilateral.set(nonce, outboundKey);

		try {
			const msg = await createAppSessionMessage(this.signer, {
				definition: {
					protocol: "NitroRPC/0.2" as never,
					application: "pintel",
					participants: [this.walletAddress, remoteChecksummed],
					weights: [100, 100],
					quorum: 100,
					challenge: 0,
					nonce,
				},
				allocations: [
					{
						participant: this.walletAddress,
						asset: "ytest.usd",
						amount: "0",
					},
					{
						participant: remoteChecksummed,
						asset: "ytest.usd",
						amount: "0",
					},
				],
			});
			console.log("[Yellow] Creating additional outbound session with:", remoteChecksummed.slice(0, 10));
			this.send(msg);
		} catch (err) {
			console.error("[Yellow] Failed to create outbound session:", err);
			this.pendingBilateral.delete(nonce);
		}
	}

	private async handleAuthChallenge(data: unknown) {
		if (!this.ws) return;

		try {
			const challenge =
				(data as Record<string, string>)?.challenge_message ??
				(data as Record<string, string>)?.challengeMessage ??
				String(data);

			console.log("[Yellow] Received auth challenge, signing with wallet...");

			const authSigner = createEIP712AuthMessageSigner(
				this.walletClient,
				this.authParams,
				{ name: "pintel" },
			);

			const verifyMsg = await createAuthVerifyMessageFromChallenge(
				authSigner,
				challenge,
			);
			this.send(verifyMsg);
			console.log("[Yellow] Auth verify sent");
		} catch (err) {
			console.error("[Yellow] Auth challenge failed:", err);
			this.onMessage?.("error", "Auth challenge signing failed");
		}
	}
}

export function createYellowChannel(config: YellowConfig): YellowChannel {
	return new YellowChannel(config);
}
