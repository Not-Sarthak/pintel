import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Web3Provider } from "@/components/providers/web3-provider";
import { YellowProvider } from "@/components/providers/yellow-provider";
import { GithubBadge } from "@/components/github-badge";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeScript } from "@/components/theme/theme-script";
import { Toaster } from "sonner";
import { diagonalGridPattern } from "@/lib/grid-patterns";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
	? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
	: "http://localhost:3000";

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#000000" },
	],
	colorScheme: "light dark",
};

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: "pintel — distribution prediction markets",
	description:
		"On-chain prediction markets powered by Gaussian distributions. Place predictions with confidence intervals and earn from market accuracy.",
	openGraph: {
		title: "pintel — distribution prediction markets",
		description:
			"On-chain prediction markets powered by Gaussian distributions. Place predictions with confidence intervals and earn from market accuracy.",
		images: ["/pintel_og.png"],
	},
	twitter: {
		card: "summary_large_image",
		title: "pintel — distribution prediction markets",
		description:
			"On-chain prediction markets powered by Gaussian distributions. Place predictions with confidence intervals and earn from market accuracy.",
		images: ["/pintel_og.png"],
	},
};

function MainContent({ children }: { children: React.ReactNode }) {
	return (
		<main className="max-w-screen overflow-x-hidden px-2">
			<div className={diagonalGridPattern}>{children}</div>
		</main>
	);
}

function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SiteHeader />
			<MainContent>{children}</MainContent>
			<SiteFooter />
			<GithubBadge />
		</>
	);
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<ThemeScript />
			</head>
			<body className="min-h-screen bg-background font-sans antialiased">
				<ThemeProvider>
					<Web3Provider>
						<YellowProvider>
							<AppShell>{children}</AppShell>
							<Toaster position="top-right" richColors />
						</YellowProvider>
					</Web3Provider>
				</ThemeProvider>
			</body>
		</html>
	);
}
