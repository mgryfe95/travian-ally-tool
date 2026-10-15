import type { MessageKey, T } from "@/lib/i18n";

/** Task-Force-Rollen → Übersetzungsschlüssel. */
export const TF_ROLE_KEY: Record<string, MessageKey> = {
  founder: "chat.role.founder",
  lead: "chat.role.lead",
  member: "chat.role.member",
  reader: "chat.role.reader",
};

/** Konto-Rollen → Übersetzungsschlüssel (SYSTEMADMIN und ADMIN erscheinen beide als „Admin“). */
export const USER_ROLE_KEY: Record<string, MessageKey> = {
  SYSTEMADMIN: "chat.role.admin",
  ADMIN: "chat.role.admin",
  MODERATOR: "chat.role.moderator",
  MEMBER: "chat.role.member",
  GUEST: "chat.role.guest",
};

export const tfRoleLabel = (t: T, role: string): string => {
  const k = TF_ROLE_KEY[role];
  return k ? t(k) : role;
};
