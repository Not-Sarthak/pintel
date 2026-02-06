export type PriceData = {
	symbol: string;
	price: number;
	change24h: number;
	high24h: number;
	low24h: number;
	volume24h: number;
	timestamp: number;
};

export type TradeData = {
	symbol: string;
	price: number;
	quantity: number;
	isBuyerMaker: boolean;
	timestamp: number;
	id: string;
};

const SYMBOLS = ["btcusdt", "ethusdt", "solusdt"] as const;
export type SymbolKey = (typeof SYMBOLS)[number];

const SYMBOL_MAP: Record<string, string> = {
	btcusdt: "BTC",
	ethusdt: "ETH",
	solusdt: "SOL",
};

type PriceCallback = (prices: Map<string, PriceData>) => void;
type TradeCallback = (trade: TradeData) => void;

let ws: WebSocket | null = null;
let tradeWs: WebSocket | null = null;
let priceListeners: PriceCallback[] = [];
let tradeListeners: TradeCallback[] = [];
let prices = new Map<string, PriceData>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectPriceFeed() {
	if (ws?.readyState === WebSocket.OPEN) return;

	const streams = SYMBOLS.map((s) => `${s}@ticker`).join("/");
	ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data);
		if (!msg.data) return;
		const d = msg.data;
		const symbol = SYMBOL_MAP[d.s?.toLowerCase()] || d.s;
		if (!symbol) return;

		prices.set(symbol, {
			symbol,
			price: parseFloat(d.c),
			change24h: parseFloat(d.P),
			high24h: parseFloat(d.h),
			low24h: parseFloat(d.l),
			volume24h: parseFloat(d.v),
			timestamp: Date.now(),
		});

		for (const cb of priceListeners) cb(prices);
	};

	ws.onclose = () => {
		reconnectTimer = setTimeout(connectPriceFeed, 3000);
	};

	ws.onerror = () => {
		ws?.close();
	};
}

function connectTradeFeed() {
	if (tradeWs?.readyState === WebSocket.OPEN) return;

	const streams = SYMBOLS.map((s) => `${s}@aggTrade`).join("/");
	tradeWs = new WebSocket(
		`wss://stream.binance.com:9443/stream?streams=${streams}`,
	);

	tradeWs.onmessage = (event) => {
		const msg = JSON.parse(event.data);
		if (!msg.data) return;
		const d = msg.data;
		const symbol = SYMBOL_MAP[d.s?.toLowerCase()] || d.s;

		const trade: TradeData = {
			symbol,
			price: parseFloat(d.p),
			quantity: parseFloat(d.q),
			isBuyerMaker: d.m,
			timestamp: d.T,
			id: String(d.a),
		};

		for (const cb of tradeListeners) cb(trade);
	};

	tradeWs.onclose = () => {
		setTimeout(connectTradeFeed, 3000);
	};

	tradeWs.onerror = () => {
		tradeWs?.close();
	};
}

export function subscribePrices(cb: PriceCallback): () => void {
	priceListeners.push(cb);
	connectPriceFeed();
	if (prices.size > 0) cb(prices);
	return () => {
		priceListeners = priceListeners.filter((l) => l !== cb);
		if (priceListeners.length === 0 && ws) {
			ws.close();
			ws = null;
			if (reconnectTimer) clearTimeout(reconnectTimer);
		}
	};
}

export function subscribeTrades(cb: TradeCallback): () => void {
	tradeListeners.push(cb);
	connectTradeFeed();
	return () => {
		tradeListeners = tradeListeners.filter((l) => l !== cb);
		if (tradeListeners.length === 0 && tradeWs) {
			tradeWs.close();
			tradeWs = null;
		}
	};
}

export function getLatestPrices(): Map<string, PriceData> {
	return prices;
}
