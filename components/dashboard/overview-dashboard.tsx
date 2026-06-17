"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  LineChart,
  ListChecks,
  Target,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateCatchUpMetrics } from "@/lib/domain/calculations";
import { calculateDepositGuide } from "@/lib/domain/depositGuide";
import { todayIso } from "@/lib/domain/dates";
import { scoreCodexReviewForComparison } from "@/lib/news/codexReviewRanking";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import { cn } from "@/lib/utils";

const COMPARISON_SYMBOLS = ["AAPL", "NVDA", "AMZN", "TSLA", "SPACEX"] as const;

type ComparisonReviewCard = {
  symbol: string;
  reviewMonth: string;
  status: "loaded" | "prepared" | "missing" | "error";
  generatedAt?: string;
  rankScore: number;
  codexReview?: {
    appliedNewsDigest?: {
      signal?: "positive" | "neutral" | "negative";
      confidence?: "low" | "medium" | "high";
      positiveArticleCount?: number;
      negativeArticleCount?: number;
      neutralArticleCount?: number;
      materialArticleCount?: number;
    };
    suggestedGuideImpact?: {
      rationale?: string;
      depositSuggestion?: string;
      newsSignal?: string;
    };
    rationale?: string;
  };
  error?: string;
};

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
  const heroValueLabel = heroAhead ? "ahead" : "short";
  const heroSummary = heroAhead
    ? `You've logged ${formatMoney(currentMonthContributionAud)} so far, which is ${heroValue} above the expected pace.`
    : `You've logged ${formatMoney(currentMonthContributionAud)} so far, which is ${heroValue} short of the expected pace.`;
  const gapRemainingAud = Math.max(0, depositGuide.remainingThisMonthAud);
  const catchUpLabel = metrics.catchUpGapAud >= 0 ? "Gap remaining" : "Ahead of plan";
  const catchUpValue = formatMoney(Math.abs(metrics.catchUpGapAud));
  const statusLabel = heroAhead ? "On track" : "Needs attention";
  const recentBars = useMemo(() => buildRecentContributionBars(snapshot.contributions, asOfDate), [asOfDate, snapshot.contributions]);
  const codexReviewMonth = asOfDate.slice(0, 7);
  const [comparisonLoading, setComparisonLoading] = useState(true);
  const [comparisonError, setComparisonError] = useState<string | undefined>();
  const [comparisonReviews, setComparisonReviews] = useState<ComparisonReviewCard[]>([]);

  useEffect(() => {
    let isActive = true;

    Promise.all(
      COMPARISON_SYMBOLS.map(async (symbol) => {
        try {
          const params = new URLSearchParams({
            symbol,
            reviewMonth: codexReviewMonth,
          });
          const response = await fetch(`/api/codex-review-bundle?${params.toString()}`, {
            cache: "no-store",
          });
          if (!response.ok) {
            return {
              symbol,
              reviewMonth: codexReviewMonth,
              status: "missing" as const,
              rankScore: -999,
            };
          }

          const payload = (await response.json()) as {
            filename?: string;
            generatedAt?: string;
            codexReview?: ComparisonReviewCard["codexReview"];
          };
          const review = payload.codexReview ?? undefined;
          return {
            symbol,
            reviewMonth: codexReviewMonth,
            status: review ? "loaded" : "prepared",
            generatedAt: payload.generatedAt,
            codexReview: review,
            rankScore: review
              ? scoreCodexReviewForComparison(
                  review as Parameters<typeof scoreCodexReviewForComparison>[0],
                )
              : 0,
          } satisfies ComparisonReviewCard;
        } catch (error) {
          return {
            symbol,
            reviewMonth: codexReviewMonth,
            status: "error" as const,
            rankScore: -999,
            error: error instanceof Error ? error.message : "Could not load review.",
          } satisfies ComparisonReviewCard;
        }
      }),
    )
      .then((results) => {
        if (!isActive) {
          return;
        }
        setComparisonError(undefined);
        setComparisonReviews(results.sort((left, right) => right.rankScore - left.rankScore));
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        setComparisonError(error instanceof Error ? error.message : "Could not load comparison reviews.");
      })
      .finally(() => {
        if (isActive) {
          setComparisonLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [codexReviewMonth]);

  const loadedComparisonReviews = comparisonReviews.filter((item) => item.status === "loaded");
  const bestComparisonReview = loadedComparisonReviews[0];
  const fetchedComparisonCount = comparisonReviews.filter((item) => item.status !== "missing").length;
  const reviewedComparisonCount = loadedComparisonReviews.length;
  const comparisonSignalLabel = bestComparisonReview?.codexReview?.appliedNewsDigest?.signal
    ? bestComparisonReview.codexReview.appliedNewsDigest.signal
    : "mixed";
  const comparisonLeadingRationale =
    bestComparisonReview?.codexReview?.suggestedGuideImpact?.rationale ??
    bestComparisonReview?.codexReview?.rationale ??
    "Prepare the full comparison bundles to see which ticket is strongest.";

  return (
    <AppShell title="Dashboard" subtitle="See your status at a glance. Less jargon, more meaning.">
      <div className="grid gap-4 lg:gap-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_20rem]">
          <Card className="border border-slate-800/70 bg-[#0f1830] text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.36)]">
            <CardContent className="p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-emerald-400">{heroLabel}</p>
                  <p className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    {heroValue} {heroValueLabel}
                  </p>
                  <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    {heroSummary}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_21rem]">
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">Monthly pace</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                          {formatMoney(currentMonthContributionAud)}
                        </p>
                      </div>
                      <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                        {Math.round(progressPercent)}% logged
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={progressPercent} className="h-3 bg-white/8" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {formatMoney(gapRemainingAud)} remains to hit the monthly target of {formatMoney(settings.planMonthlyContributionAud)}.
                    </p>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                    <p className="text-sm font-semibold text-emerald-400">On track</p>
                    <p className="mt-3 text-sm font-medium text-slate-400">Progress</p>
                    <div className="mt-2">
                      <Progress
                        value={Math.max(10, Math.min(100, metrics.catchUpProgressPercent))}
                        className="h-3 bg-white/8"
                      />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">
                      {Math.round(metrics.catchUpProgressPercent)}% of the catch-up target is already covered.
                      Only one clear decision remains: keep logging, pause, or review the plan.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-800/70 bg-[#0f1830] text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.28)]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{statusLabel}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Progress</p>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                    Updated now
                  </Badge>
                </div>

                <div className="mt-4">
                  <Progress value={Math.min(100, progressPercent)} className="h-3 bg-white/8" />
                </div>

                <div className="mt-5 flex-1 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-emerald-500/15 p-2 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {Math.round(progressPercent)}% of the monthly target is already logged.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
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
          <Card className="border border-slate-800/70 bg-[#0f1830] text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.28)]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-400">What needs attention</p>
                  <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                    Three plain-language prompts replace the old long checklist.
                  </h2>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
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

          <Card className="border border-slate-800/70 bg-[#0f1830] text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.28)]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-400">Recent activity</p>
                  <h2 className="mt-2 max-w-md text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                    A visual feed that feels like a timeline, not a spreadsheet.
                  </h2>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                  10 months
                </Badge>
              </div>

              <div className="mt-6 rounded-[1.6rem] border border-white/8 bg-white/5 p-4">
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
                      <span className="text-[11px] font-medium text-slate-400">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-400">
                This trend card stays visual so the user does not have to decode a table.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          <Card className="overflow-hidden border border-slate-800/70 bg-[#0f1830] text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.32)]">
            <div className="border-b border-white/10 bg-[#101a32] px-5 py-5 text-white sm:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Deep context
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
                    The rest of the dashboard, tucked into one calm place.
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                    Cross-stock comparison, portfolio reasoning, and the original detail layers are
                    still here, just organized so the dashboard starts with the answer instead of the
                    paperwork.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-white/10 bg-white/10 text-white" variant="outline">
                    Review month {codexReviewMonth}
                  </Badge>
                  <Badge className="border-white/10 bg-white/10 text-white" variant="outline">
                    {reviewedComparisonCount}/{COMPARISON_SYMBOLS.length} published
                  </Badge>
                </div>
              </div>
            </div>
            <CardContent className="p-5 sm:p-6">
              <Tabs defaultValue="compare" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-3 rounded-[1.4rem] border border-white/8 bg-white/5 p-1">
                  <TabsTrigger value="compare">Compare stocks</TabsTrigger>
                  <TabsTrigger value="plan">Plan view</TabsTrigger>
                  <TabsTrigger value="details">Raw details</TabsTrigger>
                </TabsList>

                <TabsContent value="compare" className="mt-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-400">Strongest ticket</p>
                          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                            {bestComparisonReview?.symbol ?? "Loading"}
                          </h3>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                            {comparisonLoading
                              ? "Loading the current comparison bundles..."
                              : comparisonLeadingRationale}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={
                              comparisonSignalLabel === "positive"
                                ? "success"
                                : comparisonSignalLabel === "negative"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {comparisonSignalLabel}
                          </Badge>
                          <Badge variant="outline">
                            Score {bestComparisonReview ? `${bestComparisonReview.rankScore.toFixed(2)}/5` : "pending"}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <MiniStatusChip
                          label="Fetched"
                          value={`${fetchedComparisonCount}/${COMPARISON_SYMBOLS.length}`}
                          note="Saved in the current review month"
                        />
                        <MiniStatusChip
                          label="Published"
                          value={`${reviewedComparisonCount}/${COMPARISON_SYMBOLS.length}`}
                          note="Ready to influence the guide"
                        />
                        <MiniStatusChip
                          label="Lead"
                          value={bestComparisonReview?.symbol ?? "Pending"}
                          note="Top-ranked comparison ticket"
                        />
                      </div>

                      {comparisonError ? (
                        <div className="mt-4 rounded-[1.2rem] border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                          {comparisonError}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                      {comparisonReviews.map((item, index) => {
                        const digest = item.codexReview?.appliedNewsDigest;
                        const score = item.rankScore;
                        const normalizedScore =
                          item.status === "loaded"
                            ? Math.max(6, Math.min(100, ((score + 5) / 10) * 100))
                            : item.status === "prepared"
                              ? 24
                              : 10;
                        const scoreLabel =
                          item.status === "loaded"
                            ? score.toFixed(2)
                            : item.status === "prepared"
                              ? "Ready"
                              : item.status === "missing"
                                ? "Missing"
                                : "Error";
                        return (
                          <div
                            key={item.symbol}
                            className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.1)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                                  Rank {index + 1}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-white">{item.symbol}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-white">{scoreLabel}</p>
                                <p className="text-xs text-slate-400">
                                  {item.status === "loaded" ? "fit / 5" : "review status"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  digest?.signal === "positive"
                                    ? "bg-emerald-500"
                                    : digest?.signal === "negative"
                                      ? "bg-amber-500"
                                      : "bg-slate-400",
                                )}
                                style={{ width: `${normalizedScore}%` }}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge
                                variant={
                                  digest?.signal === "positive"
                                    ? "success"
                                    : digest?.signal === "negative"
                                      ? "warning"
                                      : "secondary"
                                }
                              >
                                {digest?.signal ?? "pending"}
                              </Badge>
                              <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                                {digest?.confidence ? `${digest.confidence} confidence` : item.status}
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-300">
                              {item.codexReview?.suggestedGuideImpact?.rationale ??
                                item.codexReview?.rationale ??
                                "No published rationale yet."}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="plan" className="mt-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 sm:p-6">
                      <p className="text-sm font-semibold text-slate-400">Plan view</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                        A plain-language version of the original planning block.
                      </h3>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                        The dashboard now leads with the answer, while the planning layer stays
                        reachable for people who want the why behind it.
                      </p>
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <MiniMetricCard
                          color="emerald"
                          icon={<Wallet className="h-4 w-4" />}
                          label="Logged this month"
                          value={formatMoney(currentMonthContributionAud)}
                          note="What has already landed."
                        />
                        <MiniMetricCard
                          color="blue"
                          icon={<Target className="h-4 w-4" />}
                          label="Monthly target"
                          value={formatMoney(settings.planMonthlyContributionAud)}
                          note="The current guidepost."
                        />
                        <MiniMetricCard
                          color="amber"
                          icon={<CircleDollarSign className="h-4 w-4" />}
                          label="Still to close"
                          value={formatMoney(gapRemainingAud)}
                          note={heroAhead ? "Keep pace to stay ahead." : "A small catch-up remains."}
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-white/10 bg-[#101a32] p-5 text-white">
                      <p className="text-sm font-semibold text-slate-400">Short answer</p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">
                        {heroAhead ? "You are ahead this month." : "You are behind this month."}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {heroSummary} Open projections if you want the more technical debt and
                        rebuild breakdown.
                      </p>
                      <div className="mt-5 grid gap-3">
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                            Monthly guide
                          </p>
                          <p className="mt-2 text-xl font-semibold text-white">
                            {formatMoney(depositGuide.recommendedDepositAud)}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            Range {formatMoney(depositGuide.minThisMonthAud)} to{" "}
                            {formatMoney(depositGuide.maxThisMonthAud)}.
                          </p>
                        </div>
                        <Button asChild className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                          <Link href="/projections">Open full projections</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="details" className="mt-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <DetailTile label="Value ahead / short" value={`${formatMoney(Math.abs(metrics.paceDifferenceAud))} ${heroValueLabel}`} />
                    <DetailTile label="Current logged" value={formatMoney(currentMonthContributionAud)} />
                    <DetailTile label="Target" value={formatMoney(settings.planMonthlyContributionAud)} />
                    <DetailTile label="Monthly progress" value={`${Math.round(progressPercent)}%`} />
                    <DetailTile label="Comparison month" value={codexReviewMonth} />
                    <DetailTile label="Signal leader" value={bestComparisonReview?.symbol ?? "Pending"} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        {isLoading ? <p className="px-1 text-sm text-slate-400">Loading your local tracker...</p> : null}
        {isRefreshing ? <p className="px-1 text-sm text-slate-400">Refreshing market data...</p> : null}
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
      ? "bg-emerald-500/15 text-emerald-300"
      : color === "amber"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-blue-500/15 text-blue-300";

  return (
    <Card className="border border-white/10 bg-white/5 text-slate-100">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{note}</p>
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
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "amber"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-blue-500/15 text-blue-300";

  return (
    <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/5 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
      <div className={cn("rounded-2xl p-2.5", accent)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
      </div>
      <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

function MiniStatusChip({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-[#101a32] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{note}</p>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.1)]">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
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
  const hasAnyValue = months.some((month) => month.value > 0);
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
    height: hasAnyValue
      ? Math.max(18, (month.value / max) * 100)
      : [22, 30, 28, 44, 38, 56, 50, 68, 60, 74][index] ?? 24,
    tint: palette[index] ?? "blue",
  }));
}
