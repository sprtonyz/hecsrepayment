"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoTip({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
        aria-label={`Help: ${title}`}
        aria-expanded={open}
        className="rounded-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => setOpen((value) => !value)}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 top-6 z-50 w-72 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg",
          )}
        >
          <p className="font-medium">{title}</p>
          <div className="mt-1 text-muted-foreground">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
