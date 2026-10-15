import type en from "../en/nav";

const de: Record<keyof typeof en, string> = {
  "nav.main": "Hauptnavigation",
  "nav.mainMobile": "Hauptnavigation (mobil)",
  "nav.overview": "Übersicht",
  "nav.myVillages": "Meine Dörfer",
  "nav.villages": "Dörfer",
  "nav.inactive": "Inaktive",
  "nav.chat": "Chat",
  "nav.taskForces": "Task-Forces",
  "nav.messages": "Nachrichten",
  "nav.schedule": "Schedule",
  "nav.troops": "Truppen",
  "nav.screenshots": "Screenshots",
  "nav.admin": "Admin",
  "nav.gameData": "Spieldaten",
  "nav.unread": "{n} ungelesen",
  "nav.myFiles": "Meine Bilder & Dateien",
  "nav.logout": "Abmelden",
  "nav.worldEnded": "Die Spielwelt scheint beendet.",
  "nav.worldEndedBody": "Die Kartendaten sind seit {date} nicht mehr abrufbar. Der Stand bleibt als Archiv sichtbar, der Chat funktioniert weiter. Ein Admin kann eine neue Welt starten (docs/DEPLOY.md).",
  "nav.worldEndedUnknown": "längerem",
  "nav.forbiddenTitle": "Kein Zugriff",
  "nav.forbiddenBody": "Dafür fehlt dir ein Recht.",
};
export default de;
