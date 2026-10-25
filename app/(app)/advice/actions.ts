"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AppError, localizeError } from "@/lib/i18n/errors";
import { getLocale } from "@/lib/i18n/server";
import { runAdvice, setRecommendationStatus } from "@/lib/services/advice";
import { requirePermission } from "@/lib/session";

const back = (f: FormData) => { const b = String(f.get("back") ?? "/"); return b.startsWith("/") && !b.startsWith("//") ? b : "/"; };
const withParam = (url: string, k: string, v: string) => `${url}${url.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}#tips`;

export async function runAdviceAction(f: FormData) {
  const user = await requirePermission("ai.advice");
  const locale = await getLocale();
  let error: string | undefined;
  try {
    await runAdvice(db, user, locale);
  } catch (e) {
    if (e instanceof AppError) error = localizeError(e, locale);
    else throw e;
  }
  redirect(error ? withParam(back(f), "adviceError", error) : withParam(back(f), "advice", "1"));
}

export async function setRecommendationStatusAction(f: FormData) {
  const user = await requirePermission("ai.advice");
  const status = String(f.get("status"));
  if (status === "done" || status === "dismissed" || status === "open") await setRecommendationStatus(db, user.id, Number(f.get("id")), status);
  redirect(`${back(f)}#tips`);
}
