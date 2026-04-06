"use client";

import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

const ISTANBUL: LatLngExpression = [41.0082, 28.9784];

type FitBoundsOnceProps = {
  points: LatLngExpression[];
  /** Değişince (ör. kurye ilk kez göründü) sığdırmayı tekrar dener. */
  version?: number | string;
};

/** İlk geçerli nokta setinde haritayı sığdırır; `version` değişince sıfırlanır. */
export function FitBoundsOnce({ points, version = 0 }: FitBoundsOnceProps) {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    done.current = false;
  }, [version]);

  useEffect(() => {
    if (done.current || points.length === 0) {
      return;
    }
    done.current = true;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    const b = L.latLngBounds(points);
    map.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
  }, [map, points, version]);

  useEffect(() => {
    if (points.length === 0) {
      map.setView(ISTANBUL, 11);
    }
  }, [map, points.length]);

  return null;
}
