"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";
import { PintelLogoThemeAware } from "@/components/logos/pintel-theme-aware";
import { ToggleTheme } from "@/components/theme/toggle-theme";
import { YellowStatus } from "@/components/yellow-status";
import { cn } from "@/lib/utils";
import { SiteHeaderWrapper } from "./site-header-wrapper";

const headerWrapperClasses = cn(
	"sticky top-0 z-50 max-w-screen overflow-x-hidden bg-background px-2 pt-2",
	"data-[affix=true]:shadow-[0_0_16px_0_black]/8 dark:data-[affix=true]:shadow-[0_0_16px_0_black]/80",
	"not-dark:data-[affix=true]:**:data-header-container:after:bg-border",
	"transition-shadow duration-300",
);

const headerContainerClasses = cn(
	"screen-line-before screen-line-after mx-auto flex h-12 items-center justify-between gap-2 border-x border-edge px-2 after:z-1 after:transition-[background-color] sm:gap-4 max-w-7xl",
);

export function SiteHeader() {
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
				</nav>

				<div className="flex-1" />

				<div className="flex items-center gap-2">
					<YellowStatus />
					<ConnectKitButton />
					<ToggleTheme />
				</div>
			</div>
		</SiteHeaderWrapper>
	);
}
