"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/gaussian";

interface CountdownProps {
	endTime: number;
	className?: string;
}

export function Countdown({ endTime, className }: CountdownProps) {
	const [display, setDisplay] = useState(() => formatCountdown(endTime));

	useEffect(() => {
		const interval = setInterval(() => {
			setDisplay(formatCountdown(endTime));
		}, 1000);
		return () => clearInterval(interval);
	}, [endTime]);

	return <span className={className}>{display}</span>;
}
