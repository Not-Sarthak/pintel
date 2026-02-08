"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { PintelLogoThemeAware } from "@/components/logos/pintel-theme-aware";
import { ToggleTheme } from "@/components/theme/toggle-theme";
import { useYellowContext } from "@/components/providers/yellow-provider";
import { SearchDialog, SearchTrigger } from "@/components/ui/search-dialog";
import { CreateMarketModal, OWNER_ADDRESS } from "@/components/ui/create-market-modal";
import { formatAddress } from "@/lib/gaussian";
import { cn } from "@/lib/utils";
import { SiteHeaderWrapper } from "@/components/layout/site-header-wrapper";

const headerWrapperClasses = cn(
	"sticky top-0 z-50 max-w-screen overflow-x-hidden bg-background px-2 pt-2",
	"data-[affix=true]:shadow-[0_0_16px_0_black]/8 dark:data-[affix=true]:shadow-[0_0_16px_0_black]/80",
	"not-dark:data-[affix=true]:**:data-header-container:after:bg-border",
	"transition-shadow duration-300",
);

const headerContainerClasses = cn(
	"screen-line-before screen-line-after mx-auto flex h-12 items-center justify-between gap-2 border-x border-edge px-2 after:z-1 after:transition-[background-color] sm:gap-4 min-w-6xl max-w-6xl",
);

function HeaderBalances() {
	const { address } = useAccount();
	const { isAuthenticated, balances, requestFaucet } = useYellowContext();
	const { data: ethBalance } = useBalance({ address });
	const [faucetLoading, setFaucetLoading] = useState(false);

	if (!address || !isAuthenticated) return null;

	const usdBalance = balances.find((b) => b.asset === "ytest.usd");
	const ethValue = ethBalance
		? Number(ethBalance.value) / 10 ** ethBalance.decimals
		: null;
	const usdValue = isAuthenticated && usdBalance
		? Number(usdBalance.amount)
		: null;

	const ethIsZero = ethValue !== null && ethValue === 0;
	const usdIsZero = usdValue !== null && usdValue === 0;

	const handleFaucet = async () => {
		setFaucetLoading(true);
		try {
			await requestFaucet();
		} finally {
			setFaucetLoading(false);
		}
	};

	return (
		<div className="hidden sm:flex items-center gap-0 rounded-lg border border-border bg-card text-xs font-mono">
			<div className="flex items-center gap-1.5 px-2.5 py-1.5 border-r border-border">
				<span className="text-muted-foreground">ETH</span>
				{ethIsZero ? (
					<a
						href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-amber-500 hover:text-amber-400 cursor-pointer transition-colors"
					>
						Faucet
					</a>
				) : (
					<span className="font-medium text-foreground">{ethValue !== null ? ethValue.toFixed(4) : "---"}</span>
				)}
			</div>
			<div className="flex items-center gap-1.5 px-2.5 py-1.5">
				<span className="text-muted-foreground">yUSD</span>
				{usdIsZero ? (
					<button
						type="button"
						onClick={handleFaucet}
						disabled={faucetLoading}
						className="font-medium text-amber-500 hover:text-amber-400 cursor-pointer transition-colors disabled:opacity-50"
					>
						{faucetLoading ? "..." : "Faucet"}
					</button>
				) : (
					<span className="font-medium text-foreground">{usdValue !== null ? usdValue.toFixed(2) : "---"}</span>
				)}
			</div>
		</div>
	);
}

export function SiteHeader() {
	const { address, isConnected } = useAccount();
	const [searchOpen, setSearchOpen] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const isOwner = isConnected && address?.toLowerCase() === OWNER_ADDRESS.toLowerCase();

	return (
		<SiteHeaderWrapper className={headerWrapperClasses}>
			<div className={headerContainerClasses} data-header-container>
				<Link href="/" className="flex items-center gap-2" aria-label="Home">
					<PintelLogoThemeAware className="h-12 w-auto" />
				</Link>

				<nav className="hidden sm:flex items-center gap-4">
					<Link
						href="/markets"
						className="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Markets
					</Link>
					{isOwner && (
						<button
							type="button"
							onClick={() => setCreateOpen(true)}
							className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
						>
							Create
						</button>
					)}
				</nav>

				<div className="flex-1" />

				<div className="flex items-center gap-2">
					<SearchTrigger onClick={() => setSearchOpen(true)} />
					{isConnected && <HeaderBalances />}
					<ConnectKitButton.Custom>
						{({ isConnected, isConnecting, show, address }) => (
							<button
								onClick={show}
								className={cn(
									"h-9 cursor-pointer rounded-md border px-3 text-xs font-medium transition-colors",
									isConnected
										? "border-border bg-card text-foreground hover:bg-muted"
										: "border-border bg-foreground text-background hover:bg-foreground/90",
								)}
							>
								{isConnecting
									? "..."
									: isConnected && address
										? formatAddress(address)
										: "Connect"}
							</button>
						)}
					</ConnectKitButton.Custom>
					{isConnected && address && (
						<Link
							href={`/trader/${address}`}
							className="cursor-pointer"
							aria-label="Profile"
						>
							<div
								className="h-8 w-8 rounded-full"
								style={{
									background: `linear-gradient(135deg, hsl(${parseInt(address.slice(2, 6), 16) % 360}, 70%, 60%), hsl(${(parseInt(address.slice(6, 10), 16) % 360)}, 70%, 50%))`,
								}}
							/>
						</Link>
					)}
					<ToggleTheme />
				</div>
			</div>
			<SearchDialog externalOpen={searchOpen} onClose={() => setSearchOpen(false)} />
			<CreateMarketModal open={createOpen} onClose={() => setCreateOpen(false)} />
		</SiteHeaderWrapper>
	);
}
