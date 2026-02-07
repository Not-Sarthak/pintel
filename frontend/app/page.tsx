"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { LogoAnimation } from "@/components/layout/logo-animation";
import { Button } from "@/components/ui/button";
import { contentContainer } from "@/lib/grid-patterns";

export default function Home() {
	return (
		<div className={contentContainer}>
			<div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="w-full max-w-[18rem]"
				>
					<LogoAnimation className="w-full" />
				</motion.div>

				<motion.p
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
					className="mt-6 text-center text-sm text-muted-foreground max-w-md mx-auto leading-relaxed"
				>
					Because higher precision deserves higher returns
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
