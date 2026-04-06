/** OpenStreetMap statik önizleme (dashboard / iş kartları). */
export function staticMapUri(
  lat: number,
  lng: number,
  zoom: number,
  markers?: { lat: number; lng: number; color: string }[],
  size = '480x140',
): string {
  let url = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=mapnik`;
  if (markers && markers.length > 0) {
    const m = markers.map((p) => `${p.lat},${p.lng},${p.color}`).join('|');
    url += `&markers=${m}`;
  }
  return url;
}
