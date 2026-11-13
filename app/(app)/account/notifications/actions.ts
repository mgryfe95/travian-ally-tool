"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { saveNotifySettings } from "@/lib/services/notify";
import { requireUser } from "@/lib/session";

/** Speichert die komplette Auswahl der Seite (Checkbox „on“ je Schlüssel, alle Schlüssel im versteckten Feld „keys“). */
export async function saveNotifyAction(f: FormData) {
  const user = await requireUser();
  const keys = f.getAll("keys").map(String);
  const on = new Set(f.getAll("on").map(String));
  await saveNotifySettings(db, user.id, keys, on);
  redirect("/account/notifications?saved=1");
}
