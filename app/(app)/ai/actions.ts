"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AppError, localizeError } from "@/lib/i18n/errors";
import { getLocale } from "@/lib/i18n/server";
import { ForbiddenError } from "@/lib/permissions";
import { createChat, deleteChat, finishClarification, sendChatMessage, setChatPrompt } from "@/lib/services/aichat";
import { deleteMemory, embedMemory } from "@/lib/services/memory";
import { requireUser } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
async function errorText(e: unknown) {
  if (e instanceof AppError || e instanceof ForbiddenError) return localizeError(e, await getLocale());
  console.error(e);
  return localizeError(new AppError("err.internal"), await getLocale());
}

export async function newChatAction() {
  const user = await requireUser();
  let id: number | undefined;
  let error: string | undefined;
  try {
    id = (await createChat(db, user)).id;
  } catch (e) {
    error = await errorText(e);
  }
  redirect(id ? `/ai?c=${id}` : `/ai?error=${encodeURIComponent(error ?? "")}`);
}

export async function sendAction(f: FormData) {
  const user = await requireUser();
  const c = Number(str(f, "chatId"));
  let error: string | undefined;
  try {
    await sendChatMessage(db, user, c, str(f, "text"), await getLocale());
  } catch (e) {
    error = await errorText(e);
  }
  redirect(`/ai?c=${c}${error ? `&error=${encodeURIComponent(error)}` : ""}#end`);
}

export async function finishAction(f: FormData) {
  const user = await requireUser();
  const c = Number(str(f, "chatId"));
  let error: string | undefined;
  try {
    await finishClarification(db, user, c, await getLocale());
  } catch (e) {
    error = await errorText(e);
  }
  redirect(`/ai?c=${c}${error ? `&error=${encodeURIComponent(error)}` : ""}#end`);
}

export async function deleteChatAction(f: FormData) {
  const user = await requireUser();
  try {
    await deleteChat(db, user.id, Number(str(f, "chatId")));
  } catch (e) {
    redirect(`/ai?error=${encodeURIComponent(await errorText(e))}`);
  }
  redirect("/ai");
}

export async function savePromptAction(f: FormData) {
  const user = await requireUser();
  try {
    await setChatPrompt(db, user.id, str(f, "prompt"));
  } catch (e) {
    redirect(`/ai?tab=prompt&error=${encodeURIComponent(await errorText(e))}`);
  }
  redirect("/ai?tab=prompt&saved=1");
}

export async function reembedAction(f: FormData) {
  const user = await requireUser();
  const id = Number(str(f, "id"));
  let n = 0;
  try {
    n = await embedMemory(db, user.id, Number.isInteger(id) && id > 0 ? [id] : null);
  } catch (e) {
    redirect(`/ai?tab=rag&error=${encodeURIComponent(await errorText(e))}`);
  }
  redirect(`/ai?tab=rag&embedded=${n}`);
}

export async function deleteMemoryAction(f: FormData) {
  const user = await requireUser();
  await deleteMemory(db, user.id, Number(str(f, "id")));
  redirect("/ai?tab=rag");
}
