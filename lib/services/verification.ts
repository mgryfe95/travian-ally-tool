import { createHash, randomBytes, randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { loadRelations, ownGroupIds, verifiableIds } from "../alliance-group";
import { ForbiddenError, hasPermission, type Permission } from "../permissions";
import { audit, loadMatrix, type Actor } from "./context";
import { AppError } from "../i18n/errors";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

export const INVITE_TTL_MS = 7 * 86_400_000;
export class VerificationError extends AppError {}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/O/1/I

async function requirePerm(db: PrismaClient, actor: Actor, perm: Permission) {
  if (!hasPermission(actor.role, perm, await loadMatrix(db))) throw new ForbiddenError("err.perm.missing", { perm });
}

/** Spieler muss laut letztem Import zur eigenen Gruppe (eigene Allianz + Allianzen) gehören. */
async function requireGroupPlayer(db: PrismaClient, playerId: number) {
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) throw new VerificationError("err.verify.playerNotFound");
  if (!ownGroupIds(await loadRelations(db)).has(player.allianceId)) throw new VerificationError("err.verify.playerNotInGroup");
  return player;
}

/** Wie `requireGroupPlayer`, aber auch enge Bündnispartner sind verifizierbar (Registrierung, Dorf-Umbenennen, manuelle Bestätigung). */
export async function requireVerifiablePlayer(db: PrismaClient, playerId: number) {
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) throw new VerificationError("err.verify.playerNotFound");
  if (!verifiableIds(await loadRelations(db)).has(player.allianceId)) throw new VerificationError("err.verify.playerNotEligible");
  return player;
}

async function promoteGuest(db: Pick<PrismaClient, "user">, userId: string) {
  await db.user.updateMany({ where: { id: userId, role: "GUEST" }, data: { role: "MEMBER" } });
}

// ───────── Einladung ─────────

export async function createInvite(db: PrismaClient, actor: Actor, playerId: number, now = new Date()) {
  await requirePerm(db, actor, "members.invite");
  const player = await requireGroupPlayer(db, playerId);
  const token = randomBytes(24).toString("base64url");
  const invite = await db.invite.create({
    data: { tokenHash: sha256(token), travianPlayerId: playerId, createdBy: actor.id, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) },
  });
  await audit(db, actor.id, "invite.create", `player:${playerId}`, undefined, { inviteId: invite.id });
  return { token, invite, player };
}

/** Fertiger Text für die Ingame-Nachricht. */
export function inviteMessage(opts: { playerName: string; token: string; appUrl: string; locale?: Locale }) {
  const url = `${opts.appUrl.replace(/\/+$/, "")}/invite/${opts.token}`;
  return translate(opts.locale ?? DEFAULT_LOCALE, "err.invite.message", { name: opts.playerName, url });
}

export async function findOpenInvite(db: PrismaClient, token: string, now = new Date()) {
  const invite = await db.invite.findUnique({ where: { tokenHash: sha256(token) } });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= now) return null;
  return invite;
}

/** Löst den Link für einen frisch registrierten User ein: PlayerLink verified, Rolle MEMBER. */
export async function redeemInvite(db: PrismaClient, token: string, userId: string, now = new Date()) {
  const invite = await findOpenInvite(db, token, now);
  if (!invite) throw new VerificationError("err.verify.inviteInvalid");
  await requireGroupPlayer(db, invite.travianPlayerId);
  await db.$transaction(async (tx) => {
    // Atomar „einmalig“: nur wer usedAt von null auf gesetzt bringt, gewinnt.
    const claimed = await tx.invite.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null }, data: { usedAt: now, usedBy: userId } });
    if (claimed.count !== 1) throw new VerificationError("err.verify.inviteUsed");
    await tx.playerLink.upsert({
      where: { userId_travianPlayerId: { userId, travianPlayerId: invite.travianPlayerId } },
      create: { userId, travianPlayerId: invite.travianPlayerId, status: "verified", method: "invite", verifiedBy: invite.createdBy, verifiedAt: now },
      update: { status: "verified", method: "invite", verifiedBy: invite.createdBy, verifiedAt: now },
    });
    await promoteGuest(tx, userId);
  });
  await audit(db, invite.createdBy, "link.verify.invite", `user:${userId}`, undefined, { playerId: invite.travianPlayerId });
  return invite.travianPlayerId;
}

export async function revokeInvite(db: PrismaClient, actor: Actor, inviteId: number, now = new Date()) {
  await requirePerm(db, actor, "members.invite");
  await db.invite.updateMany({ where: { id: inviteId, usedAt: null }, data: { revokedAt: now } });
  await audit(db, actor.id, "invite.revoke", `invite:${inviteId}`);
}

// ───────── Dorf-Umbenennungs-Beweis ─────────

