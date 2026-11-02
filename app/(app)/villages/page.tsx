import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ownVillages } from "@/lib/services/villages";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** „Meine Dörfer“ öffnet das Dorf-Dashboard des größten Dorfs; ohne verifizierten Spieler die Übersicht mit Hinweis. */
export default async function MyVillages() {
  const user = await requireUser();
  const first = (await ownVillages(db, user.id))[0];
  redirect(first ? `/villages/${first.id}` : "/");
}
