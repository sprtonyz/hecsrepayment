"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, Home, LineChart, Settings, WalletCards } from "lucide-react";
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

  async function setDisplayCurrency(currency: Currency) {
    if (settings.displayCurrency !== currency) {
      await saveSettings({ displayCurrency: currency });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold leading-tight">AAPL Catch-Up Tracker</p>
                  {settings.isDemoMode ? <Badge variant="warning">Demo data</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Had I Held vs Rebuild Portfolio, valued in USD
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={syncBadgeVariant(syncState.state)}>{syncState.label}</Badge>
                  {syncState.detail ? (
                    <p className="text-xs text-muted-foreground">{syncState.detail}</p>
                  ) : null}
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <div className="rounded-md border bg-muted p-1">
                <Button
                  size="sm"
                  variant={settings.displayCurrency === "USD" ? "default" : "ghost"}
                  onClick={() => setDisplayCurrency("USD")}
                >
                  USD
                </Button>
                <Button
                  size="sm"
                  variant={settings.displayCurrency === "AUD" ? "default" : "ghost"}
                  onClick={() => setDisplayCurrency("AUD")}
                >
                  AUD
                </Button>
              </div>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Button
                  key={item.href}
                  asChild
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                  className={cn("shrink-0", active && "text-primary")}
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          For personal tracking only. This is not financial advice and may not reflect tax,
          brokerage, or market-data limitations.
        </div>
      </footer>
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
