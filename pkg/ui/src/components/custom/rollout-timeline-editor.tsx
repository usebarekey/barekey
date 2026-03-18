import { useEffect, useMemo, useRef, useState } from "react";
import { addHours, format } from "date-fns";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { RolloutFunction, RolloutMilestone } from "@convex/lib/rollout";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ROLLOUT_FUNCTION_LABELS: Record<RolloutFunction, string> = {
	linear: "Linear",
	step: "Step",
	ease_in_out: "Ease in/out",
};

const ROLLOUT_FUNCTION_OPTIONS: Array<{
	value: RolloutFunction;
	label: string;
}> = [
	{ value: "linear", label: "Linear" },
	{ value: "step", label: "Step" },
	{ value: "ease_in_out", label: "Ease in/out" },
];

const CHART_WIDTH = 640;
const CHART_HEIGHT = 280;
const CHART_PADDING = {
	top: 18,
	right: 22,
	bottom: 34,
	left: 58,
};
const MIN_POINT_GAP_MS = 60_000;
const DEFAULT_TIMELINE_SPAN_MS = 24 * 60 * 60 * 1000;
const NEW_POINT_SPACING_MS = 24 * 60 * 60 * 1000;
const PERCENTAGE_TICKS = [0, 25, 50, 75, 100] as const;

