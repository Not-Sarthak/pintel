"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { LogoAnimation } from "@/components/layout/logo-animation";
import { CrowdCanvas } from "@/components/layout/crowd-canvas";
import { Button } from "@/components/ui/button";

export default function Home() {
	return (
		<div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
			<CrowdCanvas
				src="/images/peeps/all-peeps.png"
				rows={15}
				cols={7}
				className="absolute inset-0 h-full w-full opacity-30"
			/>

			<div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center pb-48">
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
					className="mt-6 text-center text-muted-foreground italic tracking-wide text-xl"
				>
					where people predict <span className="italic font-medium text-foreground">precisely</span> what happens next
				</motion.p>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.7, ease: "easeOut" }}
					className="mt-8"
				>
					<Button asChild>
						<Link href="/markets">Explore Markets</Link>
					</Button>
				</motion.div>
			</div>
		</div>
	);
}
