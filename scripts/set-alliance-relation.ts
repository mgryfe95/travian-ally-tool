// Operator-Werkzeug bis das Admin-UI (M3) steht:
//   npx tsx scripts/set-alliance-relation.ts <allianceId> <OWN|ALLIED|NAP|NEUTRAL|ENEMY|CLEAR> [Notiz]
import { db } from "../lib/db";
import { clearRelation, RELATIONS, setRelation, type Relation } from "../lib/alliance-group";

const [id, rel, ...note] = process.argv.slice(2);
const allianceId = Number(id);
if (!rel) throw new Error("usage: set-alliance-relation <allianceId> <" + RELATIONS.join("|") + "|CLEAR> [note]");
if (rel === "CLEAR") await clearRelation(db, allianceId);
else await setRelation(db, allianceId, rel as Relation, { note: note.join(" ") || undefined, updatedBy: "cli" });
console.log(await db.allianceClassification.findMany());
await db.$disconnect();
