"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/permissions";
import { saveAccountInstructions, saveVillageInstructions, VillageError } from "@/lib/services/villages";
import { requireUser } from "@/lib/session";

async function run(back: string, anchor: string, fn: () => Promise<void>): Promise<never> {
  let error: string | undefined;
  try {
    await fn();
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof VillageError) error = e.message;
    else throw e;
  }
  redirect(`${back}${error ? `?error=${encodeURIComponent(error)}` : "?saved=1"}#${anchor}`);
}

export async function saveAccountInstructionsAction(f: FormData) {
  return run(String(f.get("back") ?? "/") === "/" ? "/" : "/villages/" + Number(f.get("villageId")), "strategie", async () =>
    saveAccountInstructions(db, (await requireUser()).id, String(f.get("text") ?? "")));
}

export async function saveVillageInstructionsAction(f: FormData) {
  const id = Number(f.get("villageId"));
  return run(`/villages/${id}`, "desc", async () => saveVillageInstructions(db, (await requireUser()).id, id, String(f.get("text") ?? "")));
}
