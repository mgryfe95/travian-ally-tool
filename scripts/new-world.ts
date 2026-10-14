// Neue Spielwelt starten (Weltdaten leeren, Konten/Chat behalten). VORHER: scripts/backup.sh
//   npx tsx scripts/new-world.ts --confirm
// Danach in .env TRAVIAN_SERVER_URL und TRAVIAN_ALLIANCE_ID anpassen und die Container neu starten.
import { db } from "../lib/db";
import { startNewWorld } from "../lib/services/world";

if (!process.argv.includes("--confirm")) {
  console.error("Das leert Karte, Statistik, Ereignisse, Spieler-Verknüpfungen und Allianz-Typen und stuft alle Member auf Gast herab.\nBackup gemacht? Dann: npx tsx scripts/new-world.ts --confirm");
  process.exit(1);
}
console.log(await startNewWorld(db));
await db.$disconnect();
