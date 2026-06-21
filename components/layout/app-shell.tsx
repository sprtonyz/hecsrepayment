"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { indexedDbAdapter } from "@/lib/storage/indexedDb";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/storage/types";

type TrackerDataOptions = NonNullable<Parameters<typeof useTrackerData>[0]>;

export function AppShell({
  children,
  title,
  subtitle,
  initialTrackerSnapshot,
  initialTrackerSyncState,
  initialDisplayCurrency,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  initialTrackerSnapshot?: TrackerDataOptions["initialSnapshot"];
  initialTrackerSyncState?: TrackerDataOptions["initialSyncState"];
  initialDisplayCurrency?: TrackerDataOptions["initialDisplayCurrency"];
}) {
  const { settings, saveSettings, syncState } = useTrackerData({
    initialSnapshot: initialTrackerSnapshot,
    initialSyncState: initialTrackerSyncState,
    initialDisplayCurrency,
  });
  const [isDebugMenuOpen, setIsDebugMenuOpen] = useState(false);

  async function setDisplayCurrency(currency: Currency) {
    if (settings.displayCurrency !== currency) {
      await saveSettings({ displayCurrency: currency });
    }
  }

  function forceHardRefresh() {
    if (typeof window === "undefined") {
      return;
    }

    window.location.reload();
  }

  async function resetSiteState() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await indexedDbAdapter.reset();
    } catch {
      // If IndexedDB reset fails, still clear the rest of the site state.
    }

    try {
      window.localStorage.removeItem("aapl-shell-sidebar");
      window.localStorage.removeItem("aaplCatchUpTracker:coreSnapshot");
      window.localStorage.removeItem("aaplCatchUpTracker:displayCurrency");
      window.localStorage.removeItem("aaplCatchUpTracker:sitePinUnlocked");
      document.cookie = "aaplCatchUpTracker:displayCurrency=; path=/; max-age=0; samesite=lax";
    } catch {
      // Best effort only.
    }

    window.location.reload();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-100">
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-10rem] top-28 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-12rem] h-[24rem] w-[24rem] rounded-full bg-amber-400/10 blur-3xl" />
      </div>
      <Toaster richColors position="top-right" duration={1000} />
      <div
        className={cn(
          "relative z-10 mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-6 xl:px-8",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-4 rounded-[1.5rem] px-1 pt-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
                {title}
              </p>
              {subtitle ? (
                <p className="max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={syncBadgeVariant(syncState.state)}>{syncState.label}</Badge>
              <div className="relative">
                <Button
                  aria-expanded={isDebugMenuOpen}
                  aria-label="Debug"
                  className="hidden rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 lg:inline-flex"
                  onClick={() => setIsDebugMenuOpen((current) => !current)}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCw className="h-4 w-4" />
                  Debug
                </Button>
                {isDebugMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1830] p-1 shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
                    <button
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/8"
                      onClick={() => {
                        setIsDebugMenuOpen(false);
                        forceHardRefresh();
                      }}
                      type="button"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Hard refresh
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-amber-100 hover:bg-white/8"
                      onClick={() => {
                        setIsDebugMenuOpen(false);
                        resetSiteState();
                      }}
                      type="button"
                    >
                      Reset site state
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                <Button
                  aria-label="Switch display currency to USD"
                  size="sm"
                  variant={settings.displayCurrency === "USD" ? "default" : "ghost"}
                  className={cn(
                    "h-9 rounded-full px-3 text-xs",
                    settings.displayCurrency !== "USD" && "text-slate-200 hover:bg-white/10",
                  )}
                  onClick={() => setDisplayCurrency("USD")}
                >
                  USD
                </Button>
                <Button
                  aria-label="Switch display currency to AUD"
                  size="sm"
                  variant={settings.displayCurrency === "AUD" ? "default" : "ghost"}
                  className={cn(
                    "h-9 rounded-full px-3 text-xs",
                    settings.displayCurrency !== "AUD" && "text-slate-200 hover:bg-white/10",
                  )}
                  onClick={() => setDisplayCurrency("AUD")}
                >
                  AUD
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 pb-4">
            <div>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function syncBadgeVariant(state: string): "default" | "secondary" | "outline" | "success" | "warning" {
  if (state === "synced") {
    return "success";
  }
  if (state === "error") {
    return "warning";
  }
  if (state === "syncing" || state === "loading") {
    return "secondary";
  }
  return "outline";
}
