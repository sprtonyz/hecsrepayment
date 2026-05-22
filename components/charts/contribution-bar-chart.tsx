"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/domain/money";

export function ContributionBarChart({
  contributionsUsd,
  gainUsd,
}: {
  contributionsUsd: number;
  gainUsd: number;
}) {
  const data = [
    { name: "Contributions", value: contributionsUsd },
    { name: "Portfolio gain", value: gainUsd },
  ];

  return (
    <div className="h-64 min-w-0 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 1, height: 256 }}
      >
        <BarChart data={data} margin={{ top: 12, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={(value) => formatCompactCurrency(value, "USD")}
            tick={{ fontSize: 12 }}
            width={72}
          />
          <Tooltip formatter={(value: unknown) => formatCurrency(Number(value || 0), "USD")} />
          <Bar dataKey="value" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
