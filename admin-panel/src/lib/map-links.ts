/** OpenStreetMap’te koordinat aç (adres metni yoksa yedek). */
export function openStreetMapLink(lat: number, lng: number, zoom = 16): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
