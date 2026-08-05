import { useCallback, useEffect, useRef, useState } from "react";

type CompassPermissionEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function getBearingFromEvent(event: CompassPermissionEvent) {
  if (typeof event.webkitCompassHeading === "number") {
    return event.webkitCompassHeading;
  }

  if (typeof event.alpha === "number") {
    return (360 - event.alpha) % 360;
  }

  return null;
}

export function useCompassBearing() {
  const [bearing, setBearing] = useState(0);
  const [isCompassActive, setIsCompassActive] = useState(false);
  const hasListenerRef = useRef(false);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const nextBearing = getBearingFromEvent(event as CompassPermissionEvent);

    if (nextBearing !== null) {
      setBearing(nextBearing);
    }
  }, []);

  const startCompass = useCallback(async () => {
    const OrientationEvent =
      DeviceOrientationEvent as DeviceOrientationEventWithPermission;

    if (typeof OrientationEvent.requestPermission === "function") {
      const permission = await OrientationEvent.requestPermission();
      if (permission !== "granted") {
        return;
      }
    }

    if (!hasListenerRef.current) {
      window.addEventListener("deviceorientationabsolute", handleOrientation);
      window.addEventListener("deviceorientation", handleOrientation);
      hasListenerRef.current = true;
    }

    setIsCompassActive(true);
  }, [handleOrientation]);

  useEffect(() => {
    return () => {
      if (!hasListenerRef.current) {
        return;
      }

      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      window.removeEventListener("deviceorientation", handleOrientation);
      hasListenerRef.current = false;
    };
  }, [handleOrientation]);

  return {
    bearing,
    isCompassActive,
    startCompass,
  };
}
