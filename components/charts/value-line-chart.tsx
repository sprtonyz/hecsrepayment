"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatCompactCurrency, formatCurrency } from "@/lib/domain/money";
import type { ValueSeriesPoint } from "@/lib/domain/calculations";

export function ValueLineChart({ data }: { data: ValueSeriesPoint[] }) {
  return (
    <div className="h-80 min-w-0 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 1, height: 320 }}
      >
        <LineChart data={data} margin={{ top: 12, right: 20, bottom: 0, left: 0 }}>
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
            formatter={(value: unknown, name) => [
              formatCurrency(Number(value || 0), "USD"),
              name === "hadHeldUsd" ? "Had I Held" : "Rebuild Portfolio",
            ]}
            labelFormatter={(label) => `Date ${formatDisplayDate(String(label))}`}
          />
          <Line
            type="monotone"
            dataKey="hadHeldUsd"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="rebuildUsd"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
