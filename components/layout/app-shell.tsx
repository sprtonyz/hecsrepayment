"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Home,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  WalletCards,
} from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTrackerData } from "@/lib/storage/useTrackerData";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/storage/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/setup", label: "Setup", icon: ClipboardList },
  { href: "/transactions", label: "Transactions", icon: WalletCards },
  { href: "/projections", label: "Projections", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const { settings, saveSettings, syncState } = useTrackerData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem("aapl-shell-sidebar") === "collapsed";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "aapl-shell-sidebar",
        isSidebarCollapsed ? "collapsed" : "expanded",
      );
    } catch {
      // Ignore storage errors so the shell stays usable.
    }
  }, [isSidebarCollapsed]);

  async function setDisplayCurrency(currency: Currency) {
    if (settings.displayCurrency !== currency) {
      await saveSettings({ displayCurrency: currency });
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-100">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-28 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-12rem] h-[30rem] w-[30rem] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <Toaster richColors position="top-right" />
      <div
        className={cn(
          "relative z-10 mx-auto grid min-h-screen max-w-[1680px] gap-4 px-4 py-4 sm:px-6 lg:px-6 xl:px-8",
          isSidebarCollapsed ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]" : "lg:grid-cols-[18rem_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "rounded-[2rem] border border-border/70 bg-card/70 p-4 shadow-[0_24px_70px_rgba(4,8,20,0.35)] backdrop-blur-xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:self-start",
            isSidebarCollapsed && "lg:p-3",
          )}
        >
          <div className="flex items-start gap-3 border-b border-border/70 pb-4">
            <Link
              href="/dashboard"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-400 text-primary-foreground shadow-lg shadow-primary/20"
            >
              <BarChart3 className="h-5 w-5" />
            </Link>
            <div className={cn("min-w-0 flex-1", isSidebarCollapsed && "lg:hidden")}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-semibold leading-tight">AAPL Catch-Up</p>
                {settings.isDemoMode ? <Badge variant="warning">Demo</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                A focused rebuild workspace.
              </p>
            </div>
            <Button
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="ml-auto inline-flex rounded-full"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              size="icon"
              variant="ghost"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            <div className={cn("rounded-2xl border border-border/70 bg-background/50 p-4", isSidebarCollapsed && "lg:hidden")}>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                Currency
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={settings.displayCurrency === "USD" ? "default" : "ghost"}
                  className="w-full"
                  onClick={() => setDisplayCurrency("USD")}
                >
                  USD
                </Button>
                <Button
                  size="sm"
                  variant={settings.displayCurrency === "AUD" ? "default" : "ghost"}
                  className="w-full"
                  onClick={() => setDisplayCurrency("AUD")}
                >
                  AUD
                </Button>
              </div>
            </div>

            <nav className="grid gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={active ? "default" : "ghost"}
                    className={cn(
                      "h-12 justify-start rounded-2xl text-sm",
                      isSidebarCollapsed ? "lg:justify-center lg:px-0" : "px-4",
                      active
                        ? "bg-gradient-to-r from-primary to-cyan-400 text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-transparent",
                    )}
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      <span className={cn(isSidebarCollapsed && "lg:hidden")}>{item.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="rounded-[2rem] border border-border/70 bg-card/70 p-5 shadow-[0_24px_70px_rgba(4,8,20,0.35)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                  Portfolio command center
                </p>
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={syncBadgeVariant(syncState.state)}>{syncState.label}</Badge>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            <div>{children}</div>
          </main>

          <footer className="rounded-[1.5rem] border border-border/70 bg-card/60 px-5 py-4 text-xs text-muted-foreground backdrop-blur-xl">
            For personal tracking only. This is not financial advice and may not reflect tax,
            brokerage, or market-data limitations.
          </footer>
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
