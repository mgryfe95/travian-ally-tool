import type { MessageKey } from "./i18n";

/** Aufbau der Hilfeseite: Bereich → aufklappbare Punkte; jeder Punkt mit Erklärung (`help.<id>.t/.b`) und Quicklinks ins Tool. */
export type HelpLink = { href: string; label: MessageKey };
export type HelpItem = { id: string; links: HelpLink[] };
export type HelpSection = { id: "start" | "villages" | "ai" | "incidents" | "chat" | "ocr" | "inactive" | "gamedata" | "admin"; items: HelpItem[] };

const L = (href: string, label: MessageKey): HelpLink => ({ href, label });

export const HELP: HelpSection[] = [
  { id: "start", items: [
    { id: "start-join", links: [L("/register", "help.l.register")] },
    { id: "start-email", links: [L("/claim", "help.l.claim")] },
    { id: "start-verify", links: [L("/claim", "help.l.claim")] },
    { id: "start-password", links: [L("/account", "help.l.account"), L("/forgot", "help.l.forgot")] },
    { id: "start-profile", links: [L("/account", "help.l.account"), L("/mentions", "help.l.mentions"), L("/files", "help.l.files"), L("/privacy", "help.l.privacy")] },
    { id: "start-roles", links: [] },
  ] },
  { id: "villages", items: [
    { id: "villages-overview", links: [L("/", "help.l.home")] },
    { id: "villages-page", links: [L("/villages", "help.l.home")] },
    { id: "villages-freshness", links: [L("/", "help.l.home")] },
    { id: "villages-troops", links: [L("/villages", "help.l.home")] },
    { id: "villages-buildings", links: [L("/villages", "help.l.home")] },
  ] },
  { id: "ai", items: [
    { id: "ai-what", links: [L("/#tips", "help.l.tips")] },
    { id: "ai-run", links: [L("/#tips", "help.l.tips")] },
    { id: "ai-goals", links: [L("/#strategie", "help.l.instructions"), L("/villages", "help.l.home")] },
    { id: "ai-feedback", links: [L("/#tips", "help.l.tips")] },
    { id: "ai-limits", links: [] },
    { id: "ai-privacy", links: [L("/privacy", "help.l.privacy")] },
  ] },
  { id: "incidents", items: [
    { id: "incidents-what", links: [L("/incidents", "help.l.incidents")] },
    { id: "incidents-report", links: [L("/incidents", "help.l.incidents"), L("/incidents/new", "help.l.incidentNew")] },
    { id: "incidents-questions", links: [L("/incidents/new", "help.l.incidentNew")] },
    { id: "incidents-threat", links: [L("/incidents", "help.l.incidents")] },
    { id: "incidents-help", links: [L("/incidents", "help.l.incidents")] },
    { id: "incidents-history", links: [L("/incidents", "help.l.incidents")] },
    { id: "incidents-admin", links: [L("/incidents", "help.l.incidents")] },
  ] },
  { id: "chat", items: [
    { id: "chat-channels", links: [L("/chat", "help.l.chat"), L("/chat?c=all", "help.l.all")] },
    { id: "chat-write", links: [L("/chat", "help.l.chat")] },
    { id: "chat-replies", links: [L("/chat", "help.l.chat"), L("/mentions", "help.l.mentions")] },
    { id: "chat-files", links: [L("/chat", "help.l.chat"), L("/files", "help.l.files")] },
    { id: "chat-search", links: [L("/chat?c=all", "help.l.all")] },
    { id: "chat-taskforces", links: [L("/chat/tf/new", "help.l.tfNew")] },
    { id: "chat-dm", links: [L("/messages", "help.l.messages")] },
    { id: "chat-calls", links: [L("/schedule", "help.l.schedule")] },
  ] },
  { id: "ocr", items: [
    { id: "ocr-kinds", links: [L("/#upload", "help.l.overview")] },
    { id: "ocr-upload", links: [L("/#upload", "help.l.overview"), L("/screenshots", "help.l.screenshots")] },
    { id: "ocr-review", links: [L("/screenshots", "help.l.screenshots")] },
    { id: "ocr-auto", links: [L("/screenshots", "help.l.screenshots")] },
    { id: "ocr-storage", links: [L("/files", "help.l.files"), L("/privacy", "help.l.privacy")] },
    { id: "ocr-battle", links: [L("/screenshots", "help.l.screenshots"), L("/incidents", "help.l.incidents")] },
  ] },
  { id: "inactive", items: [
    { id: "inactive-origin", links: [L("/inactive", "help.l.inactive")] },
    { id: "inactive-filters", links: [L("/inactive", "help.l.inactive")] },
    { id: "inactive-results", links: [L("/inactive", "help.l.inactive")] },
    { id: "inactive-data", links: [L("/inactive", "help.l.inactive")] },
    { id: "inactive-players", links: [L("/inactive", "help.l.inactive"), L("/events", "help.l.events")] },
  ] },
  { id: "gamedata", items: [
    { id: "gamedata-tabs", links: [L("/gamedata", "help.l.gamedata")] },
  ] },
  { id: "admin", items: [
    { id: "admin-invite", links: [L("/admin?tab=members", "help.l.members"), L("/admin?tab=users", "help.l.users")] },
    { id: "admin-verify", links: [L("/admin?tab=members", "help.l.members"), L("/admin?tab=users", "help.l.users")] },
    { id: "admin-roles", links: [L("/admin?tab=members", "help.l.members"), L("/admin?tab=users", "help.l.users"), L("/admin?tab=rights", "help.l.rights")] },
    { id: "admin-alliances", links: [L("/admin?tab=alliances", "help.l.alliances")] },
    { id: "admin-channels", links: [L("/admin?tab=channels", "help.l.channels")] },
    { id: "admin-schedule", links: [L("/schedule", "help.l.schedule")] },
    { id: "admin-troops", links: [L("/troops", "help.l.troops")] },
    { id: "admin-accounts", links: [L("/admin?tab=users", "help.l.users")] },
    { id: "admin-audit", links: [L("/admin?tab=audit", "help.l.audit")] },
    { id: "admin-costs", links: [L("/admin?tab=costs", "help.l.costs")] },
  ] },
];

/** i18n-Schlüssel eines Punktes (IDs mit Bindestrich, Schlüssel mit Unterstrich). */
export const helpKey = (id: string, part: "t" | "b") => `help.${id.replace(/-/g, "_")}.${part}` as MessageKey;

/** Interne Weiterleitung nach dem Login: nur Pfade dieser App (kein `//host`, kein Schema). */
export const safeNext = (v: string | null | undefined): string | null => (v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && !/^\/+[a-z]+:/i.test(v) ? v : null);

/** Quicklink: angemeldet direkt, sonst über die Anmeldung mit Rücksprung. */
export const helpHref = (href: string, signedIn: boolean) => (signedIn ? href : `/login?next=${encodeURIComponent(href)}`);
