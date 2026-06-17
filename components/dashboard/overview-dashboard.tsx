"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LineChart,
  ListChecks,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { calculateCatchUpMetrics } from "@/lib/domain/calculations";
import { calculateDepositGuide } from "@/lib/domain/depositGuide";
import { todayIso } from "@/lib/domain/dates";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import { cn } from "@/lib/utils";

export function DashboardOverview() {
  const tracker = useTrackerData();
  const {
    snapshot,
    settings,
    saleEvent,
    currentPriceUsd,
    latestUsdToAudRate,
    latestAudToUsdRate,
    isLoading,
    isRefreshing,
  } = tracker;

  const asOfDate = todayIso();

  const metrics = useMemo(
    () =>
      calculateCatchUpMetrics({
        settings,
        saleEvent,
        contributions: snapshot.contributions,
        trades: snapshot.trades,
        dividends: settings.includeDividends ? snapshot.dividends : [],
        splits: settings.includeSplits ? snapshot.splits : [],
        currentPriceUsd,
        latestUsdToAudRate,
        asOfDate,
      }),
    [
      asOfDate,
      currentPriceUsd,
      latestUsdToAudRate,
      saleEvent,
      settings,
      snapshot.contributions,
      snapshot.dividends,
      snapshot.splits,
      snapshot.trades,
    ],
  );

  const depositGuide = useMemo(
    () =>
      calculateDepositGuide({
        planMonthlyContributionAud: settings.planMonthlyContributionAud,
        contributions: snapshot.contributions,
        dailyPrices: snapshot.dailyPrices,
        currentPriceUsd,
        latestUsdToAudRate,
        asOfDate,
        planStartDate: settings.planStartDate,
      }),
    [
      asOfDate,
      currentPriceUsd,
      latestUsdToAudRate,
      settings.planMonthlyContributionAud,
      settings.planStartDate,
      snapshot.contributions,
      snapshot.dailyPrices,
    ],
  );

  const currentMonthContributionAud = useMemo(
    () => calculateCurrentMonthContributionAud(snapshot.contributions, asOfDate, latestUsdToAudRate),
    [asOfDate, latestUsdToAudRate, snapshot.contributions],
  );

  const progressPercent =
    settings.planMonthlyContributionAud > 0
      ? Math.min(100, (currentMonthContributionAud / settings.planMonthlyContributionAud) * 100)
      : 0;

  const currency = settings.displayCurrency;
  const convert = (amountAud: number) =>
    currency === "USD" ? amountAud * latestAudToUsdRate : amountAud;

  const formatMoney = (amountAud: number, digits = 0) => {
    const amount = convert(amountAud);
    const intlCurrency = currency === "USD" ? "USD" : "AUD";
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-AU", {
      style: "currency",
      currency: intlCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  };

  const heroAhead = metrics.paceDifferenceAud >= 0;
  const heroValue = formatMoney(Math.abs(metrics.paceDifferenceAud));
  const heroLabel = heroAhead ? "You are ahead this month" : "You are behind this month";
  const heroSummary = heroAhead
    ? `You've logged ${formatMoney(currentMonthContributionAud)} so far, which is ${heroValue} above the expected pace.`
    : `You've logged ${formatMoney(currentMonthContributionAud)} so far, which is ${heroValue} short of the expected pace.`;
  const gapRemainingAud = Math.max(0, depositGuide.remainingThisMonthAud);
  const catchUpLabel = metrics.catchUpGapAud >= 0 ? "Gap remaining" : "Ahead of plan";
  const catchUpValue = formatMoney(Math.abs(metrics.catchUpGapAud));
  const statusLabel =
    progressPercent >= 95 ? "On track" : depositGuide.direction === "increase" ? "Needs attention" : "On track";
  const recentBars = useMemo(() => buildRecentContributionBars(snapshot.contributions, asOfDate), [asOfDate, snapshot.contributions]);

  return (
    <AppShell title="Dashboard" subtitle="See your status at a glance. Less jargon, more meaning.">
      <div className="grid gap-4 lg:gap-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_20rem]">
          <Card className="bg-[#fbfbf7]">
            <CardContent className="p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-emerald-600">{heroLabel}</p>
                  <p className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                    {heroValue} ahead
                  </p>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {heroSummary}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_21rem]">
                  <div className="rounded-[1.6rem] border border-emerald-100 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Monthly pace</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                          {formatMoney(currentMonthContributionAud)}
                        </p>
                      </div>
                      <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        {Math.round(progressPercent)}% logged
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={progressPercent} className="h-3 bg-slate-100" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {formatMoney(gapRemainingAud)} remains to hit the monthly target of {formatMoney(settings.planMonthlyContributionAud)}.
                    </p>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-sm font-semibold text-emerald-600">On track</p>
                    <p className="mt-3 text-sm font-medium text-slate-500">Progress</p>
                    <div className="mt-2">
                      <Progress value={Math.max(10, Math.min(100, metrics.catchUpProgressPercent))} className="h-3 bg-slate-100" />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {Math.round(metrics.catchUpProgressPercent)}% of the catch-up target is already covered.
                      Only one clear decision remains: keep logging, pause, or review the plan.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-5 sm:p-6">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{statusLabel}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Progress</p>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Updated now
                  </Badge>
                </div>

                <div className="mt-4">
                  <Progress value={Math.min(100, progressPercent)} className="h-3 bg-slate-100" />
                </div>

                <div className="mt-5 flex-1 rounded-[1.4rem] bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {Math.round(progressPercent)}% of the monthly target is already logged.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {formatMoney(gapRemainingAud)} is the only number left to close if the goal is to stay on the same track.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MiniMetricCard
            color="emerald"
            icon={<Wallet className="h-4 w-4" />}
            label="Logged this month"
            value={formatMoney(currentMonthContributionAud)}
            note="Matches the plan so far."
          />
          <MiniMetricCard
            color="blue"
            icon={<Target className="h-4 w-4" />}
            label="Target this month"
            value={formatMoney(settings.planMonthlyContributionAud)}
            note="What is still expected."
          />
          <MiniMetricCard
            color="amber"
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Gap to close"
            value={catchUpValue}
            note={catchUpLabel}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <Card className="bg-white">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">What needs attention</p>
                  <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                    Three plain-language prompts replace the old long checklist.
                  </h2>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  3 actions
                </Badge>
              </div>

              <div className="mt-5 grid gap-3">
                <ActionRow
                  tone="emerald"
                  icon={<Wallet className="h-4 w-4" />}
                  title="Log today's deposit"
                  text="One tap gets you back on track."
                  cta="Do now"
                  href="/transactions"
                />
                <ActionRow
                  tone="amber"
                  icon={<ListChecks className="h-4 w-4" />}
                  title="Review transactions"
                  text="Check for anything that looks wrong."
                  cta="Check"
                  href="/transactions"
                />
                <ActionRow
                  tone="blue"
                  icon={<LineChart className="h-4 w-4" />}
                  title="Open projections"
                  text="See how this month changes the story."
                  cta="View"
                  href="/projections"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Recent activity</p>
                  <h2 className="mt-2 max-w-md text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                    A visual feed that feels like a timeline, not a spreadsheet.
                  </h2>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  10 months
                </Badge>
              </div>

              <div className="mt-6 rounded-[1.6rem] bg-slate-50 p-4">
                <div className="flex h-56 items-end gap-3">
                  {recentBars.map((bar) => (
                    <div key={`${bar.label}-${bar.index}`} className="flex min-h-0 flex-1 flex-col items-center justify-end gap-2">
                      <div className="flex h-full w-full items-end justify-center">
                        <div
                          className={cn(
                            "w-5 rounded-full shadow-[0_14px_24px_rgba(59,109,246,0.18)]",
                            bar.tint === "blue" && "bg-[#5f88f8]",
                            bar.tint === "emerald" && "bg-[#28c08d]",
                            bar.tint === "amber" && "bg-[#f0b83c]",
                          )}
                          style={{ height: `${Math.max(18, bar.height)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-500">
                This trend card stays visual so the user does not have to decode a table.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="Today"
            value={formatMoney(currentMonthContributionAud)}
            note="Deposit logged"
            icon={<Clock3 className="h-4 w-4" />}
          />
          <InfoCard
            title="Plan"
            value={formatMoney(settings.planMonthlyContributionAud)}
            note="Monthly target"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <InfoCard
            title="Catch-up"
            value={catchUpValue}
            note={catchUpLabel}
            icon={<ArrowRight className="h-4 w-4" />}
          />
        </section>

        {isLoading ? <p className="px-1 text-sm text-slate-500">Loading your local tracker...</p> : null}
        {isRefreshing ? <p className="px-1 text-sm text-slate-500">Refreshing market data...</p> : null}
      </div>
    </AppShell>
  );
}

function MiniMetricCard({
  color,
  icon,
  label,
  value,
  note,
}: {
  color: "emerald" | "blue" | "amber";
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  const palette =
    color === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : color === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-blue-50 text-blue-600";

  return (
    <Card className="bg-white">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{note}</p>
          </div>
          <div className={cn("rounded-2xl p-2.5", palette)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({
  tone,
  icon,
  title,
  text,
  cta,
  href,
}: {
  tone: "emerald" | "amber" | "blue";
  icon: React.ReactNode;
  title: string;
  text: string;
  cta: string;
  href: string;
}) {
  const accent =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-blue-50 text-blue-600";

  return (
    <div className="flex items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-[#fcfcff] p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className={cn("rounded-2xl p-2.5", accent)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
      <Button asChild size="sm" variant="outline" className="border-slate-200 bg-white text-slate-700">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

function InfoCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="bg-[#0f1830] text-white">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-2 text-sm text-slate-400">{note}</p>
          </div>
          <div className="rounded-2xl bg-white/8 p-2.5 text-slate-200">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function calculateCurrentMonthContributionAud(
  contributions: Array<{ date: string; currencyEntered: string; amount: number; amountUsd: number }>,
  asOfDate: string,
  latestUsdToAudRate: number,
) {
  const month = asOfDate.slice(0, 7);
  return contributions
    .filter((contribution) => contribution.date.slice(0, 7) === month)
    .reduce((total, contribution) => {
      if (contribution.currencyEntered === "AUD") {
        return total + contribution.amount;
      }
      return total + contribution.amountUsd * latestUsdToAudRate;
    }, 0);
}

function buildRecentContributionBars(
  contributions: Array<{ date: string; currencyEntered: string; amount: number; amountUsd: number }>,
  asOfDate: string,
) {
  const months: Array<{ label: string; value: number }> = [];
  for (let index = 9; index >= 0; index -= 1) {
    const monthDate = new Date(`${asOfDate}T00:00:00`);
    monthDate.setMonth(monthDate.getMonth() - index);
    const key = format(monthDate, "yyyy-MM");
    const label = format(monthDate, "MMM");
    const value = contributions
      .filter((contribution) => contribution.date.slice(0, 7) === key)
      .reduce((total, contribution) => {
        if (contribution.currencyEntered === "AUD") {
          return total + contribution.amount;
        }
        return total + contribution.amountUsd;
      }, 0);
    months.push({ label, value });
  }

  const max = Math.max(...months.map((month) => month.value), 1);
  const palette: Array<"blue" | "emerald" | "amber"> = [
    "blue",
    "blue",
    "emerald",
    "blue",
    "emerald",
    "blue",
    "amber",
    "blue",
    "emerald",
    "blue",
  ];

  return months.map((month, index) => ({
    index,
    label: month.label,
    height: Math.max(18, (month.value / max) * 100),
    tint: palette[index] ?? "blue",
  }));
}
