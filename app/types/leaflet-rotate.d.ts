import "leaflet";

declare module "leaflet" {
  interface MapOptions {
    bearing?: number;
    compassBearing?: boolean;
    rotate?: boolean;
    rotateControl?: boolean;
    touchRotate?: boolean;
  }

  interface Map {
    getBearing?: () => number;
    setBearing?: (bearing: number) => void;
    touchRotate?: {
      disable: () => void;
      enable: () => void;
      enabled: () => boolean;
    };
  }
}