type RolloutTimelineEditorProps = {
	rolloutFunction: RolloutFunction;
	milestones: Array<RolloutMilestone>;
	onFunctionChange: (value: RolloutFunction) => void;
	onMilestonesChange: (value: Array<RolloutMilestone>) => void;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function roundPercentage(value: number): number {
	return Math.round(value * 10) / 10;
}

function parseMilestoneTime(value: string, fallbackMs: number): number {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function sortMilestones(value: Array<RolloutMilestone>): Array<RolloutMilestone> {
	return [...value].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

function toLocalDateTimeInputValue(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return localDate.toISOString().slice(0, 16);
}

function fromLocalDateTimeInputValue(value: string, fallback: string): string {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return fallback;
	}
	return parsed.toISOString();
}

function smoothstep(progress: number): number {
	return progress * progress * (3 - 2 * progress);
}

function buildInterpolationPath(input: {
	points: Array<{ atMs: number; percentage: number }>;
	rolloutFunction: RolloutFunction;
	xForMs: (value: number) => number;
	yForPercentage: (value: number) => number;
}): string {
	const { points, rolloutFunction, xForMs, yForPercentage } = input;
	if (points.length === 0) {
		return "";
	}

	const first = points[0];
	if (first === undefined) {
		return "";
	}

	const commands = [`M ${xForMs(first.atMs)} ${yForPercentage(first.percentage)}`];
	for (let index = 0; index < points.length - 1; index += 1) {
		const current = points[index];
		const next = points[index + 1];
		if (current === undefined || next === undefined) {
			continue;
		}

		if (rolloutFunction === "step") {
			commands.push(`L ${xForMs(next.atMs)} ${yForPercentage(current.percentage)}`);
			commands.push(`L ${xForMs(next.atMs)} ${yForPercentage(next.percentage)}`);
			continue;
		}

		if (rolloutFunction === "ease_in_out") {
			for (let sample = 1; sample <= 12; sample += 1) {
				const progress = sample / 12;
				const easedProgress = smoothstep(progress);
				const atMs = current.atMs + (next.atMs - current.atMs) * progress;
				const percentage =
					current.percentage +
					(next.percentage - current.percentage) * easedProgress;
				commands.push(`L ${xForMs(atMs)} ${yForPercentage(percentage)}`);
			}
			continue;
		}

		commands.push(`L ${xForMs(next.atMs)} ${yForPercentage(next.percentage)}`);
	}

	return commands.join(" ");
}

function buildAreaPath(input: {
	linePath: string;
	points: Array<{ atMs: number; percentage: number }>;
	xForMs: (value: number) => number;
	plotBottom: number;
}): string {
	const { linePath, points, xForMs, plotBottom } = input;
	const first = points[0];
	const last = points[points.length - 1];
	if (!linePath || first === undefined || last === undefined) {
		return "";
	}
	return `${linePath} L ${xForMs(last.atMs)} ${plotBottom} L ${xForMs(first.atMs)} ${plotBottom} Z`;
}

export function RolloutTimelineEditor({
	rolloutFunction,
	milestones,
	onFunctionChange,
	onMilestonesChange,
}: RolloutTimelineEditorProps) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const dragIndexRef = useRef<number | null>(null);
	const [selectedPointIndex, setSelectedPointIndex] = useState(0);

	const sortedMilestones = useMemo(() => sortMilestones(milestones), [milestones]);
	const milestonePoints = useMemo(() => {
		const fallbackMs = Date.now();
		return sortedMilestones.map((milestone) => ({
			atMs: parseMilestoneTime(milestone.at, fallbackMs),
			percentage: clamp(milestone.percentage, 0, 100),
		}));
	}, [sortedMilestones]);
	const activeSelectedPointIndex =
		milestonePoints.length === 0 ? 0 : clamp(selectedPointIndex, 0, milestonePoints.length - 1);

	const timelineDomain = useMemo(() => {
		const first = milestonePoints[0];
		const last = milestonePoints[milestonePoints.length - 1];
		if (first === undefined || last === undefined) {
			const center = Date.now();
			return {
				startMs: center - DEFAULT_TIMELINE_SPAN_MS / 2,
				endMs: center + DEFAULT_TIMELINE_SPAN_MS / 2,
			};
		}

		if (milestonePoints.length === 1) {
			return {
				startMs: first.atMs - DEFAULT_TIMELINE_SPAN_MS / 2,
				endMs: first.atMs + DEFAULT_TIMELINE_SPAN_MS / 2,
			};
		}

		const spanMs = Math.max(last.atMs - first.atMs, DEFAULT_TIMELINE_SPAN_MS / 4);
		const paddingMs = Math.max(spanMs * 0.12, 30 * 60 * 1000);
		return {
			startMs: first.atMs - paddingMs,
			endMs: last.atMs + paddingMs,
		};
	}, [milestonePoints]);

	const plotBounds = {
		left: CHART_PADDING.left,
		right: CHART_WIDTH - CHART_PADDING.right,
		top: CHART_PADDING.top,
		bottom: CHART_HEIGHT - CHART_PADDING.bottom,
	};

	const xForMs = (value: number): number => {
		const range = timelineDomain.endMs - timelineDomain.startMs || 1;
		return plotBounds.left + ((value - timelineDomain.startMs) / range) * (plotBounds.right - plotBounds.left);
	};

	const msForX = (value: number): number => {
		const progress = (value - plotBounds.left) / (plotBounds.right - plotBounds.left || 1);
		return timelineDomain.startMs + progress * (timelineDomain.endMs - timelineDomain.startMs);
	};

	const yForPercentage = (value: number): number =>
		plotBounds.bottom - (value / 100) * (plotBounds.bottom - plotBounds.top);

	const percentageForY = (value: number): number =>
		((plotBounds.bottom - value) / (plotBounds.bottom - plotBounds.top || 1)) * 100;

	const linePath = useMemo(
		() =>
			buildInterpolationPath({
				points: milestonePoints,
				rolloutFunction,
				xForMs,
				yForPercentage,
			}),
		[milestonePoints, rolloutFunction, timelineDomain.endMs, timelineDomain.startMs],
	);

	const areaPath = useMemo(
		() =>
			buildAreaPath({
				linePath,
				points: milestonePoints,
				xForMs,
				plotBottom: plotBounds.bottom,
			}),
		[linePath, milestonePoints, timelineDomain.endMs, timelineDomain.startMs],
	);

	const timeTicks = useMemo(() => {
		return Array.from({ length: 4 }, (_, index) => {
			const progress = index / 3;
			const tickMs =
				timelineDomain.startMs + (timelineDomain.endMs - timelineDomain.startMs) * progress;
			return {
				atMs: tickMs,
				label: format(new Date(tickMs), "MMM d, HH:mm"),
			};
		});
	}, [timelineDomain.endMs, timelineDomain.startMs]);

	function commitMilestones(nextMilestones: Array<RolloutMilestone>): void {
		onMilestonesChange(sortMilestones(nextMilestones));
	}

	function updatePoint(
		index: number,
		nextValue: {
			atMs?: number;
			percentage?: number;
		},
	): void {
		const current = sortedMilestones[index];
		if (current === undefined) {
			return;
		}

		const previous = sortedMilestones[index - 1];
		const next = sortedMilestones[index + 1];
		const currentAtMs = parseMilestoneTime(current.at, Date.now());
		const minimumAtMs =
			previous === undefined
				? timelineDomain.startMs
				: parseMilestoneTime(previous.at, currentAtMs) + MIN_POINT_GAP_MS;
		const maximumAtMs =
			next === undefined
				? timelineDomain.endMs
				: parseMilestoneTime(next.at, currentAtMs) - MIN_POINT_GAP_MS;
		const clampedAtMs = clamp(
			nextValue.atMs ?? currentAtMs,
			minimumAtMs,
			Math.max(maximumAtMs, minimumAtMs),
		);
		const clampedPercentage = roundPercentage(clamp(nextValue.percentage ?? current.percentage, 0, 100));

		const updated = [...sortedMilestones];
		updated[index] = {
			at: new Date(clampedAtMs).toISOString(),
			percentage: clampedPercentage,
		};
		commitMilestones(updated);
		setSelectedPointIndex(index);
	}

	useEffect(() => {
		function handlePointerMove(event: PointerEvent): void {
			if (dragIndexRef.current === null || svgRef.current === null) {
				return;
			}

			const rect = svgRef.current.getBoundingClientRect();
			const x = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
			const y = ((event.clientY - rect.top) / rect.height) * CHART_HEIGHT;
			updatePoint(dragIndexRef.current, {
				atMs: msForX(clamp(x, plotBounds.left, plotBounds.right)),
				percentage: percentageForY(clamp(y, plotBounds.top, plotBounds.bottom)),
			});
		}

		function handlePointerUp(): void {
			dragIndexRef.current = null;
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [milestonePoints, timelineDomain.endMs, timelineDomain.startMs, rolloutFunction, sortedMilestones]);

	const selectedMilestone = sortedMilestones[activeSelectedPointIndex] ?? null;
	const selectedPoint = milestonePoints[activeSelectedPointIndex] ?? null;

	function handleCreatePoint(): void {
		const lastPoint = milestonePoints[milestonePoints.length - 1];
		const nextAt = lastPoint
			? new Date(lastPoint.atMs + NEW_POINT_SPACING_MS).toISOString()
			: new Date().toISOString();
		const nextPercentage = lastPoint?.percentage ?? 0;
		commitMilestones([
			...sortedMilestones,
			{
				at: nextAt,
				percentage: nextPercentage,
			},
		]);
		setSelectedPointIndex(sortedMilestones.length);
	}

	function handleDeletePoint(): void {
		if (selectedMilestone === null || sortedMilestones.length <= 1) {
			return;
		}
		const nextMilestones = sortedMilestones.filter((_, index) => index !== activeSelectedPointIndex);
		commitMilestones(nextMilestones);
		setSelectedPointIndex(Math.max(0, activeSelectedPointIndex - 1));
	}

	return (
		<div className="space-y-4">
			<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
				<div className="space-y-1.5">
					<Label>Function</Label>
					<Select
						value={rolloutFunction}
						onValueChange={(value) => {
							if (value === "linear" || value === "step" || value === "ease_in_out") {
								onFunctionChange(value);
							}
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue displayNameMap={ROLLOUT_FUNCTION_LABELS} />
						</SelectTrigger>
						<SelectContent>
							{ROLLOUT_FUNCTION_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label>Rollout points</Label>
					<div className="flex h-9 items-center rounded-lg border bg-secondary/30 px-3 text-sm text-muted-foreground">
						{milestonePoints.length} point{milestonePoints.length === 1 ? "" : "s"}
					</div>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-gradient-to-br from-secondary/20 via-background to-background">
				<div className="border-b px-4 py-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-sm font-medium">Rollout timeline</p>
							<p className="text-xs text-muted-foreground">
								Drag points to change when value B ramps up.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button type="button" size="sm" variant="outline" onClick={handleCreatePoint}>
								<IconPlus className="size-3.5" />
								Create point
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={handleDeletePoint}
								disabled={selectedMilestone === null || sortedMilestones.length <= 1}
							>
								<IconTrash className="size-3.5" />
								Delete point
							</Button>
						</div>
					</div>
				</div>

				<div className="p-4">
					<svg
						ref={svgRef}
						viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
						className="block w-full select-none touch-none"
						aria-label="Rollout timeline graph"
					>
						<defs>
							<linearGradient id="rollout-area" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
								<stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
							</linearGradient>
						</defs>

						<rect
							x={plotBounds.left}
							y={plotBounds.top}
							width={plotBounds.right - plotBounds.left}
							height={plotBounds.bottom - plotBounds.top}
							className="fill-background"
							rx="12"
						/>

						{PERCENTAGE_TICKS.map((tick) => {
							const y = yForPercentage(tick);
							return (
								<g key={tick}>
									<line
										x1={plotBounds.left}
										x2={plotBounds.right}
										y1={y}
										y2={y}
										className="stroke-border"
										strokeDasharray={tick === 0 || tick === 100 ? "0" : "4 6"}
									/>
									<text
										x={plotBounds.left - 12}
										y={y + 4}
										textAnchor="end"
										className="fill-muted-foreground text-[10px]"
									>
										{tick}%
									</text>
								</g>
							);
						})}

						{timeTicks.map((tick) => {
							const x = xForMs(tick.atMs);
							return (
								<g key={tick.atMs}>
									<line
										x1={x}
										x2={x}
										y1={plotBounds.top}
										y2={plotBounds.bottom}
										className="stroke-border/70"
										strokeDasharray="3 7"
									/>
									<text
										x={x}
										y={plotBounds.bottom + 20}
										textAnchor="middle"
										className="fill-muted-foreground text-[10px]"
									>
										{tick.label}
									</text>
								</g>
							);
						})}

						{areaPath ? (
							<path
								d={areaPath}
								fill="url(#rollout-area)"
								className="text-primary"
							/>
						) : null}

						{linePath ? (
							<path
								d={linePath}
								fill="none"
								className="stroke-primary"
								strokeWidth="3"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						) : null}

						{milestonePoints.map((point, index) => {
							const isSelected = index === activeSelectedPointIndex;
							return (
								<g key={`${point.atMs}-${point.percentage}-${index}`}>
									<circle
										cx={xForMs(point.atMs)}
										cy={yForPercentage(point.percentage)}
										r={isSelected ? 9 : 7}
										className={cn(
											"cursor-grab stroke-background transition-all active:cursor-grabbing",
											isSelected ? "fill-primary" : "fill-primary/80",
										)}
										strokeWidth="3"
										onPointerDown={(event) => {
											event.preventDefault();
											dragIndexRef.current = index;
											setSelectedPointIndex(index);
										}}
										onClick={() => setSelectedPointIndex(index)}
									/>
									{isSelected ? (
										<circle
											cx={xForMs(point.atMs)}
											cy={yForPercentage(point.percentage)}
											r="14"
											className="fill-primary/10"
											pointerEvents="none"
										/>
									) : null}
								</g>
							);
						})}
					</svg>
				</div>
			</div>

			<div className="grid gap-3 rounded-xl border bg-secondary/15 p-4 md:grid-cols-[minmax(0,1fr)_160px]">
				<div className="space-y-1.5">
					<Label htmlFor="rollout-point-at">Selected point time</Label>
					<Input
						id="rollout-point-at"
						type="datetime-local"
						value={selectedMilestone ? toLocalDateTimeInputValue(selectedMilestone.at) : ""}
						onChange={(event) => {
							if (selectedMilestone === null) {
								return;
							}
							updatePoint(activeSelectedPointIndex, {
								atMs: Date.parse(
									fromLocalDateTimeInputValue(
										event.currentTarget.value,
										selectedMilestone.at,
									),
								),
							});
						}}
						disabled={selectedMilestone === null}
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="rollout-point-percentage">Value B percentage</Label>
					<Input
						id="rollout-point-percentage"
						type="number"
						min={0}
						max={100}
						step={0.1}
						value={selectedPoint ? String(selectedPoint.percentage) : ""}
						onChange={(event) => {
							if (selectedMilestone === null) {
								return;
							}
							updatePoint(activeSelectedPointIndex, {
								percentage: Number(event.currentTarget.value),
							});
						}}
						disabled={selectedMilestone === null}
					/>
				</div>
			</div>

			{selectedPoint ? (
				<p className="text-xs text-muted-foreground">
					Selected point: {format(new Date(selectedMilestone?.at ?? addHours(new Date(), 0)), "MMM d, yyyy HH:mm")} at{" "}
					{selectedPoint.percentage.toFixed(1)}% for value B.
				</p>
			) : null}
		</div>
	);
}
