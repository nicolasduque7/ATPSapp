"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("strokeRadar")
  const data = [
    { stroke: t("forehand"), rating: forehand },
    { stroke: t("backhand"), rating: backhand },
    { stroke: t("backhandSliceShort"), rating: backhandSlice },
    { stroke: t("volley"), rating: volley },
    { stroke: t("serve"), rating: serve },
    { stroke: t("dropShot"), rating: dropShot },
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
