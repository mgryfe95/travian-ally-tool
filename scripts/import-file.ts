// Manueller Import aus einer lokalen Datei: npx tsx scripts/import-file.ts <map.sql>
import { readFileSync } from "node:fs";
import { db } from "../lib/db";
import { importMapSql } from "../lib/import/importer";
import { getInactiveDays } from "../lib/settings";

const file = process.argv[2];
if (!file) throw new Error("usage: tsx scripts/import-file.ts <map.sql>");
const t0 = Date.now();
const result = await importMapSql(db, readFileSync(file, "utf8"), { inactiveDays: await getInactiveDays(db) });
console.log(result, `${Date.now() - t0} ms`, "players:", await db.player.count(), "alliances:", await db.alliance.count());
await db.$disconnect();
