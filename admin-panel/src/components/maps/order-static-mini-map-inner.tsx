"use client";

import type { LatLngExpression } from "leaflet";
import { useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  deliveryFinishIconStandard,
  pickupHomeIconEmphasis,
} from "./leaflet-div-icons";
import { FitBoundsOnce } from "./fit-bounds-once";

type Props = {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
};

export default function OrderStaticMiniMapInner({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
}: Props) {
  const line: LatLngExpression[] = useMemo(
    () => [
      [pickupLat, pickupLng],
      [deliveryLat, deliveryLng],
    ],
    [pickupLat, pickupLng, deliveryLat, deliveryLng],
  );

  const points: LatLngExpression[] = line;

  return (
    <div className="relative z-0 h-[220px] w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <MapContainer
        center={[pickupLat, pickupLng]}
        zoom={13}
        className="size-full"
        scrollWheelZoom={false}
        dragging
        doubleClickZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBoundsOnce points={points} version="mini" />
        <Polyline
          positions={line}
          pathOptions={{
            color: "#6366f1",
            weight: 3,
            opacity: 0.85,
            dashArray: "6 8",
          }}
        />
        <Marker
          position={[pickupLat, pickupLng]}
          icon={pickupHomeIconEmphasis()}
        />
        <Marker
          position={[deliveryLat, deliveryLng]}
          icon={deliveryFinishIconStandard()}
        />
      </MapContainer>
    </div>
  );
}
