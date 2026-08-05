import { useEffect, useState } from "react";
import type { GeoJsonData } from "../types";

export function useGeoJsonData() {
  const [geoJson, setGeoJson] = useState<GeoJsonData | null>(null);

  useEffect(() => {
    let shouldIgnore = false;

    fetch("/finnasnas-map.geojson")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load the bundled map data.");
        }

        return response.json();
      })
      .then((data: GeoJsonData) => {
        if (!shouldIgnore) {
          setGeoJson(data);
        }
      })
      .catch(() => {
        if (!shouldIgnore) {
          setGeoJson({ type: "FeatureCollection", features: [] });
        }
      });

    return () => {
      shouldIgnore = true;
    };
  }, []);

  return geoJson;
}
