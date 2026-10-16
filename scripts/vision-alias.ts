// Wissen für die Bilderkennung pflegen (Emojis, Kürzel, Spitznamen):
//   npx tsx scripts/vision-alias.ts add "<Begriff>" "<Bedeutung>"   |   list   |   remove "<Begriff>"
import { db } from "../lib/db";

const [cmd, term, ...rest] = process.argv.slice(2);
if (cmd === "add" && term && rest.length) await db.visionAlias.upsert({ where: { term }, create: { term, meaning: rest.join(" ") }, update: { meaning: rest.join(" ") } });
else if (cmd === "remove" && term) await db.visionAlias.deleteMany({ where: { term } });
else if (cmd !== "list") throw new Error('usage: vision-alias add "<term>" "<meaning>" | list | remove "<term>"');
for (const a of await db.visionAlias.findMany({ orderBy: { term: "asc" } })) console.log(`${a.term} = ${a.meaning}`);
await db.$disconnect();
