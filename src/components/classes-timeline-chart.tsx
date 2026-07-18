"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Slider } from "@/components/ui/slider"
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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
}

function formatTooltipLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date)
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

  return (
    <div className="rounded-3xl bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold text-foreground">Classes Timeline</h2>
        <span className="text-sm text-muted-foreground">{rangeLabel}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Classes scheduled per day, {halfWidth} days back and forward from today.
      </p>

      <ChartContainer config={chartConfig} className="mt-6 aspect-auto h-56 w-full">
        <BarChart data={visibleData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
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
            cursor={{ fill: "var(--muted)" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload?.[0] ? formatTooltipLabel(payload[0].payload.date) : ""
                }
              />
            }
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {visibleData.map((d) => (
              <Cell
                key={d.dayOffset}
                fill={
                  d.dayOffset === 0
                    ? "var(--primary)"
                    : "color-mix(in oklch, var(--primary) 45%, transparent)"
                }
              />
            ))}
          </Bar>
        </BarChart>
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
