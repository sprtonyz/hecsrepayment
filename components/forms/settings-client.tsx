"use client";

import { useRef, useState } from "react";
import { Download, Save, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, roundMoney } from "@/lib/domain/money";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import type { Currency, DividendMode, MarketProviderName, PriceMode } from "@/lib/storage/types";

export function SettingsClient() {
  const tracker = useTrackerData();
  const key = `${tracker.settings.updatedAt}-${tracker.saleEvent?.updatedAt || "no-sale"}`;
  return <SettingsForm key={key} tracker={tracker} />;
}

function SettingsForm({ tracker }: { tracker: ReturnType<typeof useTrackerData> }) {
  const { settings, saleEvent } = tracker;
  const importRef = useRef<HTMLInputElement>(null);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(settings.displayCurrency);
  const [planMonthlyContributionAud, setPlanMonthlyContributionAud] = useState(String(settings.planMonthlyContributionAud));
  const [planStartDate, setPlanStartDate] = useState(settings.planStartDate);
  const [planYears, setPlanYears] = useState(String(settings.planYears));
  const [includeDividends, setIncludeDividends] = useState(settings.includeDividends);
  const [dividendMode, setDividendMode] = useState<DividendMode>(settings.dividendMode);
  const [includeSplits, setIncludeSplits] = useState(settings.includeSplits);
  const [defaultPriceMode, setDefaultPriceMode] = useState<PriceMode>(settings.defaultPriceMode);
  const [marketDataProvider, setMarketDataProvider] = useState<MarketProviderName>(settings.marketDataProvider);
  const [manualCurrentPriceUsd, setManualCurrentPriceUsd] = useState(String(settings.manualCurrentPriceUsd || ""));
  const [studyLoanEnabled, setStudyLoanEnabled] = useState(settings.studyLoanEnabled);
  const [studyLoanBalanceAud, setStudyLoanBalanceAud] = useState(String(settings.studyLoanBalanceAud));
  const [studyLoanPayoffAmountAud, setStudyLoanPayoffAmountAud] = useState(
    String(settings.studyLoanPayoffAmountAud),
  );
  const [studyLoanMonthlyRepaymentAud, setStudyLoanMonthlyRepaymentAud] = useState(
    String(settings.studyLoanMonthlyRepaymentAud),
  );
  const [studyLoanAnnualIncomeAud, setStudyLoanAnnualIncomeAud] = useState(
    String(settings.studyLoanAnnualIncomeAud),
  );
  const [studyLoanAnnualIndexationRatePercent, setStudyLoanAnnualIndexationRatePercent] =
    useState(String(settings.studyLoanAnnualIndexationRatePercent));
  const [studyLoanUseIncomeFormula, setStudyLoanUseIncomeFormula] = useState(
    settings.studyLoanUseIncomeFormula,
  );
  const [studyLoanRedirectFreedRepayment, setStudyLoanRedirectFreedRepayment] =
    useState(settings.studyLoanRedirectFreedRepayment);

  const [saleDate, setSaleDate] = useState(saleEvent?.saleDate || "");
  const [sharesSold, setSharesSold] = useState(String(saleEvent?.sharesSold || ""));
  const [salePricePerShareUsd, setSalePricePerShareUsd] = useState(String(saleEvent?.salePricePerShareUsd || ""));
  const [feesUsd, setFeesUsd] = useState(String(saleEvent?.feesUsd || "0"));
  const [notes, setNotes] = useState(saleEvent?.notes || "");
  const [saleDeleteOpen, setSaleDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const grossProceedsUsd = roundMoney(
    Number(sharesSold || 0) * Number(salePricePerShareUsd || 0),
  );
  const netProceedsUsd = Math.max(0, roundMoney(grossProceedsUsd - Number(feesUsd || 0)));

  async function saveSettings() {
    await tracker.saveSettings({
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
      studyLoanEnabled,
      studyLoanBalanceAud: Number(studyLoanBalanceAud || 0),
      studyLoanPayoffAmountAud: Number(studyLoanPayoffAmountAud || 0),
      studyLoanMonthlyRepaymentAud: Number(studyLoanMonthlyRepaymentAud || 0),
      studyLoanAnnualIncomeAud: Number(studyLoanAnnualIncomeAud || 0),
      studyLoanAnnualIndexationRatePercent: Number(studyLoanAnnualIndexationRatePercent || 0),
      studyLoanUseIncomeFormula,
      studyLoanRedirectFreedRepayment,
    });
  }

  async function saveSale() {
    if (!saleEvent) {
      return;
    }
    await tracker.saveSaleEvent({
      ...saleEvent,
      saleDate,
      sharesSold: Number(sharesSold),
      salePricePerShareUsd: Number(salePricePerShareUsd),
      grossProceedsUsd,
      feesUsd: Number(feesUsd),
      netProceedsUsd,
      notes,
    });
  }

  async function exportData() {
    const json = await tracker.exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aapl-catch-up-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file?: File) {
    if (!file) {
      return;
    }
    const text = await file.text();
    await tracker.importJson(text);
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Manage the AAPL benchmark, AUD plan, provider preferences, and local backup data."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan and Display</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Monthly contribution AUD">
              <Input type="number" min="0" step="1" value={planMonthlyContributionAud} onChange={(event) => setPlanMonthlyContributionAud(event.target.value)} />
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
                  <SelectItem value="6">6 years</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Display currency">
              <Select value={displayCurrency} onValueChange={(value) => setDisplayCurrency(value as Currency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="md:col-span-2">
              <Button onClick={saveSettings}>
                <Save className="h-4 w-4" />
                Save plan settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market Data</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Provider preference">
              <Select value={marketDataProvider} onValueChange={(value) => setMarketDataProvider(value as MarketProviderName)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="finnhub">Finnhub</SelectItem>
                  <SelectItem value="yahoo">Yahoo public fallback</SelectItem>
                  <SelectItem value="alphaVantage">Alpha Vantage</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default price mode">
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
            <Field label="Manual current AAPL price USD">
              <Input type="number" min="0" step="0.01" value={manualCurrentPriceUsd} onChange={(event) => setManualCurrentPriceUsd(event.target.value)} />
            </Field>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              FINNHUB_API_KEY activates Finnhub. Without an API key, the app uses Yahoo public fallback data.
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveSettings}>
                <Save className="h-4 w-4" />
                Save data settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>School Debt Decision</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ToggleRow
              label="Show school debt model"
              checked={studyLoanEnabled}
              onCheckedChange={setStudyLoanEnabled}
            />
            <ToggleRow
              label="Use income formula for repayment"
              checked={studyLoanUseIncomeFormula}
              onCheckedChange={setStudyLoanUseIncomeFormula}
            />
            <Field label="Current study-loan balance AUD">
              <Input
                type="number"
                min="0"
                step="1"
                value={studyLoanBalanceAud}
                onChange={(event) => setStudyLoanBalanceAud(event.target.value)}
              />
            </Field>
            <Field label="AAPL cash-out applied AUD">
              <Input
                type="number"
                min="0"
                step="1"
                value={studyLoanPayoffAmountAud}
                onChange={(event) => setStudyLoanPayoffAmountAud(event.target.value)}
              />
            </Field>
            <Field label="Observed monthly deduction AUD">
              <Input
                type="number"
                min="0"
                step="1"
                value={studyLoanMonthlyRepaymentAud}
                onChange={(event) => setStudyLoanMonthlyRepaymentAud(event.target.value)}
              />
            </Field>
            <Field label="Repayment income AUD">
              <Input
                type="number"
                min="0"
                step="1000"
                value={studyLoanAnnualIncomeAud}
                onChange={(event) => setStudyLoanAnnualIncomeAud(event.target.value)}
              />
            </Field>
            <Field label="Annual indexation assumption %">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={studyLoanAnnualIndexationRatePercent}
                onChange={(event) => setStudyLoanAnnualIndexationRatePercent(event.target.value)}
              />
            </Field>
            <ToggleRow
              label="Redirect freed repayment into AAPL"
              checked={studyLoanRedirectFreedRepayment}
              onCheckedChange={setStudyLoanRedirectFreedRepayment}
            />
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground md:col-span-2">
              The 2025-26 formula is marginal: nil up to A$67,000, then 15c per A$1 above A$67,000 up to A$125,000. Indexation is modelled annually on 1 June using your assumption.
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveSettings}>
                <Save className="h-4 w-4" />
                Save school debt settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sale Event</CardTitle>
          </CardHeader>
          <CardContent>
            {!saleEvent ? (
              <div className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
                No sale event is saved. Use setup to create the benchmark.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Sale date">
                  <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} />
                </Field>
                <Field label="Shares sold">
                  <Input type="number" min="0" step="0.000001" value={sharesSold} onChange={(event) => setSharesSold(event.target.value)} />
                </Field>
                <Field label="Sale price per share USD">
                  <Input type="number" min="0" step="0.01" value={salePricePerShareUsd} onChange={(event) => setSalePricePerShareUsd(event.target.value)} />
                </Field>
                <Field label="Gross proceeds USD">
                  <Input value={formatCurrency(grossProceedsUsd, "USD")} readOnly />
                </Field>
                <Field label="Fees USD">
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
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button onClick={saveSale}>
                    <Save className="h-4 w-4" />
                    Save sale event
                  </Button>
                  <Dialog open={saleDeleteOpen} onOpenChange={setSaleDeleteOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Trash2 className="h-4 w-4" />
                        Delete sale event
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete sale event?</DialogTitle>
                        <DialogDescription>
                          The Had I Held benchmark depends on this event. Dashboard calculations will be incomplete until a new sale event is added.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSaleDeleteOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={async () => {
                            await tracker.deleteSaleEvent(saleEvent.id);
                            setSaleDeleteOpen(false);
                          }}
                        >
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backup and Reset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportData}>
                <Download className="h-4 w-4" />
                Export JSON
              </Button>
              <Button variant="outline" onClick={() => importRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Import JSON
              </Button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => importData(event.target.files?.[0])}
              />
            </div>
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  Reset app data
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset all local data?</DialogTitle>
                  <DialogDescription>
                    This clears IndexedDB data for the tracker on this browser profile.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setResetOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await tracker.reset();
                      setResetOpen(false);
                    }}
                  >
                    Reset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
    <div className="flex items-center justify-between rounded-md border bg-background p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
