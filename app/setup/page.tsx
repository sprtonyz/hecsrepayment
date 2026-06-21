import { SetupWizard } from "@/components/forms/setup-wizard";
import { loadTrackerBootstrap } from "@/lib/shared-tracker/bootstrap";
import { redirect } from "next/navigation";

export default async function SetupPage() {
  const trackerBootstrap = await loadTrackerBootstrap();
  if (trackerBootstrap.initialTrackerSnapshot?.saleEvents?.length) {
    redirect("/dashboard");
  }
  return <SetupWizard {...trackerBootstrap} />;
}
