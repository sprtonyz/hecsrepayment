"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const SITE_PIN = "4890";
const PIN_STORAGE_KEY = "aaplCatchUpTracker:sitePinUnlocked";

export function SitePinGate({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsMounted(true);
      try {
        setIsUnlocked(window.localStorage.getItem(PIN_STORAGE_KEY) === "true");
      } catch {
        setIsUnlocked(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function unlockSite(candidatePin: string) {
    if (candidatePin.trim() !== SITE_PIN) {
      setError("Incorrect PIN. Please try again.");
      setPin("");
      return;
    }

    try {
      window.localStorage.setItem(PIN_STORAGE_KEY, "true");
    } catch {
      // Best effort only.
    }

    setError(null);
    setIsUnlocked(true);
  }

  if (!isMounted || !isUnlocked) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
        <div className="pointer-events-none absolute inset-0 opacity-100">
          <div className="absolute left-1/2 top-[-10rem] h-[28rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute bottom-[-8rem] right-[-10rem] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <Card className="relative z-10 w-full max-w-md border-border/70 bg-card/95 shadow-[0_30px_100px_rgba(19,33,59,0.18)] backdrop-blur">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Enter site PIN</CardTitle>
                <CardDescription className="mt-1">
                  This dashboard is locked until the correct PIN is entered.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="site-pin">
                  PIN
                </label>
                <Input
                  autoComplete="one-time-code"
                  autoFocus
                  id="site-pin"
                  inputMode="numeric"
                  onChange={(event) => {
                    const nextPin = event.target.value.replace(/\D/g, "").slice(0, 4);
                    setPin(nextPin);
                    if (error) {
                      setError(null);
                    }

                    if (nextPin.length === 4) {
                      unlockSite(nextPin);
                    }
                  }}
                  placeholder="Enter 4-digit PIN"
                  type="password"
                  value={pin}
                />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
