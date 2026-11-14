/** Dorftypen (VillageProfile.goal). Steuern, worauf die KI-Vorschläge ein Dorf ausrichten. */
export const VILLAGE_GOALS = ["CAPITAL", "OFF", "HAMMER", "DEFF", "CROP", "TRADE", "SUPPORT"] as const;
export type VillageGoal = (typeof VILLAGE_GOALS)[number];
export const isGoal = (v: unknown): v is VillageGoal => typeof v === "string" && (VILLAGE_GOALS as readonly string[]).includes(v);

/** Kurzbeschreibung für den Prompt (englisch, wie das ganze Lagebild). */
export const GOAL_HINT: Record<VillageGoal, string> = {
  CAPITAL: "capital: resource fields beyond level 10, strong economy, defensive buildings",
  OFF: "offensive village: barracks/stable/workshop, smithy, offensive troops",
  HAMMER: "main hammer: maximise offensive troop count and training speed, crop supply from elsewhere",
  DEFF: "defensive village: wall, defensive troops, support for allies",
  CROP: "crop village (9/15-croppers): crop fields, granary, feeds troops of other villages",
  TRADE: "trade/supply: marketplace, trade office, warehouse/granary, merchants",
  SUPPORT: "support/settler village: residence/palace, culture points, settlers",
};
