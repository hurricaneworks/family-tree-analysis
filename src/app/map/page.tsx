import { MapView } from "./MapView";

import { Comments } from "@/components/Comments";
export default function MapPage() {
  return (
    <>
      <h1>Where the family has been</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every dated event from 1500 onwards, placed on the map. Drag the year to watch the family move; click a place to see who was there. Hollow rings mark places that could only be located to the parish or county.
      </p>
      <MapView />
      <Comments page="/map" />
    </>
  );
}
