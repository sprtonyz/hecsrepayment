"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDateTime } from "@/lib/domain/dates";
import { formatCurrency } from "@/lib/domain/money";
import { isQuoteCacheStale } from "@/lib/market-data/cache";
import type { CachedQuote } from "@/lib/storage/types";

export function MarketDataStatus({
  quote,
  priceUsd,
  isRefreshing,
  warning,
  onRefresh,
}: {
  quote?: CachedQuote;
  priceUsd: number;
  isRefreshing: boolean;
  warning?: string;
  onRefresh: () => void;
}) {
  const stale = isQuoteCacheStale(quote);
  const label = quote?.provider === "manual" ? "manual" : quote?.isDelayed ? "delayed" : "live";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2">
            {stale ? <WifiOff className="h-5 w-5 text-muted-foreground" /> : <Wifi className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">AAPL price {formatCurrency(priceUsd, "USD")}</p>
              <Badge variant={stale ? "warning" : "success"}>{stale ? "cached" : label}</Badge>
              <Badge variant="outline">{quote?.provider || "manual"}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Last updated {quote?.asOf ? formatDisplayDateTime(quote.asOf) : "from manual fallback"}.
              {quote?.sourceNote ? ` ${quote.sourceNote}` : ""}
            </p>
            {warning ? <p className="mt-1 text-sm text-destructive">{warning}</p> : null}
          </div>
        </div>
        <Button onClick={onRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh prices
        </Button>
      </CardContent>
    </Card>
  );
}
