import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { getMarkerIcon } from "../../../constants/markerIcons";
import type { GeoJsonFeature, PointFeature } from "../types";
import { getFeatureColor, getFeatureName } from "./featureUtils";

export function createPointMarkerIcon(feature: PointFeature) {
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

export function getFeaturePathStyle(
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

export function getSelectedLineHaloStyle(): L.PathOptions {
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

export function setLayerSelected(layer: L.Layer, isSelected: boolean) {
  if (layer instanceof L.Marker) {
    layer.getElement()?.classList.toggle("map-marker-selected", isSelected);
    layer.setZIndexOffset(isSelected ? 1000 : 0);
  }

  if (layer instanceof L.Path && isSelected) {
    layer.bringToFront();
  }
}
