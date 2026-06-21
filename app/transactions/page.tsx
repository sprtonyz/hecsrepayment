import { Suspense } from "react";
import { TransactionsClient } from "@/components/forms/transactions-client";
import { loadTrackerBootstrap } from "@/lib/shared-tracker/bootstrap";

export default async function TransactionsPage() {
  const trackerBootstrap = await loadTrackerBootstrap();
  return (
    <Suspense fallback={null}>
      <TransactionsClient {...trackerBootstrap} />
    </Suspense>
  );
}
