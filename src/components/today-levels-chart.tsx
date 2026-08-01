"use client"

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"
import { useTranslations } from "next-intl"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { LevelClassCount } from "@/lib/mock-data"

interface TodayLevelsChartProps {
  data: LevelClassCount[]
}

const chartConfig = {
  count: {
    label: "Classes",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function TodayLevelsChart({ data }: TodayLevelsChartProps) {
  const t = useTranslations("dashboard")
  const hasClasses = data.some((d) => d.count > 0)
  const maxCount = Math.max(1, ...data.map((d) => d.count))

  if (!hasClasses) {
    return (
      <p className="flex h-[130px] items-center text-sm text-muted-foreground">
        {t("noClassesToday")}
      </p>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[130px] w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
        barCategoryGap={4}
      >
        <XAxis type="number" domain={[0, maxCount]} hide />
        <YAxis
          dataKey="level"
          type="category"
          tickLine={false}
          axisLine={false}
          width={28}
          fontSize={10}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar
          dataKey="count"
          fill="var(--primary)"
          radius={[0, 4, 4, 0]}
          maxBarSize={8}
          animationDuration={300}
          animationEasing="ease-out"
        >
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground text-xs font-medium"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
