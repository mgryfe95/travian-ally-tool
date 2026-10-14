export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toLocaleString("de-DE"));
export const delta = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${n > 0 ? "+" : ""}${n.toLocaleString("de-DE")}`);
export const STATUS_LABEL: Record<string, string> = { active: "aktiv", stagnant: "stagniert", inactive: "inaktiv", declining: "fällt" };
