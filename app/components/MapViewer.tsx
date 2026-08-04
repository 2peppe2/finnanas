"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { Menu, X } from "lucide-react";
import { getMarkerIcon } from "../constants/markerIcons";
import {
  findRouteFromCoordinateToMarker,
  getConnectedSegmentsForMarker,
  getSegmentsForRoad,
} from "../routing/findRoute";
import routingGraph from "../routing/routing-graph.generated.json";
import type { RoutingEdge } from "../routing/routingGraph";
import RouteSegmentHighlight from "./RouteSegmentHighlight";

type GeoJsonFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates: unknown;
  };
};

type GeoJsonData = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

type LineStringFeature = GeoJsonFeature & {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

type PointFeature = GeoJsonFeature & {
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

type LayerOption = {
  id: string;
  name: string;
  url: string;
  attribution: string;
};

type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number;
};

type LocationStatus = "idle" | "loading" | "active" | "error";

const insecureLocationMessage =
  "GPS kräver HTTPS på mobilen. Starta appen med dev:https och öppna https-adressen.";

const layerOptions: LayerOption[] = [
  {
    id: "standard",
    name: "Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: "topo",
    name: "Topo",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
  {
    id: "light",
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "dark",
    name: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
];

const defaultCenter: L.LatLngExpression = [57.9853, 14.828];
const routingSegments = routingGraph.edges as RoutingEdge[];

function isLineStringFeature(feature: GeoJsonFeature | null): feature is LineStringFeature {
  return (
    feature?.geometry?.type === "LineString" &&
    Array.isArray(feature.geometry.coordinates)
  );
}

function isPointFeature(feature: GeoJsonFeature | null): feature is PointFeature {
  return (
    feature?.geometry?.type === "Point" &&
    Array.isArray(feature.geometry.coordinates) &&
    feature.geometry.coordinates.length >= 2
  );
}

function getFeatureName(feature: GeoJsonFeature | null) {
  return formatPropertyValue(feature?.properties?.name);
}

function createPointMarkerIcon(feature: PointFeature) {
  const markerName = getFeatureName(feature);
  if (feature.properties?.junction === true) {
    return L.divIcon({
      className: "map-junction-marker",
      html: '<div class="map-junction-dot"></div>',
      iconAnchor: [6, 6],
      iconSize: [12, 12],
      popupAnchor: [0, -6],
    });
  }

  const Icon = getMarkerIcon(markerName);
  const markerColor = String(feature.properties?.["marker-color"] ?? "#dc143c");
  const iconMarkup = renderToStaticMarkup(
    <div className="map-marker-icon" style={{ backgroundColor: markerColor }}>
      <Icon aria-hidden="true" size={20} strokeWidth={2.5} />
    </div>,
  );

  return L.divIcon({
    className: "map-marker",
    html: iconMarkup,
    iconAnchor: [22, 22],
    iconSize: [44, 44],
    popupAnchor: [0, -22],
  });
}

function getFeatureColor(feature: GeoJsonFeature | null) {
  return String(
    feature?.properties?.stroke ??
      feature?.properties?.["marker-color"] ??
      "#ef4444",
  );
}

function getFeaturePathStyle(
  feature: GeoJsonFeature | null | undefined,
): L.PathOptions {
  return {
    color: getFeatureColor(feature ?? null),
    fillColor: String(feature?.properties?.["marker-color"] ?? "#ef4444"),
    fillOpacity: feature?.geometry?.type === "Point" ? 1 : undefined,
    lineCap: "round",
    lineJoin: "round",
    opacity: 0.94,
    weight: 6,
  };
}

function getSelectedLineHaloStyle(): L.PathOptions {
  return {
    className: "selected-road-halo",
    color: "#ffffff",
    interactive: false,
    lineCap: "round",
    lineJoin: "round",
    opacity: 0.95,
    weight: 14,
  };
}

function setLayerSelected(layer: L.Layer, isSelected: boolean) {
  if (layer instanceof L.Marker) {
    layer.getElement()?.classList.toggle("map-marker-selected", isSelected);
    layer.setZIndexOffset(isSelected ? 1000 : 0);
  }

  if (layer instanceof L.Path) {
    if (isSelected) {
      layer.bringToFront();
    }
  }
}

function formatPropertyValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  if (meters >= 100) {
    return `${Math.round(meters / 10) * 10} m`;
  }

  return `${Math.max(1, Math.round(meters / 5) * 5)} m`;
}

function closestDistanceToFeature(
  location: UserLocation | null,
  feature: GeoJsonFeature | null,
) {
  if (!location || !isLineStringFeature(feature)) {
    return null;
  }

  const coordinates = feature.geometry.coordinates;
  if (coordinates.length === 0) {
    return null;
  }

  const originLat = location.lat;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos((originLat * Math.PI) / 180);
  const toPoint = ([lng, lat]: [number, number]) => ({
    x: (lng - location.lng) * metersPerDegreeLng,
    y: (lat - location.lat) * metersPerDegreeLat,
  });

  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = toPoint(coordinates[index]);
    const end = toPoint(coordinates[index + 1]);
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
    const rawPosition =
      segmentLengthSquared === 0
        ? 0
        : -(start.x * segmentX + start.y * segmentY) / segmentLengthSquared;
    const position = Math.max(0, Math.min(1, rawPosition));
    const closestX = start.x + segmentX * position;
    const closestY = start.y + segmentY * position;
    const distance = Math.hypot(closestX, closestY);

    shortestDistance = Math.min(shortestDistance, distance);
  }

  return shortestDistance;
}

export default function MapViewer() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedLayerRef = useRef<{
    feature: GeoJsonFeature;
    layer: L.Layer;
  } | null>(null);
  const selectedHaloRef = useRef<L.GeoJSON | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [activeLayerId, setActiveLayerId] = useState(layerOptions[0].id);
  const [geoJson, setGeoJson] = useState<GeoJsonData | null>(null);
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(
    null,
  );
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSegmentMenuOpen, setIsSegmentMenuOpen] = useState(false);
  const [highlightedSegmentIds, setHighlightedSegmentIds] = useState<string[]>([]);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragStartYRef = useRef<number | null>(null);

  const activeLayer = useMemo(
    () => layerOptions.find((layer) => layer.id === activeLayerId) ?? layerOptions[0],
    [activeLayerId],
  );

  function clearSelection() {
    if (selectedHaloRef.current) {
      selectedHaloRef.current.remove();
      selectedHaloRef.current = null;
    }

    if (selectedLayerRef.current) {
      setLayerSelected(selectedLayerRef.current.layer, false);
      selectedLayerRef.current = null;
    }

    setSelectedFeature(null);
    setSheetDragY(0);
  }

  function handleSheetPointerDown(event: React.PointerEvent<HTMLElement>) {
    sheetDragStartYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (sheetDragStartYRef.current === null) {
      return;
    }

    setSheetDragY(Math.max(0, event.clientY - sheetDragStartYRef.current));
  }

  function handleSheetPointerEnd(event: React.PointerEvent<HTMLElement>) {
    if (sheetDragStartYRef.current === null) {
      return;
    }

    const dragY = Math.max(0, event.clientY - sheetDragStartYRef.current);
    sheetDragStartYRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragY > 70) {
      clearSelection();
      return;
    }

    setSheetDragY(0);
  }

  function toggleHighlightedSegment(segmentId: string) {
    setHighlightedSegmentIds((currentSegmentIds) =>
      currentSegmentIds.includes(segmentId)
        ? currentSegmentIds.filter((currentSegmentId) => currentSegmentId !== segmentId)
        : [...currentSegmentIds, segmentId],
    );
  }

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

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapElementRef.current, {
      center: defaultCenter,
      zoom: 15,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("click", clearSelection);

    mapRef.current = map;
    setLeafletMap(map);

    return () => {
      map.remove();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      mapRef.current = null;
      setLeafletMap(null);
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      userMarkerRef.current = null;
      accuracyCircleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(activeLayer.url, {
      attribution: activeLayer.attribution,
      maxZoom: activeLayer.id === "topo" ? 17 : 20,
    }).addTo(map);
  }, [activeLayer]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !geoJson) {
      return;
    }

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      selectedLayerRef.current = null;
      selectedHaloRef.current = null;
      setSelectedFeature(null);
    }

    const routeLayer = L.geoJSON(geoJson, {
      pointToLayer: (feature, latLng) => {
        if (!isPointFeature(feature as GeoJsonFeature)) {
          return L.circleMarker(latLng);
        }

        return L.marker(latLng, {
          icon: createPointMarkerIcon(feature as PointFeature),
          keyboard: true,
          title: getFeatureName(feature as PointFeature),
        });
      },
      style: (feature) => getFeaturePathStyle(feature as GeoJsonFeature),
      onEachFeature: (feature, layer) => {
        layer.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          const selected = feature as GeoJsonFeature;
          clearSelection();
          if (isLineStringFeature(selected)) {
            selectedHaloRef.current = L.geoJSON(selected, {
              style: getSelectedLineHaloStyle,
            }).addTo(map);
            selectedHaloRef.current.bringToBack();
          }
          selectedLayerRef.current = { feature: selected, layer };
          setLayerSelected(layer, true);
          setSelectedFeature(selected);
        });
      },
    }).addTo(map);

    routeLayerRef.current = routeLayer;

    const bounds = routeLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        maxZoom: 17,
        paddingBottomRight: [24, 170],
        paddingTopLeft: [24, 80],
      });
    }
  }, [geoJson]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !userLocation) {
      return;
    }

    const latLng: L.LatLngExpression = [userLocation.lat, userLocation.lng];

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(latLng, {
        radius: userLocation.accuracy,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.1,
        interactive: false,
        opacity: 0.28,
        weight: 1,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(latLng);
      accuracyCircleRef.current.setRadius(userLocation.accuracy);
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker(latLng, {
        radius: 8,
        color: "#ffffff",
        fillColor: "#2563eb",
        fillOpacity: 1,
        interactive: false,
        opacity: 1,
        weight: 3,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latLng);
    }
  }, [userLocation]);

  function startLocation() {
    setLocationError(null);

    if (!window.isSecureContext) {
      setLocationStatus("error");
      setLocationError(insecureLocationMessage);
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Den här webbläsaren stödjer inte GPS.");
      return;
    }

    setLocationStatus("loading");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const handleLocation = (position: GeolocationPosition) => {
      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setUserLocation(nextLocation);
      setLocationStatus("active");
      setLocationError(null);
    };

    const handleLocationError = (error: GeolocationPositionError) => {
      setLocationStatus("error");
      setLocationError(
        error.code === error.PERMISSION_DENIED
          ? "Platsbehörighet nekades. Tillåt platsåtkomst i webbläsaren och försök igen."
          : error.code === error.TIMEOUT
            ? "GPS tog för lång tid. Testa igen utomhus eller med bättre signal."
            : "GPS kunde inte hämtas just nu.",
      );
    };

    navigator.geolocation.getCurrentPosition(handleLocation, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 2_000,
      timeout: 12_000,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 2_000,
        timeout: 12_000,
      },
    );
  }

  const selectedProperties = selectedFeature?.properties ?? {};
  const selectedName = formatPropertyValue(selectedProperties.name);
  const propertyEntries = Object.entries(selectedProperties);
  const distanceToSelected = closestDistanceToFeature(userLocation, selectedFeature);
  const isSelectedPoint = isPointFeature(selectedFeature);
  const routeResult = useMemo(() => {
    if (!userLocation || !isPointFeature(selectedFeature)) {
      return null;
    }

    return findRouteFromCoordinateToMarker(
      [userLocation.lng, userLocation.lat],
      getFeatureName(selectedFeature),
    );
  }, [selectedFeature, userLocation]);
  const connectedSegments = useMemo(() => {
    if (!selectedFeature) {
      return [];
    }

    if (isPointFeature(selectedFeature)) {
      return getConnectedSegmentsForMarker(getFeatureName(selectedFeature));
    }

    if (isLineStringFeature(selectedFeature)) {
      return getSegmentsForRoad(getFeatureName(selectedFeature));
    }

    return [];
  }, [selectedFeature]);
  const guidanceText = routeResult
    ? `Följ rutten ${formatDistance(routeResult.distanceMeters)} till ${selectedName}`
    : isSelectedPoint && userLocation
      ? `Ingen rutt hittades till ${selectedName}`
      : distanceToSelected === null
        ? null
        : distanceToSelected <= 15
          ? `Du är vid ${selectedName}`
          : `Gå ca ${formatDistance(distanceToSelected)} till ${selectedName}`;

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-stone-100">
      <RouteSegmentHighlight
        map={leafletMap}
        segmentIds={routeResult?.segmentIds ?? []}
        coordinates={routeResult?.coordinates}
      />
      <RouteSegmentHighlight
        map={leafletMap}
        segmentIds={highlightedSegmentIds}
      />
      <div ref={mapElementRef} className="h-full w-full" aria-label="Finnanäs map" />

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-[500] px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-lg bg-white/92 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Finnanäs
            </p>
            <h1 className="text-lg font-semibold leading-tight text-stone-950">
              Finnanäs map
            </h1>
          </div>

          <label className="pointer-events-auto rounded-lg bg-white/92 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur">
            <span className="mb-1 block text-xs font-medium text-stone-500">Layer</span>
            <select
              value={activeLayerId}
              onChange={(event) => setActiveLayerId(event.target.value)}
              className="w-28 bg-transparent text-sm font-semibold text-stone-950 outline-none"
              aria-label="Choose map layer"
            >
              {layerOptions.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="absolute right-4 top-[calc(max(1rem,env(safe-area-inset-top))+5.25rem)] z-[500]">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-black/10 backdrop-blur"
            onClick={startLocation}
          >
            {locationStatus === "loading" ? "Hämtar GPS" : "Min plats"}
          </button>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/95 text-stone-950 shadow-lg shadow-black/10 backdrop-blur"
            aria-label="Open segment checklist"
            aria-expanded={isSegmentMenuOpen}
            onClick={() => setIsSegmentMenuOpen(true)}
          >
            <Menu aria-hidden="true" size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {isSegmentMenuOpen ? (
        <section className="absolute inset-x-0 bottom-0 z-[650] max-h-[72svh] rounded-t-[24px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.24)]">
          <div className="mx-auto max-w-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Highlight
                </p>
                <h2 className="text-xl font-semibold text-stone-950">
                  Road segments
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-950"
                aria-label="Close segment checklist"
                onClick={() => setIsSegmentMenuOpen(false)}
              >
                <X aria-hidden="true" size={22} strokeWidth={2.5} />
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-stone-100 px-3 py-2">
              <p className="text-sm font-medium text-stone-700">
                {highlightedSegmentIds.length} selected
              </p>
              <button
                type="button"
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-950 shadow-sm"
                onClick={() => setHighlightedSegmentIds([])}
              >
                Clear
              </button>
            </div>

            <div className="max-h-[52svh] overflow-y-auto pr-1">
              <ol className="space-y-2">
                {routingSegments.map((segment) => {
                  const isChecked = highlightedSegmentIds.includes(segment.id);

                  return (
                    <li key={segment.id}>
                      <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-3 shadow-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleHighlightedSegment(segment.id)}
                          className="h-5 w-5 accent-blue-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-950">
                            {segment.id}
                          </span>
                          <span className="block text-xs text-stone-500">
                            {formatDistance(segment.distanceMeters)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className={`absolute inset-x-0 bottom-0 z-[600] touch-pan-y rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.20)] ${
          sheetDragY > 0 ? "" : "transition-transform duration-300 ease-out"
        } ${
          selectedFeature ? "translate-y-0" : "translate-y-[calc(100%+2rem)]"
        }`}
        style={{
          transform: selectedFeature
            ? `translateY(${sheetDragY}px)`
            : undefined,
        }}
        aria-hidden={!selectedFeature}
        onPointerCancel={handleSheetPointerEnd}
        onPointerDown={handleSheetPointerDown}
        onPointerMove={handleSheetPointerMove}
        onPointerUp={handleSheetPointerEnd}
      >
        <button
          type="button"
          className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-stone-300"
          aria-label="Close details"
          onClick={clearSelection}
        />

        {selectedFeature ? (
          <div className="mx-auto max-w-2xl">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-4 w-4 shrink-0 rounded-full"
                style={{
                  backgroundColor: getFeatureColor(selectedFeature),
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Selected line
                </p>
                <h2 className="break-words text-2xl font-semibold text-stone-950">
                  {selectedName}
                </h2>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-stone-950 px-4 py-3 text-white">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Vägledning
              </p>
              {guidanceText ? (
                <>
                  <p className="mt-1 text-xl font-semibold">{guidanceText}</p>
                  <p className="mt-1 text-sm text-stone-300">
                    Noggrannhet: ca {formatDistance(userLocation?.accuracy ?? 0)}
                  </p>
                </>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm text-stone-300">
                    Slå på GPS för avstånd till den här linjen.
                  </p>
                  <button
                    type="button"
                    className="shrink-0 rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-950"
                    onClick={startLocation}
                  >
                    Starta
                  </button>
                </div>
              )}
              {locationStatus === "error" ? (
                <p className="mt-2 text-sm text-amber-200">
                  {locationError ?? "GPS kunde inte hämtas."}
                </p>
              ) : null}
              {routeResult ? (
                <ol className="mt-3 space-y-1 border-t border-white/15 pt-3">
                  {routeResult.steps.map((step) => (
                    <li
                      key={step.edgeId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-stone-100">
                        {step.edgeId}
                      </span>
                      <span className="shrink-0 text-stone-300">
                        {formatDistance(step.distanceMeters)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {connectedSegments.length > 0 ? (
                <div className="mt-3 border-t border-white/15 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Connected segments
                  </p>
                  <ol className="mt-2 space-y-1">
                    {connectedSegments.map((segment) => (
                      <li
                        key={segment.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate text-stone-100">
                          {segment.id}
                        </span>
                        <span className="shrink-0 text-stone-300">
                          {formatDistance(segment.distanceMeters)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-3">
              {propertyEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-stone-200 pt-3"
                >
                  <dt className="text-sm font-medium capitalize text-stone-500">{key}</dt>
                  <dd className="min-w-0 break-words text-sm font-semibold text-stone-950">
                    {formatPropertyValue(value)}
                  </dd>
                </div>
              ))}
              <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-stone-200 pt-3">
                <dt className="text-sm font-medium text-stone-500">Geometry</dt>
                <dd className="text-sm font-semibold text-stone-950">
                  {selectedFeature.geometry?.type ?? "Unknown"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </section>
    </main>
  );
}
