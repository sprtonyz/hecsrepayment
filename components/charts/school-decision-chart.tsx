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
import type { SchoolDecisionMonth } from "@/lib/domain/schoolDecision";

export function SchoolDecisionChart({ data }: { data: SchoolDecisionMonth[] }) {
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const activePoint = data.find((point) => point.date === selectedDate) ?? data[0];

  return (
    <div className="min-w-0 w-full">
      {activePoint ? (
        <div className="mb-3 grid gap-2 rounded-md border bg-muted/40 p-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Selected date</p>
            <p className="font-semibold">{formatDisplayDate(activePoint.date)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Keep net</p>
            <p className="font-semibold">{formatCurrency(activePoint.keepAaplNetAud, "AUD")}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Pay off + rebuild net</p>
            <p className="font-semibold">{formatCurrency(activePoint.cashOutRebuildNetAud, "AUD")}</p>
          </div>
        </div>
      ) : null}
      <div className="h-72 min-w-0 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 1, height: 288 }}
        >
          <LineChart
            data={data}
            margin={{ top: 28, right: 20, bottom: 0, left: 0 }}
            onMouseMove={(state: unknown) => {
              const chartState = state as {
                activeLabel?: string;
                activePayload?: Array<{ payload?: SchoolDecisionMonth }>;
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
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(value) => formatCompactCurrency(value, "AUD")}
              tick={{ fontSize: 12 }}
              width={72}
            />
            <Tooltip
              formatter={(value: unknown, name) => {
                const labels: Record<string, string> = {
                  keepAaplNetAud: "Keep + Pay Debt",
                  cashOutRebuildNetAud: "Pay Off + Rebuild",
                };
                return [
                  formatCurrency(Number(value || 0), "AUD"),
                  labels[String(name)] || String(name),
                ];
              }}
              labelFormatter={(label) => `Date ${formatDisplayDate(String(label))}`}
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
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
              dataKey="keepAaplNetAud"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="cashOutRebuildNetAud"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