function newCode() {
  return "ALLY-" + Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Der User beansprucht einen Spieler und bekommt einen Code, den er als Dorfnamen setzen muss. */
export async function startClaim(db: PrismaClient, userId: string, playerId: number) {
  await requireVerifiablePlayer(db, playerId);
  const existing = await db.playerLink.findUnique({ where: { userId_travianPlayerId: { userId, travianPlayerId: playerId } } });
  if (existing?.status === "verified") throw new VerificationError("err.verify.alreadyVerified");
  let code = newCode();
  while (await db.playerLink.findFirst({ where: { claimCode: code } })) code = newCode();
  return db.playerLink.upsert({
    where: { userId_travianPlayerId: { userId, travianPlayerId: playerId } },
    create: { userId, travianPlayerId: playerId, status: "pending", method: "village_rename", claimCode: code },
    update: { status: "pending", method: "village_rename", claimCode: code },
  });
}

/** Nach jedem Import: Taucht der Code im Namen eines Dorfs des Spielers auf (und der Spieler ist in der Gruppe), wird der Link verifiziert. */
export async function checkClaims(db: PrismaClient, now = new Date()): Promise<number> {
  const pending = await db.playerLink.findMany({ where: { status: "pending", method: "village_rename", claimCode: { not: null } } });
  if (pending.length === 0) return 0;
  const group = verifiableIds(await loadRelations(db));
  let verified = 0;
  for (const link of pending) {
    const player = await db.player.findUnique({ where: { id: link.travianPlayerId }, select: { allianceId: true } });
    if (!player || !group.has(player.allianceId)) continue;
    const hit = await db.village.findFirst({
      where: { playerId: link.travianPlayerId, name: { contains: link.claimCode as string, mode: "insensitive" } },
      select: { id: true },
    });
    if (!hit) continue;
    await db.$transaction(async (tx) => {
      await tx.playerLink.update({ where: { id: link.id }, data: { status: "verified", verifiedAt: now, verifiedBy: "system" } });
      await promoteGuest(tx, link.userId);
    });
    await audit(db, "system", "link.verify.village_rename", `user:${link.userId}`, undefined, { playerId: link.travianPlayerId });
    verified++;
  }
  return verified;
}

// ───────── Manuell (MODERATOR+, members.approve) ─────────

export async function approveLink(db: PrismaClient, actor: Actor, linkId: number, now = new Date()) {
  await requirePerm(db, actor, "members.approve");
  const link = await db.playerLink.findUnique({ where: { id: linkId } });
  if (!link) throw new VerificationError("err.verify.linkNotFound");
  await requireVerifiablePlayer(db, link.travianPlayerId);
  await db.playerLink.update({ where: { id: linkId }, data: { status: "verified", method: "admin", verifiedBy: actor.id, verifiedAt: now } });
  await promoteGuest(db, link.userId);
  await audit(db, actor.id, "link.verify.admin", `user:${link.userId}`, { status: link.status }, { status: "verified", playerId: link.travianPlayerId });
}

export async function rejectLink(db: PrismaClient, actor: Actor, linkId: number) {
  await requirePerm(db, actor, "members.approve");
  const link = await db.playerLink.findUnique({ where: { id: linkId } });
  if (!link) throw new VerificationError("err.verify.linkNotFound");
  await db.playerLink.update({ where: { id: linkId }, data: { status: "rejected", verifiedBy: actor.id, verifiedAt: null } });
  await audit(db, actor.id, "link.reject", `user:${link.userId}`, { status: link.status }, { status: "rejected" });
}

/** Moderator/Admin ordnet ein Konto direkt einem Spieler der eigenen Gruppe zu (ohne Dorf-Umbenennen oder Einladung). */
export async function assignPlayer(db: PrismaClient, actor: Actor, userId: string, playerId: number, now = new Date()) {
  await requirePerm(db, actor, "members.approve");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new VerificationError("err.verify.accountNotFound");
  await requireVerifiablePlayer(db, playerId);
  const prev = await db.playerLink.findUnique({ where: { userId_travianPlayerId: { userId, travianPlayerId: playerId } } });
  await db.playerLink.upsert({
    where: { userId_travianPlayerId: { userId, travianPlayerId: playerId } },
    create: { userId, travianPlayerId: playerId, status: "verified", method: "admin", verifiedBy: actor.id, verifiedAt: now },
    update: { status: "verified", method: "admin", verifiedBy: actor.id, verifiedAt: now, claimCode: null },
  });
  await promoteGuest(db, userId);
  await audit(db, actor.id, "link.assign", `user:${userId}`, { status: prev?.status ?? null }, { status: "verified", playerId });
}

// ───────── „Verlinkung nachweisen“ (Knopf auf der Verifizierungsseite) ─────────

export type ProofResult = "verified" | "no_claim" | "not_found" | "unchanged" | "throttled" | "error";
const lastFetch = { at: 0 };
/** Mindestabstand zwischen Abrufen von map.sql durch Nutzer-Knopfdruck (schont den Travian-Server; der Worker holt ohnehin stündlich). */
export const PROOF_FETCH_MIN_MS = 5 * 60_000;

/**
 * Prüft sofort, ob der Code im Dorfnamen steht: erst gegen den letzten Import; sonst map.sql neu laden (höchstens alle 5 Minuten, für alle
 * Nutzer gemeinsam). Travian veröffentlicht map.sql nur ca. einmal täglich – ist die Datei unverändert, gibt es nichts Neues zu sehen.
 */
export async function proveLink(
  db: PrismaClient, userId: string,
  deps: { fetchAndImport: () => Promise<"imported" | "unchanged">; now?: () => number } = { fetchAndImport: async () => "unchanged" },
): Promise<ProofResult> {
  const mine = await db.playerLink.findFirst({ where: { userId, status: "pending", method: "village_rename", claimCode: { not: null } } });
  if (!mine) return "no_claim";
  const verifiedNow = async () => (await db.playerLink.findUnique({ where: { id: mine.id }, select: { status: true } }))?.status === "verified";
  await checkClaims(db);
  if (await verifiedNow()) return "verified";
  const now = (deps.now ?? Date.now)();
  if (now - lastFetch.at < PROOF_FETCH_MIN_MS) return "throttled";
  lastFetch.at = now;
  try {
    const r = await deps.fetchAndImport();
    if (r === "unchanged") return "unchanged";
    await checkClaims(db);
    return (await verifiedNow()) ? "verified" : "not_found";
  } catch {
    return "error";
  }
}
