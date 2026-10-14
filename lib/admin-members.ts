import type { GroupPlayer } from "./alliance-group";

export type LinkInfo = {
  id: number;
  userId: string;
  userName: string;
  email: string;
  playerId: number;
  status: "pending" | "verified" | "rejected";
  method: "invite" | "village_rename" | "admin";
  claimCode: string | null;
};
export type OpenInvite = { id: number; playerId: number; expiresAt: Date };

export type MemberRow = {
  key: string;
  player: GroupPlayer;
  user?: { id: string; name: string; email: string };
  /** Weitere verifizierte Konten desselben Spielers (Duals). */
  extraAccounts: number;
  state: "verified" | "claim_pending" | "invite_open" | "none";
  via?: LinkInfo["method"];
  claimCode?: string | null;
  linkId?: number;
  inviteDaysLeft?: number;
};

const DAY = 86_400_000;

export const maskEmail = (e: string) => (e.includes("@") ? `${e.slice(0, e.indexOf("@")).slice(0, 6)}@…` : e);

/** Eine Zeile je Gruppenspieler: verifiziertes Konto > ausstehender Claim > offene Einladung > nichts. */
export function buildMemberRows(players: GroupPlayer[], links: LinkInfo[], invites: OpenInvite[], now = new Date()): MemberRow[] {
  return players.map((player) => {
    const mine = links.filter((l) => l.playerId === player.id);
    const verified = mine.filter((l) => l.status === "verified");
    const pending = mine.find((l) => l.status === "pending");
    const invite = invites.filter((i) => i.playerId === player.id && i.expiresAt > now).sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];
    const base = { key: String(player.id), player, extraAccounts: Math.max(0, verified.length - 1) };
    const first = verified[0];
    if (first) return { ...base, user: { id: first.userId, name: first.userName, email: first.email }, state: "verified" as const, via: first.method, linkId: first.id };
    if (pending)
      return { ...base, user: { id: pending.userId, name: pending.userName, email: pending.email }, state: "claim_pending" as const, claimCode: pending.claimCode, linkId: pending.id };
    if (invite) return { ...base, state: "invite_open" as const, inviteDaysLeft: Math.max(1, Math.ceil((invite.expiresAt.getTime() - now.getTime()) / DAY)) };
    return { ...base, state: "none" as const };
  });
}
