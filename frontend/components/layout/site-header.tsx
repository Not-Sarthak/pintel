"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { PintelLogoThemeAware } from "@/components/logos/pintel-theme-aware";
import { ToggleTheme } from "@/components/theme/toggle-theme";
import { YellowStatus } from "@/components/market/yellow-status";
import { SearchDialog, SearchTrigger } from "@/components/layout/search-dialog";
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

export function SiteHeader() {
	const { address, isConnected } = useAccount();
	const [searchOpen, setSearchOpen] = useState(false);

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
					<Link
						href="/create"
						className="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Create
					</Link>
					{isConnected && address && (
						<Link
							href={`/trader/${address}`}
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							Profile
						</Link>
					)}
				</nav>

				<div className="flex-1" />

				<div className="flex items-center gap-2">
					<SearchTrigger onClick={() => setSearchOpen(true)} />
					<YellowStatus />
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
					<ToggleTheme />
				</div>
			</div>
			<SearchDialog externalOpen={searchOpen} onClose={() => setSearchOpen(false)} />
		</SiteHeaderWrapper>
	);
}
