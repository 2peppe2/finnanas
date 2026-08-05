"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import routingGraph from "../routing/routing-graph.generated.json";
import {
  findRouteFromCoordinateToMarker,
  getConnectedSegmentsForMarker,
  getSegmentsForRoad,
} from "../routing/findRoute";
import type { RoutingEdge } from "../routing/routingGraph";
import RouteSegmentHighlight from "./RouteSegmentHighlight";
import { useCompassBearing } from "./map/hooks/useCompassBearing";
import { useGeoJsonData } from "./map/hooks/useGeoJsonData";
import { useFinnanasLeafletMap } from "./map/hooks/useFinnanasLeafletMap";
import { useSheetDrag } from "./map/hooks/useSheetDrag";
import { useUserLocation } from "./map/hooks/useUserLocation";
import { layerOptions } from "./map/mapLayers";
import {
  closestDistanceToFeature,
  formatDistance,
  formatPropertyValue,
  getFeatureName,
  isLineStringFeature,
  isPointFeature,
} from "./map/lib/featureUtils";
import type { GeoJsonFeature } from "./map/types";
import MapActionButtons from "./map/ui/MapActionButtons";
import DetailsSheet from "./map/ui/DetailsSheet";
import MapHeader from "./map/ui/MapHeader";
import NavigationPanel from "./map/ui/NavigationPanel";
import SegmentChecklistSheet from "./map/ui/SegmentChecklistSheet";

const routingSegments = routingGraph.edges as RoutingEdge[];
type MapMode = "viewer" | "navigation";

export default function MapViewer() {
  const geoJson = useGeoJsonData();
  const {
    locationError,
    locationStatus,
    startLocation,
    userLocation,
  } = useUserLocation();
  const { bearing, startCompass } = useCompassBearing();
  const [activeLayerId, setActiveLayerId] = useState(layerOptions[0].id);
  const [mapMode, setMapMode] = useState<MapMode>("viewer");
  const [navigationDestinationName, setNavigationDestinationName] = useState<string | null>(
    null,
  );
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(
    null,
  );
  const [isSegmentMenuOpen, setIsSegmentMenuOpen] = useState(false);
  const [highlightedSegmentIds, setHighlightedSegmentIds] = useState<string[]>([]);
  const clearSelectionRef = useRef<() => void>(() => undefined);

  const activeLayer = useMemo(
    () => layerOptions.find((layer) => layer.id === activeLayerId) ?? layerOptions[0],
    [activeLayerId],
  );
  const {
    handleSheetPointerDown,
    handleSheetPointerEnd,
    handleSheetPointerMove,
    setSheetDragY,
    sheetDragY,
  } = useSheetDrag(() => {
    clearSelectionRef.current();
  });
  const resetSheetDrag = useCallback(() => {
    setSheetDragY(0);
  }, [setSheetDragY]);
  const handleMapMovedByUser = useCallback(() => {
    if (mapMode === "navigation") {
      setIsFollowingUser(false);
    }
  }, [mapMode]);
  const { clearSelection, leafletMap, mapElementRef, recenterOnUser } =
    useFinnanasLeafletMap({
    activeLayer,
    bearing,
    geoJson,
    isFollowingUser,
    isNavigationMode: mapMode === "navigation",
    onMapMovedByUser: handleMapMovedByUser,
    onFeatureSelected: setSelectedFeature,
    onSelectionCleared: resetSheetDrag,
    userLocation,
  });

  useEffect(() => {
    clearSelectionRef.current = clearSelection;
  }, [clearSelection]);

  const selectedName = formatPropertyValue(selectedFeature?.properties?.name);
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
  const navigationRouteResult = useMemo(() => {
    if (!userLocation || !navigationDestinationName) {
      return null;
    }

    return findRouteFromCoordinateToMarker(
      [userLocation.lng, userLocation.lat],
      navigationDestinationName,
    );
  }, [navigationDestinationName, userLocation]);
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

  function toggleHighlightedSegment(segmentId: string) {
    setHighlightedSegmentIds((currentSegmentIds) =>
      currentSegmentIds.includes(segmentId)
        ? currentSegmentIds.filter((currentSegmentId) => currentSegmentId !== segmentId)
        : [...currentSegmentIds, segmentId],
    );
  }

  async function startNavigationToSelected() {
    if (!isPointFeature(selectedFeature)) {
      return;
    }

    setNavigationDestinationName(getFeatureName(selectedFeature));
    setMapMode("navigation");
    setIsFollowingUser(true);
    setIsSegmentMenuOpen(false);
    setHighlightedSegmentIds([]);
    startLocation();
    await startCompass();
    clearSelection();
  }

  function exitNavigation() {
    setMapMode("viewer");
    setNavigationDestinationName(null);
    setIsFollowingUser(true);
  }

  function recenterNavigation() {
    setIsFollowingUser(true);
    recenterOnUser();
  }

  const isNavigationMode = mapMode === "navigation";

  return (
    <main className="relative h-svh w-full overflow-hidden bg-stone-100">
      <RouteSegmentHighlight
        map={leafletMap}
        segmentIds={
          isNavigationMode
            ? navigationRouteResult?.segmentIds ?? []
            : routeResult?.segmentIds ?? []
        }
        coordinates={
          isNavigationMode
            ? navigationRouteResult?.coordinates
            : routeResult?.coordinates
        }
      />
      {!isNavigationMode ? (
        <RouteSegmentHighlight map={leafletMap} segmentIds={highlightedSegmentIds} />
      ) : null}
      <div ref={mapElementRef} className="h-full w-full" aria-label="Finnanäs map" />

      {isNavigationMode ? (
        <NavigationPanel
          destinationName={navigationDestinationName ?? "Destination"}
          isFollowingUser={isFollowingUser}
          locationError={locationError}
          locationStatus={locationStatus}
          onExit={exitNavigation}
          onRecenter={recenterNavigation}
          routeResult={navigationRouteResult}
        />
      ) : (
        <>
          <MapHeader
            activeLayerId={activeLayerId}
            layerOptions={layerOptions}
            onLayerChange={setActiveLayerId}
          />
          <MapActionButtons
            isSegmentMenuOpen={isSegmentMenuOpen}
            locationStatus={locationStatus}
            onOpenSegmentMenu={() => setIsSegmentMenuOpen(true)}
            onStartLocation={startLocation}
          />
          <SegmentChecklistSheet
            highlightedSegmentIds={highlightedSegmentIds}
            isOpen={isSegmentMenuOpen}
            onClear={() => setHighlightedSegmentIds([])}
            onClose={() => setIsSegmentMenuOpen(false)}
            onToggleSegment={toggleHighlightedSegment}
            segments={routingSegments}
          />
          <DetailsSheet
            connectedSegments={connectedSegments}
            guidanceText={guidanceText}
            locationError={locationError}
            locationStatus={locationStatus}
            onClose={clearSelection}
            onNavigateToSelected={startNavigationToSelected}
            onPointerCancel={handleSheetPointerEnd}
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerEnd}
            onStartLocation={startLocation}
            routeResult={routeResult}
            selectedFeature={selectedFeature}
            selectedName={selectedName}
            sheetDragY={sheetDragY}
            showNavigateButton={isPointFeature(selectedFeature)}
            userLocation={userLocation}
          />
        </>
      )}
    </main>
  );
}
