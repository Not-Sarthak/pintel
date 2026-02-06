"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { LogoAnimation } from "@/components/logo-animation";
import { Button } from "@/components/ui/button";
import { contentContainer } from "@/lib/grid-patterns";

export default function Home() {
	return (
		<div className={contentContainer}>
			<div className="flex flex-col items-center justify-center py-16 md:py-24 bg-background">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="w-full max-w-xl"
				>
					<LogoAnimation className="w-full" />
				</motion.div>

				<motion.p
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
					className="mt-6 text-center text-sm text-muted-foreground max-w-md mx-auto leading-relaxed"
				>
					On-chain prediction markets powered by Gaussian distributions.
					Place predictions with confidence intervals and earn from market accuracy.
				</motion.p>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.7, ease: "easeOut" }}
					className="mt-8 flex items-center gap-3"
				>
					<Button asChild>
						<Link href="/markets">Explore Markets</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link href="/create">Create Market</Link>
					</Button>
				</motion.div>
			</div>
		</div>
	);
}
