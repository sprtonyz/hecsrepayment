"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { formatDisplayDate, todayIso } from "@/lib/domain/dates";
import { formatCurrency, roundMoney } from "@/lib/domain/money";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import type { DividendMode, MarketProviderName, PriceMode } from "@/lib/storage/types";

const steps = ["Sale details", "Catch-up plan", "Data preferences", "Review"];

export function SetupWizard() {
  const router = useRouter();
  const tracker = useTrackerData();
  const [step, setStep] = useState(0);
  const [saleDate, setSaleDate] = useState(todayIso());
  const [sharesSold, setSharesSold] = useState("77");
  const [salePricePerShareUsd, setSalePricePerShareUsd] = useState("298.170300");
  const [feesUsd, setFeesUsd] = useState("0");
  const [notes, setNotes] = useState("");
  const [planMonthlyContributionAud, setPlanMonthlyContributionAud] = useState("600");
  const [planStartDate, setPlanStartDate] = useState(todayIso());
  const [planYears, setPlanYears] = useState("5");
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "AUD">("USD");
  const [defaultPriceMode, setDefaultPriceMode] = useState<PriceMode>("live");
  const [marketDataProvider, setMarketDataProvider] = useState<MarketProviderName>("finnhub");
  const [includeDividends, setIncludeDividends] = useState(true);
  const [dividendMode, setDividendMode] = useState<DividendMode>("cash");
  const [includeSplits, setIncludeSplits] = useState(true);
  const [manualCurrentPriceUsd, setManualCurrentPriceUsd] = useState("");

  const grossProceedsUsd = useMemo(
    () => roundMoney(Number(sharesSold || 0) * Number(salePricePerShareUsd || 0)),
    [salePricePerShareUsd, sharesSold],
  );
  const fees = Number(feesUsd || 0);
  const netProceedsUsd = useMemo(
    () => Math.max(0, roundMoney(grossProceedsUsd - fees)),
    [grossProceedsUsd, fees],
  );
  const progress = ((step + 1) / steps.length) * 100;

  async function createTracker() {
    await tracker.createTracker({
      sale: {
        ticker: "AAPL",
        saleDate,
        sharesSold: Number(sharesSold),
        salePricePerShareUsd: Number(salePricePerShareUsd),
        grossProceedsUsd,
        feesUsd: fees,
        netProceedsUsd,
        notes,
      },
      settings: {
        displayCurrency,
        planMonthlyContributionAud: Number(planMonthlyContributionAud),
        planStartDate,
        planYears: Number(planYears),
        includeDividends,
        dividendMode,
        includeSplits,
        defaultPriceMode,
        marketDataProvider,
        manualCurrentPriceUsd: Number(manualCurrentPriceUsd || 0),
      },
    });
    router.push("/dashboard");
  }

  async function loadDemo() {
    await tracker.loadDemo();
    router.push("/dashboard");
  }

  const canContinue =
    step !== 0 ||
    (Number(sharesSold) > 0 &&
      Number(salePricePerShareUsd) > 0 &&
      grossProceedsUsd > 0 &&
      fees >= 0 &&
      saleDate <= todayIso());

  return (
    <AppShell
      title="Setup"
      subtitle="Create the AAPL Catch-Up Tracker with USD sale details and a 600 AUD/month rebuild plan."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>{steps[step]}</CardTitle>
              <span className="text-sm text-muted-foreground">
                Step {step + 1} of {steps.length}
              </span>
            </div>
            <Progress value={progress} />
          </CardHeader>
          <CardContent>
            {step === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Sale date">
                  <Input type="date" value={saleDate} max={todayIso()} onChange={(event) => setSaleDate(event.target.value)} />
                </Field>
                <Field label="Shares sold">
                  <Input type="number" min="0" step="0.000001" value={sharesSold} onChange={(event) => setSharesSold(event.target.value)} />
                </Field>
                <Field label="Sale price per share USD">
                  <Input type="number" min="0" step="0.000001" value={salePricePerShareUsd} onChange={(event) => setSalePricePerShareUsd(event.target.value)} />
                </Field>
                <Field label="Gross proceeds USD">
                  <Input value={formatCurrency(grossProceedsUsd, "USD")} readOnly />
                </Field>
                <Field label="Brokerage fees USD">
                  <Input type="number" min="0" step="0.01" value={feesUsd} onChange={(event) => setFeesUsd(event.target.value)} />
                </Field>
                <Field label="Net proceeds USD">
                  <Input value={formatCurrency(netProceedsUsd, "USD")} readOnly />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Notes">
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </Field>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Monthly contribution">
                  <Input type="number" min="0" step="1" value={planMonthlyContributionAud} onChange={(event) => setPlanMonthlyContributionAud(event.target.value)} />
                </Field>
                <Field label="Contribution currency">
                  <Input value="AUD" readOnly />
                </Field>
                <Field label="Plan start date">
                  <Input type="date" value={planStartDate} onChange={(event) => setPlanStartDate(event.target.value)} />
                </Field>
                <Field label="Target horizon">
                  <Select value={planYears} onValueChange={setPlanYears}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 years</SelectItem>
                      <SelectItem value="5">5 years</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground md:col-span-2">
                  AUD contributions are converted into USD for the AAPL comparison. Each contribution can use the fetched AUD/USD rate or a manual FX override.
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display currency">
                  <Select value={displayCurrency} onValueChange={(value) => setDisplayCurrency(value as "USD" | "AUD")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Price mode">
                  <Select value={defaultPriceMode} onValueChange={(value) => setDefaultPriceMode(value as PriceMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="dailyClose">Daily close</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Market data provider">
                  <Select value={marketDataProvider} onValueChange={(value) => setMarketDataProvider(value as MarketProviderName)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual fallback</SelectItem>
                      <SelectItem value="finnhub">Finnhub</SelectItem>
                      <SelectItem value="yahoo">Yahoo public fallback</SelectItem>
                      <SelectItem value="alphaVantage">Alpha Vantage</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Manual AAPL price USD">
                  <Input type="number" min="0" step="0.01" value={manualCurrentPriceUsd} onChange={(event) => setManualCurrentPriceUsd(event.target.value)} />
                </Field>
                <ToggleRow label="Include dividends" checked={includeDividends} onCheckedChange={setIncludeDividends} />
                <ToggleRow label="Include stock splits" checked={includeSplits} onCheckedChange={setIncludeSplits} />
                <Field label="Dividend mode">
                  <Select value={dividendMode} onValueChange={(value) => setDividendMode(value as DividendMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="reinvested">Reinvested (coming soon)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-3">
                <ReviewRow label="Sold asset" value="AAPL" />
                <ReviewRow label="Sale details" value={`${sharesSold || "0"} shares on ${formatDisplayDate(saleDate)}`} />
                <ReviewRow label="Net proceeds" value={formatCurrency(netProceedsUsd, "USD")} />
                <ReviewRow label="Plan" value={`${formatCurrency(Number(planMonthlyContributionAud || 0), "AUD")} per month for ${planYears} years`} />
                <ReviewRow label="Comparison currency" value="USD" />
                <ReviewRow label="Display currency" value={displayCurrency} />
                <ReviewRow label="Provider" value={marketDataProvider} />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadDemo}>
                  Load demo data
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                {step < steps.length - 1 ? (
                  <Button disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button disabled={!canContinue} onClick={createTracker}>
                    <Check className="h-4 w-4" />
                    Create tracker
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Core Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Original benchmark: AAPL position in USD.</p>
            <p>Monthly rebuild plan: 600 AUD by default.</p>
            <p>Comparison currency: USD.</p>
            <p>Display currency: USD or AUD.</p>
            <p>Projection risk: AAPL price movement plus AUD/USD movement.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-background p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-background p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
