"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, LabelList, XAxis, YAxis, type DotItemDotProps, type LabelProps } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Slider } from "@/components/ui/slider"
import { formatClubDate } from "@/lib/dates"
import type { DailyClassCount } from "@/lib/mock-data"

interface ClassesTimelineChartProps {
  data: DailyClassCount[]
}

const MIN_HALF_WIDTH = 3
const MAX_HALF_WIDTH = 14
const DEFAULT_HALF_WIDTH = 7

const chartConfig = {
  count: {
    label: "Classes",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function formatAxisTick(date: Date): string {
  return formatClubDate(date, "MMM d")
}

function formatTooltipLabel(date: Date): string {
  return formatClubDate(date, "EEEE, MMM d")
}

export function ClassesTimelineChart({ data }: ClassesTimelineChartProps) {
  const [halfWidth, setHalfWidth] = useState(DEFAULT_HALF_WIDTH)

  const visibleData = useMemo(
    () => data.filter((d) => Math.abs(d.dayOffset) <= halfWidth),
    [data, halfWidth]
  )

  const tickInterval = visibleData.length > 14 ? Math.ceil(visibleData.length / 10) : 0

  const rangeLabel = useMemo(() => {
    if (visibleData.length === 0) return ""
    const first = visibleData[0].date
    const last = visibleData[visibleData.length - 1].date
    return `${formatAxisTick(first)} – ${formatAxisTick(last)}`
  }, [visibleData])

  function renderDot({ cx, cy, payload }: DotItemDotProps) {
    if (cx === undefined || cy === undefined || payload == null) return <g key={`${cx}-${cy}`} />
    const point = payload as DailyClassCount
    const isToday = point.dayOffset === 0
    return (
      <circle
        key={point.dayOffset}
        cx={cx}
        cy={cy}
        r={isToday ? 5 : 3.5}
        fill={isToday ? "var(--primary)" : "color-mix(in oklch, var(--primary) 55%, transparent)"}
        stroke="var(--card)"
        strokeWidth={2}
      />
    )
  }

  function renderCountLabel({ x, y, value, index }: LabelProps): React.ReactElement | null {
    if (x === undefined || y === undefined || index === undefined) return null
    // Unlike the `dot` render prop above, recharts' LabelList doesn't forward
    // `payload` to this callback (it filters entries through an SVG/ARIA
    // attribute allow-list first) — index is the only per-point key we get,
    // and it isn't guaranteed to stay within visibleData's bounds while the
    // slider changes halfWidth mid-animation.
    if (index < 0 || index >= visibleData.length) return null
    const isToday = visibleData[index].dayOffset === 0
    return (
      <text
        x={x}
        y={Number(y) - 10}
        textAnchor="middle"
        className={
          isToday
            ? "fill-foreground text-[11px] font-bold"
            : "fill-muted-foreground text-[10px] font-medium"
        }
      >
        {value}
      </text>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 delay-300 motion-reduce:animate-none rounded-3xl bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold text-foreground">Classes Timeline</h2>
        <span className="text-sm text-muted-foreground">{rangeLabel}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Classes scheduled per day, {halfWidth} days back and forward from today.
      </p>

      <ChartContainer config={chartConfig} className="mt-6 aspect-auto h-56 w-full">
        <AreaChart data={visibleData} margin={{ left: 0, right: 0, top: 20, bottom: 0 }}>
          <CartesianGrid vertical={false} className="stroke-border" />
          <XAxis
            dataKey="date"
            tickFormatter={(value: Date) => formatAxisTick(value)}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
            tickMargin={8}
            fontSize={11}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} fontSize={11} />
          <ChartTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: 3 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload?.[0] ? formatTooltipLabel(payload[0].payload.date) : ""
                }
              />
            }
          />
          <Area
            dataKey="count"
            type="monotone"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="var(--primary)"
            fillOpacity={0.1}
            dot={renderDot}
            activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
            animationDuration={300}
            animationEasing="ease-out"
          >
            <LabelList dataKey="count" content={renderCountLabel} />
          </Area>
        </AreaChart>
      </ChartContainer>

      <div className="mt-6 flex items-center gap-4">
        <span className="text-xs text-muted-foreground">{MIN_HALF_WIDTH}d</span>
        <Slider
          value={[halfWidth]}
          onValueChange={(value) => setHalfWidth(Array.isArray(value) ? value[0] : value)}
          min={MIN_HALF_WIDTH}
          max={MAX_HALF_WIDTH}
          step={1}
          className="flex-1"
          aria-label="Days shown before and after today"
        />
        <span className="text-xs text-muted-foreground">{MAX_HALF_WIDTH}d</span>
      </div>
    </div>
  )
}
