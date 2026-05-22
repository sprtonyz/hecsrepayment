"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, Edit2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDate, todayIso } from "@/lib/domain/dates";
import { formatCurrency, formatShares, roundMoney } from "@/lib/domain/money";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import type { Contribution, Currency, Trade, TradeSide } from "@/lib/storage/types";

type Row =
  | { kind: "contribution"; date: string; item: Contribution }
  | { kind: "trade"; date: string; item: Trade };

export function TransactionsClient() {
  const searchParams = useSearchParams();
  const prefillAppliedRef = useRef(false);
  const tracker = useTrackerData();
  const {
    snapshot,
    settings,
    saleEvent,
    latestAudToUsdRate,
    currentPriceUsd,
    isRefreshing,
    refreshMarketData,
  } = tracker;
  const [contributionDate, setContributionDate] = useState(todayIso());
  const [contributionAmount, setContributionAmount] = useState(
    String(settings.planMonthlyContributionAud),
  );
  const [contributionCurrency, setContributionCurrency] = useState<Currency>("AUD");
  const [contributionFx, setContributionFx] = useState(String(latestAudToUsdRate.toFixed(4)));
  const [contributionNotes, setContributionNotes] = useState("");
  const [editingContributionId, setEditingContributionId] = useState<string | undefined>();
  const [recordBuyFromContribution, setRecordBuyFromContribution] = useState(true);
  const [contributionShareMode, setContributionShareMode] = useState<"currentPrice" | "manual">(
    "currentPrice",
  );
  const [contributionShares, setContributionShares] = useState("");
  const [contributionBuyPriceUsd, setContributionBuyPriceUsd] = useState(
    currentPriceUsd > 0 ? String(currentPriceUsd.toFixed(2)) : "",
  );
  const [contributionPriceEdited, setContributionPriceEdited] = useState(false);
  const [contributionBuyFees, setContributionBuyFees] = useState("0");
  const [contributionBuyFeeCurrency, setContributionBuyFeeCurrency] =
    useState<Currency>("USD");
  const [contributionBuyFeeFx, setContributionBuyFeeFx] = useState(
    String(latestAudToUsdRate.toFixed(4)),
  );

  const [tradeDate, setTradeDate] = useState(todayIso());
  const [side, setSide] = useState<TradeSide>("BUY");
  const [shares, setShares] = useState("");
  const [pricePerShareUsd, setPricePerShareUsd] = useState(
    currentPriceUsd > 0 ? String(currentPriceUsd.toFixed(2)) : "",
  );
  const [tradePriceEdited, setTradePriceEdited] = useState(false);
  const [fees, setFees] = useState("0");
  const [feeCurrency, setFeeCurrency] = useState<Currency>("USD");
  const [feeFx, setFeeFx] = useState(String(latestAudToUsdRate.toFixed(4)));
  const [createMatchingContribution, setCreateMatchingContribution] = useState(true);
  const [matchingContributionAud, setMatchingContributionAud] = useState(
    String(settings.planMonthlyContributionAud),
  );
  const [tradeFx, setTradeFx] = useState(String(latestAudToUsdRate.toFixed(4)));
  const [tradeNotes, setTradeNotes] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | undefined>();
  const autoRefreshKeyRef = useRef<string | undefined>(undefined);

  const rows = useMemo<Row[]>(
    () =>
      [
        ...snapshot.contributions.map((item) => ({
          kind: "contribution" as const,
          date: item.date,
          item,
        })),
        ...snapshot.trades.map((item) => ({ kind: "trade" as const, date: item.date, item })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [snapshot.contributions, snapshot.trades],
  );

  useEffect(() => {
    if (!saleEvent) {
      return;
    }
    const autoRefreshKey = [
      saleEvent.id,
      settings.baseTicker,
      settings.marketDataProvider,
    ].join(":");
    if (autoRefreshKeyRef.current === autoRefreshKey) {
      return;
    }
    autoRefreshKeyRef.current = autoRefreshKey;
    void refreshMarketData(false);
  }, [refreshMarketData, saleEvent, settings.baseTicker, settings.marketDataProvider]);

  useEffect(() => {
    if (prefillAppliedRef.current || searchParams.get("prefill") !== "month") {
      return;
    }

    const amountAud = Number(searchParams.get("amountAud") || settings.planMonthlyContributionAud);
    const targetAud = Number(searchParams.get("targetAud") || amountAud);
    const date = searchParams.get("date") || todayIso();

    setContributionDate(date);
    setContributionAmount(String(roundMoney(amountAud)));
    setContributionCurrency("AUD");
    setContributionFx(String(latestAudToUsdRate.toFixed(4)));
    setContributionNotes(`Guided monthly AAPL contribution. Target this month: ${formatCurrency(targetAud, "AUD")}.`);
    setRecordBuyFromContribution(true);
    setContributionShareMode("currentPrice");
    setContributionShares("");
    setContributionPriceEdited(false);
    setContributionBuyPriceUsd(currentPriceUsd > 0 ? currentPriceUsd.toFixed(2) : "");
    setContributionBuyFees("0");
    setContributionBuyFeeCurrency("USD");
    setCreateMatchingContribution(true);
    setMatchingContributionAud(String(roundMoney(amountAud)));
    setTradeFx(String(latestAudToUsdRate.toFixed(4)));
    prefillAppliedRef.current = true;
  }, [currentPriceUsd, latestAudToUsdRate, searchParams, settings.planMonthlyContributionAud]);

  async function saveContribution() {
    if (editingContributionId) {
      await tracker.deleteContribution(editingContributionId);
    }
    const purchaseShares =
      contributionShareMode === "currentPrice"
        ? calculatedContributionShares
        : Number(contributionShares);
    await tracker.addContributionWithPurchase({
      contribution: {
        date: contributionDate,
        amount: Number(contributionAmount),
        currencyEntered: contributionCurrency,
        fxRateToUsd: contributionCurrency === "USD" ? 1 : Number(contributionFx),
        notes: contributionNotes,
      },
      purchase:
        recordBuyFromContribution && !editingContributionId
          ? {
              shares: purchaseShares,
              pricePerShareUsd: Number(effectiveContributionBuyPriceUsd),
              fees: Number(contributionBuyFees || 0),
              feeCurrency: contributionBuyFeeCurrency,
              feeFxRateToUsd:
                contributionBuyFeeCurrency === "USD" ? 1 : Number(contributionBuyFeeFx),
              notes: contributionNotes || "AAPL buy from contribution.",
            }
          : undefined,
    });
    setEditingContributionId(undefined);
    setContributionAmount(String(settings.planMonthlyContributionAud));
    setContributionCurrency("AUD");
    setContributionNotes("");
    setContributionShares("");
    setRecordBuyFromContribution(true);
    setContributionPriceEdited(false);
  }

  async function saveTrade() {
    if (editingTradeId) {
      await tracker.deleteTrade(editingTradeId);
    }
    await tracker.addQuickTrade({
      date: tradeDate,
      side,
      shares: Number(shares),
      pricePerShareUsd: Number(effectiveTradePriceUsd),
      fees: Number(fees),
      feeCurrency,
      feeFxRateToUsd: feeCurrency === "USD" ? 1 : Number(feeFx),
      createMatchingContribution: createMatchingContribution && !editingTradeId,
      contributionAmountAud: Number(matchingContributionAud),
      audUsdRate: Number(tradeFx),
      notes: tradeNotes,
    });
    setEditingTradeId(undefined);
    setShares("");
    setFees("0");
    setTradeNotes("");
    setTradePriceEdited(false);
  }

  function editContribution(contribution: Contribution) {
    setEditingContributionId(contribution.id);
    setContributionDate(contribution.date);
    setContributionAmount(String(contribution.amount));
    setContributionCurrency(contribution.currencyEntered);
    setContributionFx(String(contribution.fxRateToUsd));
    setContributionNotes(contribution.notes || "");
    setRecordBuyFromContribution(false);
    setContributionPriceEdited(true);
  }

  function editTrade(trade: Trade) {
    setEditingTradeId(trade.id);
    setTradeDate(trade.date);
    setSide(trade.side);
    setShares(String(trade.shares));
    setPricePerShareUsd(String(trade.pricePerShareUsd));
    setTradePriceEdited(true);
    setFees(String(trade.feesUsd));
    setFeeCurrency(trade.feeCurrency || "USD");
    setCreateMatchingContribution(false);
    setTradeNotes(trade.notes || "");
  }

  const latestPriceInput = currentPriceUsd > 0 ? currentPriceUsd.toFixed(2) : "";
  const effectiveContributionBuyPriceUsd =
    contributionPriceEdited || editingContributionId
      ? contributionBuyPriceUsd
      : latestPriceInput;
  const effectiveTradePriceUsd =
    tradePriceEdited || editingTradeId ? pricePerShareUsd : latestPriceInput;

  const convertedContributionUsd =
    contributionCurrency === "USD"
      ? Number(contributionAmount || 0)
      : roundMoney(Number(contributionAmount || 0) * Number(contributionFx || 0));
  const contributionBuyFeeUsd =
    contributionBuyFeeCurrency === "AUD"
      ? roundMoney(Number(contributionBuyFees || 0) * Number(contributionBuyFeeFx || 0))
      : Number(contributionBuyFees || 0);
  const contributionBuyAvailableUsd = Math.max(
    0,
    convertedContributionUsd - contributionBuyFeeUsd,
  );
  const calculatedContributionShares =
    Number(effectiveContributionBuyPriceUsd || 0) > 0
      ? Number((contributionBuyAvailableUsd / Number(effectiveContributionBuyPriceUsd)).toFixed(6))
      : 0;
  const contributionPurchaseShares =
    contributionShareMode === "currentPrice"
      ? calculatedContributionShares
      : Number(contributionShares || 0);
  const contributionBuyGrossUsd = roundMoney(
    contributionPurchaseShares * Number(effectiveContributionBuyPriceUsd || 0),
  );
  const contributionCashDifferenceUsd = roundMoney(
    convertedContributionUsd - contributionBuyGrossUsd - contributionBuyFeeUsd,
  );
  const matchingUsd = roundMoney(Number(matchingContributionAud || 0) * Number(tradeFx || 0));
  const tradeGrossUsd = roundMoney(Number(shares || 0) * Number(effectiveTradePriceUsd || 0));

  return (
    <AppShell
      title="Transactions"
      subtitle="Log AUD contributions and AAPL buys or sells. AAPL prices stay USD-based."
    >
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{editingContributionId ? "Edit Contribution" : "Add Contribution"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Date">
                <Input type="date" value={contributionDate} onChange={(event) => setContributionDate(event.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount">
                  <Input type="number" min="0" step="0.01" value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} />
                </Field>
                <Field label="Currency">
                  <Select value={contributionCurrency} onValueChange={(value) => setContributionCurrency(value as Currency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="AUD/USD FX rate used">
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={contributionCurrency === "USD" ? "1" : contributionFx}
                  disabled={contributionCurrency === "USD"}
                  onChange={(event) => setContributionFx(event.target.value)}
                />
              </Field>
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Converted contribution value: {formatCurrency(convertedContributionUsd, "USD")}
              </p>
              <div className="grid gap-3 rounded-md border bg-background p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={recordBuyFromContribution}
                    disabled={Boolean(editingContributionId)}
                    onCheckedChange={(checked) => setRecordBuyFromContribution(Boolean(checked))}
                  />
                  <div className="grid gap-1">
                    <Label>Also record AAPL buy</Label>
                    <p className="text-xs text-muted-foreground">
                      Rebuild Portfolio shares only increase when an AAPL buy is logged.
                    </p>
                  </div>
                </div>

                {recordBuyFromContribution && !editingContributionId ? (
                  <div className="grid gap-3">
                    <Field label="Share amount">
                      <Select
                        value={contributionShareMode}
                        onValueChange={(value) =>
                          setContributionShareMode(value as "currentPrice" | "manual")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="currentPrice">
                            Calculate from current price
                          </SelectItem>
                          <SelectItem value="manual">Enter shares manually</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="AAPL price USD">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={effectiveContributionBuyPriceUsd}
                          onChange={(event) => {
                            setContributionPriceEdited(true);
                            setContributionBuyPriceUsd(event.target.value);
                          }}
                        />
                        <LatestPriceControls
                          currentPriceUsd={currentPriceUsd}
                          isRefreshing={isRefreshing}
                          onRefresh={() => {
                            setContributionPriceEdited(false);
                            void refreshMarketData(true);
                          }}
                          onUseLatest={() => {
                            setContributionPriceEdited(false);
                            setContributionBuyPriceUsd(
                              currentPriceUsd > 0 ? currentPriceUsd.toFixed(2) : "",
                            );
                          }}
                        />
                      </Field>
                      <Field label="Shares bought">
                        <Input
                          type="number"
                          min="0"
                          step="0.000001"
                          value={
                            contributionShareMode === "currentPrice"
                              ? String(calculatedContributionShares)
                              : contributionShares
                          }
                          readOnly={contributionShareMode === "currentPrice"}
                          onChange={(event) => setContributionShares(event.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Brokerage fees">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={contributionBuyFees}
                          onChange={(event) => setContributionBuyFees(event.target.value)}
                        />
                      </Field>
                      <Field label="Fee currency">
                        <Select
                          value={contributionBuyFeeCurrency}
                          onValueChange={(value) => setContributionBuyFeeCurrency(value as Currency)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="AUD">AUD</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {contributionBuyFeeCurrency === "AUD" ? (
                      <Field label="Fee AUD/USD FX rate">
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={contributionBuyFeeFx}
                          onChange={(event) => setContributionBuyFeeFx(event.target.value)}
                        />
                      </Field>
                    ) : null}
                    <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                      <Calculator className="mr-2 inline h-4 w-4" />
                      Buy value: {formatCurrency(contributionBuyGrossUsd, "USD")}.
                      Cash difference after buy and fees:{" "}
                      {formatCurrency(contributionCashDifferenceUsd, "USD")}.
                    </p>
                  </div>
                ) : null}
              </div>
              <Field label="Notes">
                <Textarea value={contributionNotes} onChange={(event) => setContributionNotes(event.target.value)} />
              </Field>
              <Button
                onClick={saveContribution}
                disabled={
                  Number(contributionAmount) <= 0 ||
                  (recordBuyFromContribution &&
                    !editingContributionId &&
                    (contributionPurchaseShares <= 0 ||
                      Number(effectiveContributionBuyPriceUsd) <= 0))
                }
              >
                <Plus className="h-4 w-4" />
                {editingContributionId
                  ? "Save contribution"
                  : recordBuyFromContribution
                    ? "Add contribution and buy"
                    : "Add contribution"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editingTradeId ? "Edit AAPL Trade" : "Quick-Add Monthly Purchase"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input type="date" value={tradeDate} onChange={(event) => setTradeDate(event.target.value)} />
                </Field>
                <Field label="Side">
                  <Select value={side} onValueChange={(value) => setSide(value as TradeSide)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">Buy</SelectItem>
                      <SelectItem value="SELL">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Shares">
                  <Input type="number" min="0" step="0.000001" value={shares} onChange={(event) => setShares(event.target.value)} />
                </Field>
                <Field label="AAPL price USD">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={effectiveTradePriceUsd}
                    onChange={(event) => {
                      setTradePriceEdited(true);
                      setPricePerShareUsd(event.target.value);
                    }}
                  />
                  <LatestPriceControls
                    currentPriceUsd={currentPriceUsd}
                    isRefreshing={isRefreshing}
                    onRefresh={() => {
                      setTradePriceEdited(false);
                      void refreshMarketData(true);
                    }}
                    onUseLatest={() => {
                      setTradePriceEdited(false);
                      setPricePerShareUsd(
                        currentPriceUsd > 0 ? currentPriceUsd.toFixed(2) : "",
                      );
                    }}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brokerage fees">
                  <Input type="number" min="0" step="0.01" value={fees} onChange={(event) => setFees(event.target.value)} />
                </Field>
                <Field label="Fee currency">
                  <Select value={feeCurrency} onValueChange={(value) => setFeeCurrency(value as Currency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {feeCurrency === "AUD" ? (
                <Field label="Fee AUD/USD FX rate">
                  <Input type="number" min="0" step="0.0001" value={feeFx} onChange={(event) => setFeeFx(event.target.value)} />
                </Field>
              ) : null}
              <div className="flex items-start gap-3 rounded-md border bg-background p-3">
                <Checkbox
                  checked={createMatchingContribution}
                  disabled={side !== "BUY" || Boolean(editingTradeId)}
                  onCheckedChange={(checked) => setCreateMatchingContribution(Boolean(checked))}
                />
                <div className="grid gap-2">
                  <Label>
                    Create matching {formatCurrency(settings.planMonthlyContributionAud, "AUD")} contribution automatically
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={matchingContributionAud}
                      disabled={!createMatchingContribution || side !== "BUY" || Boolean(editingTradeId)}
                      onChange={(event) => setMatchingContributionAud(event.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={tradeFx}
                      disabled={!createMatchingContribution || side !== "BUY" || Boolean(editingTradeId)}
                      onChange={(event) => setTradeFx(event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Buy/sell gross: {formatCurrency(tradeGrossUsd, "USD")}. Matching contribution converts to {formatCurrency(matchingUsd, "USD")}.
              </p>
              <Field label="Notes">
                <Textarea value={tradeNotes} onChange={(event) => setTradeNotes(event.target.value)} />
              </Field>
              <Button onClick={saveTrade} disabled={Number(shares) <= 0 || Number(effectiveTradePriceUsd) <= 0}>
                <Plus className="h-4 w-4" />
                {editingTradeId ? "Save trade" : "Log trade"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="rounded-md border bg-muted p-6 text-sm text-muted-foreground">
                No contributions or trades yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isContribution = row.kind === "contribution";
                    const item = row.item;
                    return (
                      <TableRow key={`${row.kind}-${item.id}`}>
                        <TableCell>{formatDisplayDate(row.date)}</TableCell>
                        <TableCell>{isContribution ? "Contribution" : (item as Trade).side}</TableCell>
                        <TableCell>{isContribution ? "-" : formatShares((item as Trade).shares)}</TableCell>
                        <TableCell>
                          {isContribution ? "-" : formatCurrency((item as Trade).pricePerShareUsd, "USD")}
                        </TableCell>
                        <TableCell>
                          {isContribution
                            ? formatCurrency((item as Contribution).amountUsd, "USD")
                            : formatCurrency((item as Trade).totalAmountUsd, "USD")}
                        </TableCell>
                        <TableCell>
                          {isContribution ? "-" : formatCurrency((item as Trade).feesUsd, "USD")}
                        </TableCell>
                        <TableCell>{isContribution ? (item as Contribution).currencyEntered : "USD"}</TableCell>
                        <TableCell className="max-w-48 truncate">{item.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                isContribution
                                  ? editContribution(item as Contribution)
                                  : editTrade(item as Trade)
                              }
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                isContribution
                                  ? tracker.deleteContribution(item.id)
                                  : tracker.deleteTrade(item.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
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

function LatestPriceControls({
  currentPriceUsd,
  isRefreshing,
  onRefresh,
  onUseLatest,
}: {
  currentPriceUsd: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  onUseLatest: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        Latest tracker price:{" "}
        {currentPriceUsd > 0 ? formatCurrency(currentPriceUsd, "USD") : "not loaded"}
      </span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onUseLatest}>
          Use latest
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
