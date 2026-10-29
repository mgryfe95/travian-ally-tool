import { aiClient, type Advice } from "./client";

/**
 * Empfehlungen für Account (`POST /api/advisor/account`) bzw. Dorf (`POST /api/advisor/village/:id`).
 * Ergebnisse werden später gecacht und nur bei neuem Ist-Zustand oder geänderten Instruktionen neu berechnet
 * (Cache-Key = Hash aus Instruktionen + VillageState-Zeitstempeln). Stub: leere Liste.
 */
export async function advise(input: Parameters<ReturnType<typeof aiClient>["advise"]>[0]): Promise<{ status: "stub" | "ok"; recommendations: Advice[] }> {
  const recommendations = await aiClient().advise(input);
  return { status: recommendations.length === 0 ? "stub" : "ok", recommendations };
}
