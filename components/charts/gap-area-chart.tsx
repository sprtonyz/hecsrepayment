"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatCompactCurrency, formatCurrency } from "@/lib/domain/money";
import type { ValueSeriesPoint } from "@/lib/domain/calculations";

export function GapAreaChart({ data }: { data: ValueSeriesPoint[] }) {
  return (
    <div className="h-72 min-w-0 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 1, height: 288 }}
      >
        <AreaChart data={data} margin={{ top: 12, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatDisplayDate(String(value))}
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value) => formatCompactCurrency(value, "USD")}
            tick={{ fontSize: 12 }}
            width={72}
          />
          <Tooltip
            formatter={(value: unknown) => [
              formatCurrency(Number(value || 0), "USD"),
              "AAPL-Only Gap",
            ]}
            labelFormatter={(label) => `Date ${formatDisplayDate(String(label))}`}
          />
          <Area
            type="monotone"
            dataKey="gapUsd"
            stroke="var(--chart-3)"
            fill="var(--chart-3)"
            fillOpacity={0.22}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
