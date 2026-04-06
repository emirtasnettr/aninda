import L from "leaflet";

const NS = "http://www.w3.org/2000/svg";

/** Lucide-style: car */
const CAR_PATHS = `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.3-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>`;

/** Lucide-style: home */
const HOME_PATHS = `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`;

/** Lucide-style: flag (varış / finish) */
const FLAG_PATHS = `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>`;

function svgIcon(
  paths: string,
  color: string,
  size: number,
): string {
  return `<svg xmlns="${NS}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const MARKER_RING_PX = 4;

function roundMarkerHtml(
  svg: string,
  opts: {
    plate: string;
    border: string;
    diameter?: number;
  },
): { html: string; outerSize: number } {
  const inner = opts.diameter ?? 38;
  const outerSize = inner + MARKER_RING_PX * 2;
  const html = `<div class="tj-map-marker-wrap" style="width:${outerSize}px;height:${outerSize}px;padding:${MARKER_RING_PX}px"><div class="tj-map-marker" style="--tj-plate:${opts.plate};--tj-border:${opts.border};width:${inner}px;height:${inner}px">${svg}</div></div>`;
  return { html, outerSize };
}

const DEFAULT_ICON_SIZE = 38 + MARKER_RING_PX * 2;

function divIcon(html: string, size = DEFAULT_ICON_SIZE): L.DivIcon {
  return L.divIcon({
    className: "tj-map-leaflet-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

/** Komuta haritası: çevrimdışı / teslimatta / boşta */
export function opsCommandCourierCarIcon(
  online: boolean,
  busy: boolean,
): L.DivIcon {
  let plate: string;
  let border: string;
  let icon: string;
  if (!online) {
    plate = "#e5e7eb";
    border = "#6b7280";
    icon = "#374151";
  } else if (busy) {
    plate = "#bfdbfe";
    border = "#1d4ed8";
    icon = "#1e3a8a";
  } else {
    plate = "#a7f3d0";
    border = "#059669";
    icon = "#065f46";
  }
  const { html, outerSize } = roundMarkerHtml(svgIcon(CAR_PATHS, icon, 21), {
    plate,
    border,
  });
  return divIcon(html, outerSize);
}

/** Operasyon / dağıtım: önerilen yeşil, çevrimiçi koyu, çevrimdışı gri */
export function dispatchCourierCarIcon(
  recommended: boolean,
  online: boolean,
): L.DivIcon {
  let plate: string;
  let border: string;
  let icon: string;
  if (recommended) {
    plate = "#6ee7b7";
    border = "#047857";
    icon = "#064e3b";
  } else if (online) {
    plate = "#e5e5e5";
    border = "#171717";
    icon = "#0a0a0a";
  } else {
    plate = "#d4d4d8";
    border = "#52525b";
    icon = "#27272a";
  }
  const inner = recommended ? 42 : 38;
  const { html, outerSize } = roundMarkerHtml(svgIcon(CAR_PATHS, icon, 21), {
    plate,
    border,
    diameter: inner,
  });
  return divIcon(html, outerSize);
}

/** Dashboard: çevrimiçi koyu plaka, çevrimdışı gri */
export function dashboardCourierCarIcon(online: boolean): L.DivIcon {
  const plate = online ? "#e5e5e5" : "#d4d4d8";
  const border = online ? "#171717" : "#52525b";
  const icon = online ? "#0a0a0a" : "#27272a";
  const { html, outerSize } = roundMarkerHtml(
    svgIcon(CAR_PATHS, icon, 21),
    { plate, border },
  );
  return divIcon(html, outerSize);
}

/** Canlı sipariş haritası: kurye */
export function orderLiveCourierCarIcon(): L.DivIcon {
  const { html, outerSize } = roundMarkerHtml(
    svgIcon(CAR_PATHS, "#f5f5f5", 21),
    {
      plate: "#404040",
      border: "#0a0a0a",
    },
  );
  return divIcon(html, outerSize);
}

/** Genel harita: çevrimiçi / çevrimdışı (ops canlı küçük harita) */
export function opsLiveCourierCarIcon(online: boolean): L.DivIcon {
  return dashboardCourierCarIcon(online);
}

export type OrderSlaVisual = "delayed" | "active" | "pending";

function orderVisualColors(v: OrderSlaVisual): {
  plate: string;
  border: string;
  icon: string;
} {
  if (v === "delayed")
    return { plate: "#fecaca", border: "#dc2626", icon: "#7f1d1d" };
  if (v === "active")
    return { plate: "#93c5fd", border: "#1d4ed8", icon: "#1e3a8a" };
  return { plate: "#fde047", border: "#ca8a04", icon: "#713f12" };
}

/** Varış: bayrak + sipariş durum rengi (komuta haritası teslimat noktası) */
export function orderDeliveryFinishIcon(visual: OrderSlaVisual): L.DivIcon {
  const { plate, border, icon } = orderVisualColors(visual);
  const { html, outerSize } = roundMarkerHtml(
    svgIcon(FLAG_PATHS, icon, 21),
    { plate, border },
  );
  return divIcon(html, outerSize);
}

/** Alış: ev ikonu — vurgulu (seçili rota) */
export function pickupHomeIconEmphasis(): L.DivIcon {
  const { html, outerSize } = roundMarkerHtml(
    svgIcon(HOME_PATHS, "#0f172a", 21),
    {
      plate: "#cbd5e1",
      border: "#0f172a",
    },
  );
  return divIcon(html, outerSize);
}

/** Alış: ev — soluk (arka plan siparişleri, mini harita) */
export function pickupHomeIconMuted(): L.DivIcon {
  const { html, outerSize } = roundMarkerHtml(
    svgIcon(HOME_PATHS, "#334155", 19),
    {
      plate: "#e2e8f0",
      border: "#475569",
      diameter: 34,
    },
  );
  return divIcon(html, outerSize);
}

/** Varış: kırmızı bayrak (rota teslimat noktası) */
export function deliveryFinishIconStandard(): L.DivIcon {
  const { html, outerSize } = roundMarkerHtml(
    svgIcon(FLAG_PATHS, "#7f1d1d", 21),
    {
      plate: "#fecaca",
      border: "#dc2626",
    },
  );
  return divIcon(html, outerSize);
}

/** Dashboard: alış noktası — sipariş durumuna göre ev rengi */
export function pickupHomeIconForStatus(border: string, fill: string): L.DivIcon {
  const { html, outerSize } = roundMarkerHtml(
    svgIcon(HOME_PATHS, border, 20),
    {
      plate: fill,
      border,
    },
  );
  return divIcon(html, outerSize);
}
