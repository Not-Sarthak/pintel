export function gaussianPdf(x: number, mu: number, sigma: number): number {
	if (sigma <= 0) return 0;
	const coefficient = 1 / (sigma * Math.sqrt(2 * Math.PI));
	const exponent = -((x - mu) ** 2) / (2 * sigma ** 2);
	return coefficient * Math.exp(exponent);
}

export function computePositionFairValue(
	posMu: number,
	posSigma: number,
	allPositions: { mu: number; sigma: number }[],
	totalPool: number,
	aggMu: number,
): number {
	if (allPositions.length === 0 || totalPool <= 0) return 0;
	const pdfSum = allPositions.reduce(
		(sum, p) => sum + gaussianPdf(aggMu, p.mu, p.sigma),
		0,
	);
	if (pdfSum <= 0) return 0;
	const posPdf = gaussianPdf(aggMu, posMu, posSigma);
	return totalPool * (posPdf / pdfSum);
}

export function formatAddress(addr: string): string {
	if (!addr || addr.length < 10) return addr;
	return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatCountdown(endTimeSeconds: number): string {
	const now = Date.now() / 1000;
	const diff = endTimeSeconds - now;

	if (diff <= 0) return "Ended";

	const days = Math.floor(diff / 86400);
	const hours = Math.floor((diff % 86400) / 3600);
	const minutes = Math.floor((diff % 3600) / 60);
	const seconds = Math.floor(diff % 60);

	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

export function formatUSD(amount: number | string): string {
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(num);
}

export const CATEGORIES = ["All", "Crypto"];

export const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];
