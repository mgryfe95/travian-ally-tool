/** Travian-Karte: Koordinaten -200..200, also 401 Felder je Achse; die Karte ist ein Torus (Wrap). */
export const MAP_RADIUS = 200;

export type Coord = { x: number; y: number };

function wrappedDelta(a: number, b: number, radius: number): number {
  const size = radius * 2 + 1;
  const d = Math.abs(a - b);
  return Math.min(d, size - d);
}

/** Euklidische Entfernung in Feldern unter Berücksichtigung des Kartenwraps. */
export function distance(a: Coord, b: Coord, radius = MAP_RADIUS): number {
  return Math.hypot(wrappedDelta(a.x, b.x, radius), wrappedDelta(a.y, b.y, radius));
}

/** Anzeige-Rundung auf 1 Nachkommastelle. */
export function roundFields(d: number): number {
  return Math.round(d * 10) / 10;
}
