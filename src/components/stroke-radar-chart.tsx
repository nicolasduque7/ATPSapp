"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

interface StrokeRadarChartProps {
  forehand: number
  backhand: number
  backhandSlice: number
  volley: number
  serve: number
  dropShot: number
}

const chartConfig = {
  rating: {
    label: "Rating",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function StrokeRadarChart({
  forehand,
  backhand,
  backhandSlice,
  volley,
  serve,
  dropShot,
}: StrokeRadarChartProps) {
  const data = [
    { stroke: "Forehand", rating: forehand },
    { stroke: "Backhand", rating: backhand },
    { stroke: "B. Slice", rating: backhandSlice },
    { stroke: "Volley", rating: volley },
    { stroke: "Serve", rating: serve },
    { stroke: "Drop-shot", rating: dropShot },
  ]

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[130px] w-full">
      <RadarChart data={data}>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <PolarGrid className="stroke-border" />
        <PolarAngleAxis dataKey="stroke" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="rating"
          fill="var(--primary)"
          fillOpacity={0.35}
          stroke="var(--primary)"
          animationDuration={300}
        />
      </RadarChart>
    </ChartContainer>
  )
}
