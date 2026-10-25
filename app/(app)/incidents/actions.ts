"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AppError, localizeError } from "@/lib/i18n/errors";
import { getLocale } from "@/lib/i18n/server";
import { parseUnitLines } from "@/lib/incidents";
import { ForbiddenError } from "@/lib/permissions";
import { runAdvice } from "@/lib/services/advice";
import { createIncident, parseAnswers, requestHelp, resolveIncident } from "@/lib/services/incidents";
import { berlinToDate } from "@/lib/services/schedule";
import { requirePermission } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
/** Spalten aus dem Kampfbericht (versteckte Felder): nur ganze Zahlen 0 … 100 Mio., höchstens 11. */
const cols = (f: FormData, k: string): number[] | undefined => {
  try {
    const v = JSON.parse(str(f, k) || "null") as unknown;
    return Array.isArray(v) ? v.slice(0, 11).map((n) => (Number.isInteger(n) && n >= 0 && n < 1e8 ? (n as number) : 0)) : undefined;
  } catch {
    return undefined;
  }
};

async function errorText(e: unknown) {
  if (e instanceof AppError || e instanceof ForbiddenError) return localizeError(e, await getLocale());
  throw e;
}

export async function createIncidentAction(f: FormData) {
  const user = await requirePermission("incidents.report");
  let id: number | undefined;
  let error: string | undefined;
  try {
    const shot = Number(str(f, "screenshotId"));
    const i = await createIncident(db, user, {
      villageId: Number(str(f, "villageId")), kind: str(f, "kind"), occurredAt: berlinToDate(str(f, "occurredAt")),
      attacker: str(f, "attacker"), attackerAlliance: str(f, "attackerAlliance"), notes: str(f, "notes"),
      answers: parseAnswers((k) => str(f, k)), screenshotId: Number.isInteger(shot) && shot > 0 ? shot : null, correctTroops: f.get("correctTroops") === "1",
      attackerUnits: cols(f, "attackerUnits"), attackerLosses: cols(f, "attackerLosses"), defenderLosses: cols(f, "defenderLosses"), manualLosses: parseUnitLines(str(f, "losses")),
    }, await getLocale());
    id = i.id;
  } catch (e) {
    error = await errorText(e);
  }
  redirect(id ? `/incidents/${id}?saved=1` : `/incidents/new?error=${encodeURIComponent(error ?? "")}`);
}

async function onIncident(f: FormData, fn: (id: number, user: Awaited<ReturnType<typeof requirePermission>>) => Promise<unknown>) {
  const user = await requirePermission("incidents.report");
  const id = Number(str(f, "id"));
  let error: string | undefined;
  try {
    await fn(id, user);
  } catch (e) {
    error = await errorText(e);
  }
  redirect(`/incidents/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

export const requestHelpAction = async (f: FormData) => onIncident(f, (id, u) => requestHelp(db, u, id));
export const resolveIncidentAction = async (f: FormData) => onIncident(f, (id, u) => resolveIncident(db, u, id));
export const assessIncidentAction = async (f: FormData) => onIncident(f, async (id, u) => runAdvice(db, await requirePermission("ai.advice"), await getLocale(), new Date(), id).then(() => u));
