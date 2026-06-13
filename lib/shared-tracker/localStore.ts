import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TrackerSnapshot } from "@/lib/storage/types";

const LOCAL_TRACKER_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data",
  "shared-tracker-snapshot.json",
);

let memorySnapshot: {
  snapshot: Partial<TrackerSnapshot>;
  updatedAt: string;
} | undefined;

export async function readLocalSharedTrackerSnapshot() {
  if (memorySnapshot?.snapshot && hasCoreTrackerData(memorySnapshot.snapshot)) {
    return {
      enabled: true,
      snapshot: memorySnapshot.snapshot,
      updatedAt: memorySnapshot.updatedAt,
      source: "memory" as const,
    };
  }

  const fileSnapshot = await readSnapshotFile();
  if (fileSnapshot?.snapshot && hasCoreTrackerData(fileSnapshot.snapshot)) {
    memorySnapshot = fileSnapshot;
    return {
      enabled: true,
      snapshot: fileSnapshot.snapshot,
      updatedAt: fileSnapshot.updatedAt,
      source: "file" as const,
    };
  }

  return {
    enabled: false,
  };
}

export async function writeLocalSharedTrackerSnapshot(
  snapshot: Partial<TrackerSnapshot>,
  updatedAt = new Date().toISOString(),
) {
  if (!hasCoreTrackerData(snapshot)) {
    return {
      enabled: true,
      saved: true,
      updatedAt,
      source: "memory" as const,
    };
  }

  memorySnapshot = {
    snapshot,
    updatedAt,
  };

  try {
    await mkdir(path.dirname(LOCAL_TRACKER_SNAPSHOT_PATH), { recursive: true });
    await writeFile(
      LOCAL_TRACKER_SNAPSHOT_PATH,
      `${JSON.stringify({ snapshot, updatedAt }, null, 2)}\n`,
      "utf8",
    );
    return {
      enabled: true,
      saved: true,
      updatedAt,
      source: "file" as const,
    };
  } catch {
    return {
      enabled: true,
      saved: true,
      updatedAt,
      source: "memory" as const,
    };
  }
}

async function readSnapshotFile() {
  try {
    const parsed = JSON.parse(await readFile(LOCAL_TRACKER_SNAPSHOT_PATH, "utf8")) as {
      snapshot?: Partial<TrackerSnapshot>;
      updatedAt?: string;
    };
    if (!parsed.snapshot || !hasCoreTrackerData(parsed.snapshot)) {
      return undefined;
    }

    return {
      snapshot: parsed.snapshot,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

function hasCoreTrackerData(snapshot: Partial<TrackerSnapshot>) {
  return Boolean(snapshot.settings && (snapshot.saleEvents?.length || 0) > 0);
}
