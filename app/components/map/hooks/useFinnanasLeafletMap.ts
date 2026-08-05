import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { GeoJsonData, GeoJsonFeature, LayerOption, PointFeature, UserLocation } from "../types";
import { getFeatureName, isLineStringFeature, isPointFeature } from "../lib/featureUtils";
import {
  createPointMarkerIcon,
  getFeaturePathStyle,
  getSelectedLineHaloStyle,
  setLayerSelected,
} from "../lib/leafletStyles";

const defaultCenter: L.LatLngExpression = [57.9853, 14.828];
const userLocationPaneName = "user-location-pane";

type UseFinnanasLeafletMapOptions = {
  activeLayer: LayerOption;
  geoJson: GeoJsonData | null;
  onSelectionCleared: () => void;
  onFeatureSelected: (feature: GeoJsonFeature | null) => void;
  userLocation: UserLocation | null;
};

export function useFinnanasLeafletMap({
  activeLayer,
  geoJson,
  onFeatureSelected,
  onSelectionCleared,
  userLocation,
}: UseFinnanasLeafletMapOptions) {
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
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);

  const clearSelection = useCallback(() => {
    if (selectedHaloRef.current) {
      selectedHaloRef.current.remove();
      selectedHaloRef.current = null;
    }

    if (selectedLayerRef.current) {
      setLayerSelected(selectedLayerRef.current.layer, false);
      selectedLayerRef.current = null;
    }

    onFeatureSelected(null);
    onSelectionCleared();
  }, [onFeatureSelected, onSelectionCleared]);

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
    map.createPane(userLocationPaneName);
    const userLocationPane = map.getPane(userLocationPaneName);
    if (userLocationPane) {
      userLocationPane.style.zIndex = "700";
    }
    map.on("click", clearSelection);

    mapRef.current = map;
    setLeafletMap(map);

    return () => {
      map.remove();
      mapRef.current = null;
      setLeafletMap(null);
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      userMarkerRef.current = null;
      accuracyCircleRef.current = null;
    };
  }, [clearSelection]);

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
      onFeatureSelected(null);
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
          onFeatureSelected(selected);
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
  }, [clearSelection, geoJson, onFeatureSelected]);

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
        pane: userLocationPaneName,
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
        pane: userLocationPaneName,
        weight: 3,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latLng);
    }

    accuracyCircleRef.current.bringToFront();
    userMarkerRef.current.bringToFront();
  }, [userLocation]);

  return {
    clearSelection,
    leafletMap,
    mapElementRef,
  };
}
