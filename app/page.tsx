import { DashboardOverview } from "@/components/dashboard/overview-dashboard";
import { loadComparisonReviewSeeds } from "@/lib/news/codexReviewLookup";
import { loadTrackerBootstrap } from "@/lib/shared-tracker/bootstrap";

const COMPARISON_SYMBOLS = ["AAPL", "NVDA", "AMZN", "TSLA", "SPCX"] as const;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const reviewMonth = new Date().toISOString().slice(0, 7);
  const trackerBootstrap = await loadTrackerBootstrap();
  const comparisonReviews = await loadComparisonReviewSeeds(
    COMPARISON_SYMBOLS,
    reviewMonth,
  ).catch(() => []);

  return (
    <DashboardOverview
      initialTrackerSnapshot={trackerBootstrap.initialTrackerSnapshot}
      initialTrackerSyncState={trackerBootstrap.initialTrackerSyncState}
      initialComparisonReviews={comparisonReviews}
      initialComparisonLoading={false}
    />
  );
}
