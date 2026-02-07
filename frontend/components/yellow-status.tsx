"use client";

import { useAccount } from "wagmi";
import { useYellowContext } from "@/components/providers/yellow-provider";

export function YellowStatus() {
	const { address } = useAccount();
	const { isConnected, isAuthenticated, isConnecting, balances } = useYellowContext();

	if (!address) return null;

	const usdBalance = balances.find((b) => b.asset === "ytest.usd");

	if (isConnecting) {
		return (
			<div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1">
				<span className="relative flex h-1.5 w-1.5">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
					<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
				</span>
				<span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
					Connecting...
				</span>
			</div>
		);
	}

	if (isAuthenticated) {
		return (
			<div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1">
				<span className="relative flex h-1.5 w-1.5">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
					<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
				</span>
				{usdBalance && (
					<span className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400">
						{usdBalance.amount}
					</span>
				)}
			</div>
		);
	}

	if (isConnected) {
		return (
			<div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1">
				<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
				<span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
					Authenticating...
				</span>
			</div>
		);
	}

	return null;
}
