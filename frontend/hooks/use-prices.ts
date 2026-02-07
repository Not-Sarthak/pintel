"use client";

import { useEffect, useState } from "react";
import {
	type PriceData,
	subscribePrices,
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

