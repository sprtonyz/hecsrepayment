import type { TrackerSnapshot } from "@/lib/storage/types";
import type { TrackerSyncState } from "@/lib/storage/useTrackerData";
import { getSharedTrackerSnapshot } from "@/lib/shared-tracker/store";
import { readLocalSharedTrackerSnapshot } from "@/lib/shared-tracker/localStore";
import { withTimeout } from "@/lib/utils/async";
import { cookies } from "next/headers";
import type { Currency } from "@/lib/storage/types";

export type TrackerBootstrapState = {
  initialTrackerSnapshot?: Partial<TrackerSnapshot>;
  initialTrackerSyncState?: TrackerSyncState;
  initialDisplayCurrency?: Currency;
};

const DISPLAY_CURRENCY_STORAGE_KEY = "aaplCatchUpTracker:displayCurrency";

export async function loadTrackerBootstrap(): Promise<TrackerBootstrapState> {
  const localTracker = await readLocalSharedTrackerSnapshot().catch(() => undefined);
  const initialDisplayCurrency =
    localTracker?.snapshot?.settings?.displayCurrency || (await readInitialDisplayCurrency());

  if (localTracker?.enabled && localTracker.snapshot) {
    return {
      initialTrackerSnapshot: localTracker.snapshot,
      initialDisplayCurrency,
      initialTrackerSyncState: {
        state: "synced",
        label: "Synced",
        detail: "Loaded from local snapshot.",
        updatedAt: localTracker.updatedAt,
      },
    };
  }

  const sharedTracker = await withTimeout(getSharedTrackerSnapshot(), 500);

  if (sharedTracker?.enabled && sharedTracker.snapshot) {
    return {
      initialTrackerSnapshot: sharedTracker.snapshot,
      initialDisplayCurrency,
      initialTrackerSyncState: {
        state: "synced",
        label: "Synced",
        detail: "Loaded from shared storage.",
        updatedAt: sharedTracker.updatedAt,
      },
    };
  }

  if (sharedTracker?.enabled) {
    return {
      initialDisplayCurrency,
      initialTrackerSyncState: {
        state: "empty",
        label: "Waiting for setup",
        detail: "No shared tracker snapshot found yet.",
        updatedAt: sharedTracker.updatedAt,
      },
    };
  }

  if (sharedTracker?.message) {
    return {
      initialDisplayCurrency,
      initialTrackerSyncState: {
        state: "local",
        label: "Local only",
        detail: sharedTracker.message,
        updatedAt: sharedTracker.updatedAt,
      },
    };
  }

  return { initialDisplayCurrency };
}

async function readInitialDisplayCurrency(): Promise<Currency | undefined> {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(DISPLAY_CURRENCY_STORAGE_KEY)?.value;
    return cookieValue === "AUD" || cookieValue === "USD" ? cookieValue : undefined;
  } catch {
    return undefined;
  }
}
