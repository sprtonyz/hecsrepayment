import { SettingsClient } from "@/components/forms/settings-client";
import { loadTrackerBootstrap } from "@/lib/shared-tracker/bootstrap";

export default async function SettingsPage() {
  const trackerBootstrap = await loadTrackerBootstrap();
  return <SettingsClient {...trackerBootstrap} />;
}
