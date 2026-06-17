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
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-10rem] top-28 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-12rem] h-[24rem] w-[24rem] rounded-full bg-amber-400/10 blur-3xl" />
      </div>
      <Toaster richColors position="top-right" />
      <div
        className={cn(
          "relative z-10 mx-auto grid min-h-screen max-w-[1680px] gap-5 px-4 py-4 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-6 xl:px-8",
          isSidebarCollapsed && "lg:grid-cols-[5.5rem_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "rounded-[2rem] border border-slate-800/80 bg-[#0f1830] p-4 text-slate-100 shadow-[0_30px_100px_rgba(15,23,42,0.35)] lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:self-start",
            isSidebarCollapsed && "lg:p-3",
          )}
        >
          <div className="flex items-start gap-3 border-b border-white/8 pb-4">
            <Link
              href="/dashboard"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3b6df6] text-white shadow-[0_14px_28px_rgba(59,109,246,0.35)]"
            >
              <BarChart3 className="h-5 w-5" />
            </Link>
            <div className={cn("min-w-0 flex-1", isSidebarCollapsed && "lg:hidden")}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold leading-tight text-white">Rebuild Hub</p>
                {settings.isDemoMode ? <Badge variant="warning">Demo</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-slate-400">Version 2 shell</p>
            </div>
            <Button
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="ml-auto inline-flex rounded-full bg-white/5 text-white hover:bg-white/10"
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
            <div className={cn("rounded-[1.5rem] border border-white/8 bg-white/4 p-4", isSidebarCollapsed && "lg:hidden")}>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
                Currency
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={settings.displayCurrency === "USD" ? "default" : "ghost"}
                  className={cn(
                    "w-full",
                    settings.displayCurrency !== "USD" && "text-slate-200 hover:bg-white/10",
                  )}
                  onClick={() => setDisplayCurrency("USD")}
                >
                  USD
                </Button>
                <Button
                  size="sm"
                  variant={settings.displayCurrency === "AUD" ? "default" : "ghost"}
                  className={cn(
                    "w-full",
                    settings.displayCurrency !== "AUD" && "text-slate-200 hover:bg-white/10",
                  )}
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
                        ? "bg-[#3b6df6] text-white shadow-[0_14px_24px_rgba(59,109,246,0.32)]"
                        : "bg-transparent text-slate-300 hover:bg-white/8 hover:text-white",
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

          <div className={cn("mt-6 rounded-[1.75rem] border border-white/8 bg-white/5 p-4", isSidebarCollapsed && "lg:hidden")}>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-500">Today&apos;s focus</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              A quick glance should answer the question before the user has to dig.
            </p>
            <div className="mt-4 grid gap-2">
              <Button size="sm" className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                Log today
              </Button>
              <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                Review entries
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
                Check trends
              </Button>
            </div>
          </div>
        </aside>

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
