import { LocationsView } from "@/components/locations/locations-view";
import { getLocations } from "@/lib/queries/locations";

export default async function LocationsPage(): Promise<React.JSX.Element> {
  const locations = await getLocations();

  return <LocationsView locations={locations} />;
}
