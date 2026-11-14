/** Direktlink zur Travian-Karte: gleiche Koordinaten, nur die URL-Parameter werden ausgetauscht. */
export const mapUrl = (serverUrl: string, x: number, y: number): string => `${serverUrl.replace(/\/+$/, "")}/karte.php?zoom=1&x=${x}&y=${y}`;
