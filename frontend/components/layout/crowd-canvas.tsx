"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";

interface CrowdCanvasProps {
	src: string;
	rows?: number;
	cols?: number;
	className?: string;
}

type Peep = {
	image: HTMLImageElement;
	rect: number[];
	width: number;
	height: number;
	x: number;
	y: number;
	anchorY: number;
	scaleX: number;
	walk: gsap.core.Timeline | null;
	setRect: (rect: number[]) => void;
	render: (ctx: CanvasRenderingContext2D) => void;
};

export function CrowdCanvas({
	src,
	rows = 15,
	cols = 7,
	className,
}: CrowdCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const randomRange = (min: number, max: number) =>
			min + Math.random() * (max - min);
		const randomIndex = (arr: unknown[]) => (randomRange(0, arr.length) | 0);
		const removeFromArray = (arr: unknown[], i: number) => arr.splice(i, 1)[0];
		const removeItemFromArray = (arr: unknown[], item: unknown) =>
			removeFromArray(arr, arr.indexOf(item));
		const removeRandomFromArray = (arr: unknown[]) =>
			removeFromArray(arr, randomIndex(arr));
		const getRandomFromArray = <T,>(arr: T[]) => arr[randomIndex(arr) | 0];

		const stage = { width: 0, height: 0 };
		const allPeeps: Peep[] = [];
		const availablePeeps: Peep[] = [];
		const crowd: Peep[] = [];

		const createPeep = (image: HTMLImageElement, rect: number[]): Peep => {
			const peep: Peep = {
				image,
				rect: [],
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				anchorY: 0,
				scaleX: 1,
				walk: null,
				setRect(r: number[]) {
					this.rect = r;
					this.width = r[2];
					this.height = r[3];
				},
				render(c: CanvasRenderingContext2D) {
					c.save();
					c.translate(this.x, this.y);
					c.scale(this.scaleX, 1);
					c.drawImage(
						this.image,
						this.rect[0],
						this.rect[1],
						this.rect[2],
						this.rect[3],
						0,
						0,
						this.width,
						this.height,
					);
					c.restore();
				},
			};
			peep.setRect(rect);
			return peep;
		};

		const resetPeep = (peep: Peep) => {
			const direction = Math.random() > 0.5 ? 1 : -1;
			const offsetY =
				100 - 250 * gsap.parseEase("power2.in")(Math.random());
			const startY = stage.height - peep.height + offsetY;
			let startX: number;
			let endX: number;

			if (direction === 1) {
				startX = -peep.width;
				endX = stage.width;
				peep.scaleX = 1;
			} else {
				startX = stage.width + peep.width;
				endX = 0;
				peep.scaleX = -1;
			}

			peep.x = startX;
			peep.y = startY;
			peep.anchorY = startY;

			return { startX, startY, endX };
		};

		const normalWalk = (peep: Peep, props: { startY: number; endX: number }) => {
			const xDuration = 10;
			const yDuration = 0.25;
			const tl = gsap.timeline();
			tl.timeScale(randomRange(0.5, 1.5));
			tl.to(peep, { duration: xDuration, x: props.endX, ease: "none" }, 0);
			tl.to(
				peep,
				{
					duration: yDuration,
					repeat: xDuration / yDuration,
					yoyo: true,
					y: props.startY - 10,
				},
				0,
			);
			return tl;
		};

		const addPeepToCrowd = (): Peep => {
			const peep = removeRandomFromArray(availablePeeps) as Peep;
			const props = resetPeep(peep);
			const walk = normalWalk(peep, props).eventCallback(
				"onComplete",
				() => {
					removePeepFromCrowd(peep);
					addPeepToCrowd();
				},
			);
			peep.walk = walk;
			crowd.push(peep);
			crowd.sort((a, b) => a.anchorY - b.anchorY);
			return peep;
		};

		const removePeepFromCrowd = (peep: Peep) => {
			removeItemFromArray(crowd, peep);
			availablePeeps.push(peep);
		};

		const render = () => {
			if (!canvas) return;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.save();
			ctx.scale(devicePixelRatio, devicePixelRatio);
			for (const peep of crowd) {
				peep.render(ctx);
			}
			ctx.restore();
		};

		const resize = () => {
			if (!canvas) return;
			stage.width = canvas.clientWidth;
			stage.height = canvas.clientHeight;
			canvas.width = stage.width * devicePixelRatio;
			canvas.height = stage.height * devicePixelRatio;

			for (const peep of crowd) {
				peep.walk?.kill();
			}
			crowd.length = 0;
			availablePeeps.length = 0;
			availablePeeps.push(...allPeeps);

			while (availablePeeps.length) {
				addPeepToCrowd().walk?.progress(Math.random());
			}
		};

		const img = new Image();
		img.onload = () => {
			const { naturalWidth: w, naturalHeight: h } = img;
			const total = rows * cols;
			const rw = w / rows;
			const rh = h / cols;
			for (let i = 0; i < total; i++) {
				allPeeps.push(
					createPeep(img, [
						(i % rows) * rw,
						((i / rows) | 0) * rh,
						rw,
						rh,
					]),
				);
			}
			resize();
			gsap.ticker.add(render);
		};
		img.src = src;

		window.addEventListener("resize", resize);
		return () => {
			window.removeEventListener("resize", resize);
			gsap.ticker.remove(render);
			for (const peep of crowd) {
				peep.walk?.kill();
			}
		};
	}, [src, rows, cols]);

	return <canvas ref={canvasRef} className={className} />;
}
