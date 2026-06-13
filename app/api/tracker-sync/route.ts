import { NextRequest, NextResponse } from "next/server";
import { getSharedTrackerSnapshot, upsertSharedTrackerSnapshot } from "@/lib/shared-tracker/store";

export async function GET() {
  try {
    const snapshot = await getSharedTrackerSnapshot();
    if (!snapshot.enabled) {
      return noStoreJson(
        {
          error: "Shared tracker sync is not configured on this deployment.",
        },
        { status: 503 },
      );
    }

    return noStoreJson({
      enabled: true,
      updatedAt: snapshot.updatedAt,
      snapshot: snapshot.snapshot,
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Shared tracker snapshot is unavailable.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return noStoreJson({ error: "Invalid tracker snapshot payload." }, { status: 400 });
  }

  try {
    const saved = await upsertSharedTrackerSnapshot(body as Record<string, unknown>);
    if (!saved.enabled) {
      return noStoreJson(
        {
          error: "Shared tracker sync is not configured on this deployment.",
        },
        { status: 503 },
      );
    }

    return noStoreJson({
      saved: true,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Shared tracker snapshot is unavailable.",
      },
      { status: 503 },
    );
  }
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "cache-control": "no-store",
    },
  });
}
