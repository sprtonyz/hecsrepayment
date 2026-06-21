import { ProjectionsClient } from "@/components/dashboard/projections-client";
import { loadTrackerBootstrap } from "@/lib/shared-tracker/bootstrap";

export default async function ProjectionsPage() {
  const trackerBootstrap = await loadTrackerBootstrap();
  return <ProjectionsClient {...trackerBootstrap} />;
}
