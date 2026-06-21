"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CircleAlert, Edit2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDate, todayIso } from "@/lib/domain/dates";
import { formatCurrency, formatShares, roundMoney } from "@/lib/domain/money";
import type { TrackerBootstrapState } from "@/lib/shared-tracker/bootstrap";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import type { Currency, Trade } from "@/lib/storage/types";

const DEFAULT_TICKERS = ["AAPL", "AMZN", "NVDA", "SPCX", "TSLA"] as const;
const CUSTOM_TICKER_VALUE = "__custom__";
const DEFAULT_PLAN_START_DATE = "2026-04-01";
const DEFAULT_BROKERAGE_FEE_USD = "3";

type QuoteState = {
  fetchedPriceUsd?: number;
  fetchedAt?: string;
  error?: string;
};

export function TransactionsClient({
  initialTrackerSnapshot,
  initialTrackerSyncState,
  initialDisplayCurrency,
}: TrackerBootstrapState) {
  const tracker = useTrackerData({
    initialSnapshot: initialTrackerSnapshot,
    initialSyncState: initialTrackerSyncState,
    initialDisplayCurrency,
  });
  const { snapshot, settings, latestAudToUsdRate } = tracker;
  const baseTicker = (settings.baseTicker || "AAPL").toUpperCase();
  const [tradeDate, setTradeDate] = useState(() => todayIso());
  const [tickerChoice, setTickerChoice] = useState<string>(baseTicker);
  const [customTicker, setCustomTicker] = useState("");
  const [pricePerShareUsd, setPricePerShareUsd] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);
  const [shares, setShares] = useState("");
  const [stockReceivedUsd, setStockReceivedUsd] = useState("");
  const [cashOutAud, setCashOutAud] = useState("");
  const [fees, setFees] = useState(DEFAULT_BROKERAGE_FEE_USD);
  const [feeCurrency, setFeeCurrency] = useState<Currency>("USD");
  const [notes, setNotes] = useState("");
  const [editingTradeId, setEditingTradeId] = useState<string | undefined>();
  const [quoteRefreshTick, setQuoteRefreshTick] = useState(0);
  const [quoteState, setQuoteState] = useState<QuoteState>({});

  const tickerOptions = useMemo(() => {
    const options = new Set<string>([baseTicker, ...DEFAULT_TICKERS]);
    for (const trade of snapshot.trades) {
      if (trade.ticker) {
        options.add(trade.ticker.toUpperCase());
      }
    }
    for (const saleEvent of snapshot.saleEvents) {
      if (saleEvent.ticker) {
        options.add(saleEvent.ticker.toUpperCase());
      }
    }
    return Array.from(options).sort((left, right) => left.localeCompare(right));
  }, [baseTicker, snapshot.saleEvents, snapshot.trades]);

  const activeTicker = useMemo(() => {
    if (tickerChoice === CUSTOM_TICKER_VALUE) {
      return customTicker.trim().toUpperCase();
    }
    return (tickerChoice || baseTicker).trim().toUpperCase();
  }, [baseTicker, customTicker, tickerChoice]);

  const [debouncedTicker, setDebouncedTicker] = useState(activeTicker);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedTicker(activeTicker);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeTicker]);

  useEffect(() => {
    if (!debouncedTicker) {
      return;
    }

    let cancelled = false;

    async function loadQuote() {
      try {
        const response = await fetch(
          `/api/market/quote?symbol=${encodeURIComponent(debouncedTicker)}&provider=${settings.marketDataProvider}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(`Quote fetch failed with status ${response.status}.`);
        }

        const data = (await response.json()) as { price?: number; priceUsd?: number };
        const nextPrice = Number(data.price ?? data.priceUsd ?? 0);
        if (!cancelled && Number.isFinite(nextPrice) && nextPrice > 0) {
          setQuoteState({
            fetchedPriceUsd: nextPrice,
            fetchedAt: todayIso(),
            error: undefined,
          });
          if (!priceEdited) {
            setPricePerShareUsd(nextPrice.toFixed(2));
          }
          return;
        }

        throw new Error("No price returned.");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setQuoteState({
          fetchedPriceUsd: undefined,
          fetchedAt: undefined,
          error: error instanceof Error ? error.message : "Could not fetch quote.",
        });
      }
    }

    void loadQuote();

    return () => {
      cancelled = true;
    };
  }, [debouncedTicker, priceEdited, quoteRefreshTick, settings.marketDataProvider]);

  const selectedTradeRows = useMemo(
    () =>
      [...snapshot.trades]
        .sort((left, right) => right.date.localeCompare(left.date))
        .filter((trade) => trade.side === "BUY" || trade.side === "SELL"),
    [snapshot.trades],
  );

  const stockReceivedUsdValue = Number(stockReceivedUsd || 0);
  const feesUsd =
    feeCurrency === "USD"
      ? Number(fees || 0)
      : roundMoney(Number(fees || 0) * latestAudToUsdRate);
  const netStockReceivedUsd = Math.max(0, roundMoney(stockReceivedUsdValue - feesUsd));
  const totalReceivedUsd = roundMoney(
    selectedTradeRows.reduce((total, trade) => total + trade.grossAmountUsd, 0),
  );
  const totalOutgoingAud = roundMoney(
    selectedTradeRows.reduce(
      (total, trade) =>
        total + (trade.cashOutAud ?? (latestAudToUsdRate > 0 ? trade.totalAmountUsd / latestAudToUsdRate : 0)),
      0,
    ),
  );

  function startNewTrade() {
    setEditingTradeId(undefined);
    setTradeDate(todayIso());
    setTickerChoice(baseTicker);
    setCustomTicker(baseTicker);
    setShares("");
    setStockReceivedUsd("");
    setCashOutAud("");
    setFees(DEFAULT_BROKERAGE_FEE_USD);
    setFeeCurrency("USD");
    setNotes("");
    setPriceEdited(false);
    setQuoteState({});
    setQuoteRefreshTick((tick) => tick + 1);
  }

  function editTrade(trade: Trade) {
    setEditingTradeId(trade.id);
    setTradeDate(trade.date);
    setShares(String(trade.shares));
    setPricePerShareUsd(String(trade.pricePerShareUsd));
    setPriceEdited(true);
    setStockReceivedUsd(String(trade.grossAmountUsd));
    setCashOutAud(
      typeof trade.cashOutAud === "number" ? String(trade.cashOutAud) : "",
    );
    setFees(String(trade.feesUsd));
    setFeeCurrency(trade.feeCurrency || "AUD");
    setNotes(trade.notes || "");
    setQuoteState({});

    const upperTicker = trade.ticker.toUpperCase();
    const knownTicker = tickerOptions.includes(upperTicker) ? upperTicker : CUSTOM_TICKER_VALUE;
    setTickerChoice(knownTicker);
    setCustomTicker(upperTicker);
  }

  async function saveTrade() {
    if (
      !activeTicker ||
      Number(shares) <= 0 ||
      Number(pricePerShareUsd) <= 0 ||
      Number(stockReceivedUsd) <= 0 ||
      Number(cashOutAud) <= 0
    ) {
      return;
    }

    if (editingTradeId) {
      await tracker.deleteTrade(editingTradeId);
    }

    const price = Number(pricePerShareUsd || 0);
    const qty = Number(shares || 0);
    const cashOutAudAmount = roundMoney(Number(cashOutAud || 0));

    await tracker.addContributionWithPurchase({
      contribution: {
        date: tradeDate,
        amount: cashOutAudAmount,
        currencyEntered: "AUD",
        fxRateToUsd: latestAudToUsdRate,
        notes,
      },
      purchase: {
        ticker: activeTicker,
        shares: qty,
        pricePerShareUsd: price,
        fees: Number(fees || 0),
        feeCurrency,
        feeFxRateToUsd: latestAudToUsdRate,
        notes,
      },
    });

    startNewTrade();
  }

  return (
    <AppShell
      title="Transactions"
      subtitle="Record stock purchases with the live ticket price and keep the dashboard in sync."
      initialDisplayCurrency={initialDisplayCurrency}
      initialTrackerSnapshot={initialTrackerSnapshot}
      initialTrackerSyncState={initialTrackerSyncState}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden border border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <CardContent className="px-6 pb-6 pt-8">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300/80">
                      Ledger first
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-white">
                      One purchase form, one clean ledger.
                    </h2>
                    <p className="max-w-xl text-sm leading-6 text-slate-300">
                      Pick a stock ticket, let us fetch the live price, and override anything
                      you paid differently. Saving here updates the shared tracker and the main
                      dashboard immediately.
                    </p>
                  </div>
                  <Badge className="rounded-full bg-white/10 px-3 py-1 text-slate-100" variant="outline">
                    {snapshot.contributions.length + selectedTradeRows.length} ledger rows
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-slate-50 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Reset the ledger? This clears all transactions but keeps your settings and market data.",
                        )
                      ) {
                        return;
                      }
                      void tracker.resetLedger();
                    }}
                  >
                    Reset ledger
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricPill label="Total ledger" value={String(selectedTradeRows.length)} />
                  <MetricPill label="Stock received" value={formatCurrency(totalReceivedUsd, "USD")} />
                  <MetricPill label="Cash out" value={formatCurrency(totalOutgoingAud, "AUD")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>{editingTradeId ? "Edit stock purchase" : "Add stock purchase"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                The stock ticket drives the fetched price. You can still override the price if
                you bought at a different level.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Date of purchase">
                  <Input type="date" value={tradeDate} onChange={(event) => setTradeDate(event.target.value)} />
                </Field>
                <Field label="Stock ticket">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={tickerChoice || baseTicker}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTickerChoice(value);
                      setPriceEdited(false);
                      setQuoteState({});
                      if (value !== CUSTOM_TICKER_VALUE) {
                        setCustomTicker(value);
                      } else {
                        setCustomTicker("");
                      }
                      setPricePerShareUsd("");
                      setQuoteRefreshTick((tick) => tick + 1);
                    }}
                  >
                    {tickerOptions.map((ticker) => (
                      <option key={ticker} value={ticker}>
                        {ticker}
                      </option>
                    ))}
                    <option value={CUSTOM_TICKER_VALUE}>Custom ticker</option>
                  </select>
                </Field>
              </div>

              {tickerChoice === CUSTOM_TICKER_VALUE ? (
                <Field label="Custom ticker">
                  <Input
                    value={customTicker}
                    onChange={(event) => {
                      setCustomTicker(event.target.value.toUpperCase());
                      setPriceEdited(false);
                      setQuoteState({});
                    }}
                    placeholder="e.g. MSFT"
                  />
                </Field>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Stock received in USD"
                  hintTitle="Amount Stake has received"
                  hintBody="Amount Stake has received."
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockReceivedUsd}
                    onChange={(event) => setStockReceivedUsd(event.target.value)}
                  />
                </Field>
                <Field
                  label="Current outgoing AUD"
                  hintTitle="Amount that came out of aus bank"
                  hintBody="Amount that came out of aus bank."
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashOutAud}
                    onChange={(event) => setCashOutAud(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Stock price USD">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerShareUsd}
                    onChange={(event) => {
                      setPriceEdited(true);
                      setPricePerShareUsd(event.target.value);
                    }}
                  />
                  <PriceControls
                    fetchedPriceUsd={quoteState.fetchedPriceUsd}
                    fetchedAt={quoteState.fetchedAt}
                    error={quoteState.error}
                    onRefresh={() => setQuoteRefreshTick((tick) => tick + 1)}
                    onUseFetched={() => {
                      setPriceEdited(false);
                      if (quoteState.fetchedPriceUsd) {
                        setPricePerShareUsd(quoteState.fetchedPriceUsd.toFixed(2));
                      }
                    }}
                  />
                </Field>
                <Field label="Stock qty">
                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={shares}
                    onChange={(event) => setShares(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fees">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fees}
                    onChange={(event) => setFees(event.target.value)}
                  />
                </Field>
                <Field label="Fee currency">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={feeCurrency}
                    onChange={(event) => setFeeCurrency(event.target.value as Currency)}
                  >
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4">
                <SummaryStat
                  label="Net stock received in USD"
                  value={formatCurrency(netStockReceivedUsd, "USD")}
                />
              </div>

              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional context for the purchase"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void saveTrade()}
                  disabled={
                    !activeTicker ||
                    Number(shares) <= 0 ||
                    Number(pricePerShareUsd) <= 0 ||
                    Number(stockReceivedUsd) <= 0 ||
                    Number(cashOutAud) <= 0
                  }
                >
                  <Plus className="h-4 w-4" />
                  {editingTradeId ? "Save purchase" : "Add purchase"}
                </Button>
                {editingTradeId ? (
                  <Button type="button" variant="ghost" onClick={startNewTrade}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Purchase ledger</CardTitle>
              <p className="text-sm text-muted-foreground">
                Every saved row updates IndexedDB and the shared tracker snapshot, so the main
                dashboard sees the same data.
              </p>
            </CardHeader>
            <CardContent>
              {selectedTradeRows.length === 0 ? (
                <EmptyState />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price USD</TableHead>
                      <TableHead>Received USD</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Outgoing AUD</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTradeRows.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>{formatDisplayDate(trade.date)}</TableCell>
                        <TableCell className="font-medium">{trade.ticker}</TableCell>
                        <TableCell>{formatShares(trade.shares)}</TableCell>
                        <TableCell>{formatCurrency(trade.pricePerShareUsd, "USD")}</TableCell>
                        <TableCell>{formatCurrency(trade.grossAmountUsd, "USD")}</TableCell>
                        <TableCell>{formatCurrency(trade.feesUsd, "USD")}</TableCell>
                        <TableCell>
                          {latestAudToUsdRate > 0
                            ? formatCurrency(roundMoney(trade.totalAmountUsd / latestAudToUsdRate), "AUD")
                            : "-"}
                        </TableCell>
                        <TableCell className="max-w-56 truncate">{trade.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => editTrade(trade)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => void tracker.deleteTrade(trade.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>Roll-up</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quick totals for the saved transaction list.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryStat label="Saved trades" value={String(selectedTradeRows.length)} />
                <SummaryStat label="Stock received" value={formatCurrency(totalReceivedUsd, "USD")} />
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                Change the ticket, price, or qty and the dashboard will pick it up on the next
                render.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  children,
  hintTitle,
  hintBody,
}: {
  label: string;
  children: ReactNode;
  hintTitle?: string;
  hintBody?: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {hintTitle && hintBody ? <HintTip title={hintTitle} body={hintBody} /> : null}
      </div>
      {children}
    </div>
  );
}

function HintTip({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Hint: ${title}`}
        aria-expanded={open}
        className="rounded-sm text-amber-500 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => setOpen((value) => !value)}
      >
        <CircleAlert className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-6 z-50 w-72 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
          <p className="font-medium">{title}</p>
          <div className="mt-1 text-muted-foreground">
            <p>{body}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PriceControls({
  fetchedPriceUsd,
  fetchedAt,
  error,
  onRefresh,
  onUseFetched,
}: {
  fetchedPriceUsd?: number;
  fetchedAt?: string;
  error?: string;
  onRefresh: () => void;
  onUseFetched: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {fetchedPriceUsd
          ? `Fetched price: ${formatCurrency(fetchedPriceUsd, "USD")}`
          : error || "No fetched price yet."}
        {fetchedAt ? ` | ${formatDisplayDate(fetchedAt)}` : ""}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onUseFetched} disabled={!fetchedPriceUsd}>
          Use fetched
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-50 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-300/70">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
      <p className="text-sm font-medium">No purchases yet</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Add your first stock purchase on the left and it will appear here.
      </p>
    </div>
  );
}
