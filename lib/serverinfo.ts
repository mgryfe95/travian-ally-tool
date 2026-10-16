import type { PrismaClient } from "@prisma/client";
import { loadRelations } from "./alliance-group";

/** `https://ts12.x1.europe.travian.com` → `ts12 · Europe` */
export function serverLabel(serverUrl: string): string {
  const host = new URL(serverUrl).hostname.split(".");
  const region = host.length >= 5 && host[2] ? host[2][0]!.toUpperCase() + host[2].slice(1) : "";
  return [host[0], region].filter(Boolean).join(" · ");
}

/** Namen der Allianzen vom Typ „Eigene Allianz“ für die Kopfzeile, z. B. `[Human]`. */
export async function ownAllianceTag(db: PrismaClient): Promise<string> {
  const relations = await loadRelations(db);
  const ids = [...relations].filter(([, r]) => r === "OWN").map(([id]) => id);
  if (ids.length === 0) return "";
  const rows = await db.alliance.findMany({ where: { id: { in: ids } }, select: { name: true } });
  return rows.map((a) => `[${a.name}]`).join(" ");
}
