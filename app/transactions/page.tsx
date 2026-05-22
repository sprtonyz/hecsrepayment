import { Suspense } from "react";
import { TransactionsClient } from "@/components/forms/transactions-client";

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsClient />
    </Suspense>
  );
}
