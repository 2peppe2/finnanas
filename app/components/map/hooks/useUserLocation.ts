import { useCallback, useEffect, useRef, useState } from "react";
import type { LocationStatus, UserLocation } from "../types";

const insecureLocationMessage =
  "GPS kräver HTTPS på mobilen. Starta appen med dev:https och öppna https-adressen.";

export function useUserLocation() {
  const watchIdRef = useRef<number | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  const clearLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startLocation = useCallback(() => {
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
    clearLocationWatch();

    const handleLocation = (position: GeolocationPosition) => {
      setUserLocation({
        accuracy: position.coords.accuracy,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
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
  }, [clearLocationWatch]);

  useEffect(() => clearLocationWatch, [clearLocationWatch]);

  return {
    clearLocationWatch,
    locationError,
    locationStatus,
    startLocation,
    userLocation,
  };
}
