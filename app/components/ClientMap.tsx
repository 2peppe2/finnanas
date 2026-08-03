"use client";

import dynamic from "next/dynamic";

const MapViewer = dynamic(() => import("./MapViewer"), {
  ssr: false,
});

export default function ClientMap() {
  return <MapViewer />;
}
