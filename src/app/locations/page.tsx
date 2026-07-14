import { MapPin } from "lucide-react";

import { getLocations } from "@/lib/mock-data";

export default async function LocationsPage(): Promise<React.JSX.Element> {
  const locations = await getLocations();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Locations</h1>
        <p className="text-sm text-muted-foreground">Where you coach.</p>
      </div>

      {locations.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-sm text-muted-foreground">
          No locations yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <div
              key={location.id}
              className="flex items-start gap-3 rounded-3xl bg-card p-6"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin className="size-5 stroke-[1.75]" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-base font-bold text-foreground">
                  {location.name}
                </span>
                {location.address && (
                  <span className="text-sm text-muted-foreground">
                    {location.address}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
