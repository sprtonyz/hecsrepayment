import { createClient } from "@supabase/supabase-js";
import type { TrackerSnapshot } from "@/lib/storage/types";
import { getSharedNewsConfig, isSharedNewsSyncEnabled } from "@/lib/shared-news/config";
import {
  readLocalSharedTrackerSnapshot,
  writeLocalSharedTrackerSnapshot,
} from "@/lib/shared-tracker/localStore";

const SHARED_TRACKER_SNAPSHOTS_TABLE = "shared_tracker_snapshots";
const SHARED_TRACKER_SNAPSHOT_ID = "singleton";

type SharedTrackerSnapshotRow = {
  id: string;
  snapshot: Partial<TrackerSnapshot>;
  updated_at?: string;
};

export type SharedTrackerSnapshotResult = {
  enabled: boolean;
  snapshot?: Partial<TrackerSnapshot>;
  updatedAt?: string;
  source?: "shared" | "local" | "memory" | "file";
  message?: string;
};

export type SharedTrackerSyncResult = {
  enabled: boolean;
  synced: boolean;
  updatedAt?: string;
  source?: "shared" | "local" | "memory" | "file";
  message?: string;
};

export async function upsertSharedTrackerSnapshot(
  snapshot: Partial<TrackerSnapshot>,
  syncedAt = new Date().toISOString(),
): Promise<SharedTrackerSyncResult> {
  if (!isSharedNewsSyncEnabled()) {
    const saved = await writeLocalSharedTrackerSnapshot(snapshot, syncedAt);
    return {
      enabled: true,
      synced: false,
      updatedAt: saved.updatedAt,
      source: saved.source,
      message: "Shared tracker sync is not configured; saved locally only.",
    };
  }

  const saved = await writeLocalSharedTrackerSnapshot(snapshot, syncedAt);
  const supabase = createSharedTrackerClient();
  const row: SharedTrackerSnapshotRow = {
    id: SHARED_TRACKER_SNAPSHOT_ID,
    snapshot,
    updated_at: syncedAt,
  };

  const { error } = await supabase
    .from(SHARED_TRACKER_SNAPSHOTS_TABLE)
    .upsert(row, { onConflict: "id" });

  if (error) {
    return {
      enabled: true,
      synced: false,
      updatedAt: saved.updatedAt,
      message: `Shared tracker sync failed: ${error.message}`,
      source: saved.source,
    };
  }

  return {
    enabled: true,
    synced: true,
    updatedAt: syncedAt,
    source: saved.source,
  };
}

export async function getSharedTrackerSnapshot(): Promise<SharedTrackerSnapshotResult> {
  if (!isSharedNewsSyncEnabled()) {
    const local = await readLocalSharedTrackerSnapshot();
    if (local.enabled) {
      return {
        enabled: true,
        snapshot: local.snapshot,
        updatedAt: local.updatedAt,
        source: local.source,
        message: "Shared tracker sync is not configured; using local snapshot.",
      };
    }

    return { enabled: false };
  }

  const supabase = createSharedTrackerClient();
  try {
    const { data, error } = await supabase
      .from(SHARED_TRACKER_SNAPSHOTS_TABLE)
      .select("*")
      .eq("id", SHARED_TRACKER_SNAPSHOT_ID)
      .maybeSingle();

    if (error) {
      throw new Error(`Shared tracker snapshot read failed: ${error.message}`);
    }

    if (!data) {
      const local = await readLocalSharedTrackerSnapshot();
      if (local.enabled) {
        return {
          enabled: true,
          snapshot: local.snapshot,
          updatedAt: local.updatedAt,
          source: local.source,
          message: "Shared tracker snapshot not found remotely; using local snapshot.",
        };
      }

      return { enabled: true };
    }

    const row = data as SharedTrackerSnapshotRow;
    return {
      enabled: true,
      snapshot: row.snapshot,
      updatedAt: row.updated_at,
      source: "shared",
    };
  } catch (error) {
    const local = await readLocalSharedTrackerSnapshot();
    if (local.enabled) {
      return {
        enabled: true,
        snapshot: local.snapshot,
        updatedAt: local.updatedAt,
        source: local.source,
        message: error instanceof Error ? error.message : "Shared tracker read failed.",
      };
    }

    throw error;
  }
}

function createSharedTrackerClient() {
  const { url, secretKey } = getSharedNewsConfig();
  if (!url || !secretKey) {
    throw new Error("Shared tracker sync is not configured.");
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
