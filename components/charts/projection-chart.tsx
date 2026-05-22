"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatCompactCurrency, formatCurrency } from "@/lib/domain/money";
import type { ProjectionPoint } from "@/lib/domain/projections";

export function ProjectionChart({ data }: { data: ProjectionPoint[] }) {
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const activePoint = data.find((point) => point.date === selectedDate) ?? data[0];

  return (
    <div className="min-w-0 w-full">
      {activePoint ? (
        <div className="mb-3 grid gap-2 rounded-md border bg-muted/40 p-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Selected date</p>
            <p className="font-semibold">{formatDisplayDate(activePoint.date)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Had I Held</p>
            <p className="font-semibold">{formatCurrency(activePoint.hadHeldValueUsd, "USD")}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Rebuild portfolio</p>
            <p className="font-semibold">{formatCurrency(activePoint.rebuildValueUsd, "USD")}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">AAPL-only gap</p>
            <p className="font-semibold">{formatCurrency(activePoint.gapUsd, "USD")}</p>
          </div>
        </div>
      ) : null}
      <div className="h-96 min-w-0 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 1, height: 384 }}
        >
          <LineChart
            data={data}
            margin={{ top: 28, right: 20, bottom: 0, left: 0 }}
            onMouseMove={(state: unknown) => {
              const chartState = state as {
                activeLabel?: string;
                activePayload?: Array<{ payload?: ProjectionPoint }>;
              };
              const nextDate = chartState.activeLabel ?? chartState.activePayload?.[0]?.payload?.date;
              if (nextDate) {
                setSelectedDate(nextDate);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDisplayDate(String(value))}
              tick={{ fontSize: 12 }}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(value) => formatCompactCurrency(value, "USD")}
              tick={{ fontSize: 12 }}
              width={72}
            />
            <Tooltip
              formatter={(value: unknown, name) => {
                const labels: Record<string, string> = {
                  hadHeldValueUsd: "Had I Held",
                  rebuildValueUsd: "Rebuild Portfolio",
                  gapUsd: "AAPL-Only Gap",
                };
                return [
                  formatCurrency(Number(value || 0), "USD"),
                  labels[String(name)] || String(name),
                ];
              }}
              labelFormatter={(label) => `Date ${formatDisplayDate(String(label))}`}
            />
            {activePoint ? (
              <ReferenceLine
                x={activePoint.date}
                stroke="var(--muted-foreground)"
                strokeDasharray="2 2"
                label={{
                  value: formatDisplayDate(activePoint.date),
                  position: "top",
                  fill: "var(--foreground)",
                  fontSize: 12,
                }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="hadHeldValueUsd"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="rebuildValueUsd"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="gapUsd"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
