"use client";

import type React from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { gaussianPdf } from "@/lib/gaussian";
import { CHART_COLORS } from "@/lib/gaussian";

interface PositionCurve {
	mu: number;
	sigma: number;
	label: string;
	color?: string;
}

interface DistributionChartProps {
	positions: PositionCurve[];
	range?: [number, number];
	height?: number;
	showAxes?: boolean;
	showGrid?: boolean;
	showTooltip?: boolean;
	aggregate?: boolean;
}

function computeRange(positions: PositionCurve[]): [number, number] {
	if (positions.length === 0) return [0, 100];
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (const p of positions) {
		min = Math.min(min, p.mu - 4 * p.sigma);
		max = Math.max(max, p.mu + 4 * p.sigma);
	}
	const padding = (max - min) * 0.1;
	return [min - padding, max + padding];
}

function tooltipFormatter(
	positions: PositionCurve[],
	value: number | string | readonly (string | number)[] | undefined,
	name: string | number | undefined,
): [string, string] {
	const numVal = typeof value === "number" ? value : 0;
	const strName = String(name ?? "");
	if (strName === "aggregate") return [numVal.toFixed(6), "Aggregate"];
	const idx = Number.parseInt(strName.replace("p", ""), 10);
	const pos = positions[idx];
	return [numVal.toFixed(6), pos?.label ?? `Position ${idx}`];
}

function tooltipLabelFormatter(label: React.ReactNode): string {
	const numLabel = typeof label === "number" ? label : Number(label);
	if (Number.isNaN(numLabel)) return `Value: ${String(label)}`;
	return `Value: ${Math.abs(numLabel) >= 1000 ? numLabel.toLocaleString() : numLabel.toFixed(2)}`;
}

export function DistributionChart({
	positions,
	range,
	height = 300,
	showAxes = true,
	showGrid = true,
	showTooltip = true,
	aggregate = true,
}: DistributionChartProps) {
	const [min, max] = range ?? computeRange(positions);
	const points = 200;
	const step = (max - min) / (points - 1);

	const data = [];
	for (let i = 0; i < points; i++) {
		const x = min + step * i;
		const point: Record<string, number> = { x };
		let aggY = 0;

		for (let j = 0; j < positions.length; j++) {
			const p = positions[j];
			const y = gaussianPdf(x, p.mu, p.sigma);
			point[`p${j}`] = y;
			aggY += y;
		}

		if (aggregate && positions.length > 0) {
			point.aggregate = aggY / positions.length;
		}

		data.push(point);
	}

	const formatXTick = (value: number) => {
		if (Math.abs(value) >= 1000) {
			return `${(value / 1000).toFixed(0)}k`;
		}
		return value.toFixed(1);
	};

	return (
		<ResponsiveContainer width="100%" height={height}>
			<AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
				{showGrid && (
					<CartesianGrid
						strokeDasharray="3 3"
						stroke="var(--border)"
						opacity={0.5}
					/>
				)}
				{showAxes && (
					<XAxis
						dataKey="x"
						tickFormatter={formatXTick}
						stroke="var(--muted-foreground)"
						fontSize={11}
						tickLine={false}
						axisLine={false}
					/>
				)}
				{showAxes && (
					<YAxis
						stroke="var(--muted-foreground)"
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tickFormatter={(v: number) => v.toFixed(4)}
					/>
				)}
				{showTooltip && (
					<Tooltip
						contentStyle={{
							backgroundColor: "var(--card)",
							border: "1px solid var(--border)",
							borderRadius: "8px",
							fontSize: "12px",
							color: "var(--card-foreground)",
						}}
						formatter={(value, name) =>
							tooltipFormatter(positions, value, name)
						}
						labelFormatter={tooltipLabelFormatter}
					/>
				)}
				{positions.map((p, i) => (
					<Area
						key={`p${i}`}
						type="monotone"
						dataKey={`p${i}`}
						stroke={p.color ?? CHART_COLORS[i % CHART_COLORS.length]}
						fill={p.color ?? CHART_COLORS[i % CHART_COLORS.length]}
						fillOpacity={0.1}
						strokeWidth={1.5}
						dot={false}
						isAnimationActive={false}
					/>
				))}
				{aggregate && positions.length > 0 && (
					<Area
						type="monotone"
						dataKey="aggregate"
						stroke="var(--primary)"
						fill="var(--primary)"
						fillOpacity={0.15}
						strokeWidth={2.5}
						dot={false}
						isAnimationActive={false}
						strokeDasharray="0"
					/>
				)}
			</AreaChart>
		</ResponsiveContainer>
	);
}

export function MiniDistributionChart({
	positions,
	range,
}: {
	positions: PositionCurve[];
	range?: [number, number];
}) {
	const [min, max] = range ?? computeRange(positions);
	const points = 80;
	const step = (max - min) / (points - 1);

	const data = [];
	for (let i = 0; i < points; i++) {
		const x = min + step * i;
		let aggY = 0;
		for (const p of positions) {
			aggY += gaussianPdf(x, p.mu, p.sigma);
		}
		data.push({ x, y: positions.length > 0 ? aggY / positions.length : 0 });
	}

	return (
		<ResponsiveContainer width="100%" height={48}>
			<AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
				<Area
					type="monotone"
					dataKey="y"
					stroke="var(--chart-1)"
					fill="var(--chart-1)"
					fillOpacity={0.2}
					strokeWidth={1.5}
					dot={false}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}
