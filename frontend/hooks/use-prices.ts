"use client";

import { useEffect, useState } from "react";
import {
	type PriceData,
	type TradeData,
	subscribePrices,
	subscribeTrades,
} from "@/lib/prices";

export function usePrices() {
	const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());

	useEffect(() => {
		const unsub = subscribePrices((p) => {
			setPrices(new Map(p));
		});
		return unsub;
	}, []);

	return prices;
}

export function usePrice(symbol: string | null) {
	const prices = usePrices();
	if (!symbol) return null;
	return prices.get(symbol) || null;
}

export function useLiveTrades(maxTrades = 50) {
	const [trades, setTrades] = useState<TradeData[]>([]);

	useEffect(() => {
		const unsub = subscribeTrades((trade) => {
			setTrades((prev) => [trade, ...prev].slice(0, maxTrades));
		});
		return unsub;
	}, [maxTrades]);

	return trades;
}
