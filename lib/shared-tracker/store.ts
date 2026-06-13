import { createClient } from "@supabase/supabase-js";
import type { TrackerSnapshot } from "@/lib/storage/types";
import { getSharedNewsConfig, isSharedNewsSyncEnabled } from "@/lib/shared-news/config";

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
};

export type SharedTrackerSyncResult = {
  enabled: boolean;
  synced: boolean;
  updatedAt?: string;
};

export async function upsertSharedTrackerSnapshot(
  snapshot: Partial<TrackerSnapshot>,
  syncedAt = new Date().toISOString(),
): Promise<SharedTrackerSyncResult> {
  if (!isSharedNewsSyncEnabled()) {
    return { enabled: false, synced: false };
  }

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
    throw new Error(`Shared tracker sync failed: ${error.message}`);
  }

  return {
    enabled: true,
    synced: true,
    updatedAt: syncedAt,
  };
}

export async function getSharedTrackerSnapshot(): Promise<SharedTrackerSnapshotResult> {
  if (!isSharedNewsSyncEnabled()) {
    return { enabled: false };
  }

  const supabase = createSharedTrackerClient();
  const { data, error } = await supabase
    .from(SHARED_TRACKER_SNAPSHOTS_TABLE)
    .select("*")
    .eq("id", SHARED_TRACKER_SNAPSHOT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Shared tracker snapshot read failed: ${error.message}`);
  }

  if (!data) {
    return { enabled: true };
  }

  const row = data as SharedTrackerSnapshotRow;
  return {
    enabled: true,
    snapshot: row.snapshot,
    updatedAt: row.updated_at,
  };
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
