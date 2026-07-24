import { getLocations } from "@/lib/queries/locations";
import { getCoachAvailabilityBlocks, getCoachAvailabilitySeries } from "@/lib/queries/availability";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const [series, blocks, locations] = await Promise.all([
    getCoachAvailabilitySeries(),
    getCoachAvailabilityBlocks(),
    getLocations(),
  ]);

  const oneOffBlocks = blocks.filter((block) => !block.seriesId);

  return <SettingsView series={series} oneOffBlocks={oneOffBlocks} locations={locations} />;
}
