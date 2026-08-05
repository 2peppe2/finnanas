export type GeoJsonFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates: unknown;
  };
};

export type GeoJsonData = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export type LineStringFeature = GeoJsonFeature & {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

export type PointFeature = GeoJsonFeature & {
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

export type LayerOption = {
  id: string;
  name: string;
  url: string;
  attribution: string;
};

export type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number;
};

export type LocationStatus = "idle" | "loading" | "active" | "error";
