import type en from "../en/common";

const de: Record<keyof typeof en, string> = {
  "common.language": "Sprache",
  "common.role.admin": "Admin",
  "common.role.moderator": "Moderator",
  "common.role.member": "Mitglied",
  "common.role.guest": "Gast",
  "common.coord.minus": "{axis} minus 1",
  "common.coord.plus": "{axis} plus 1",
  "common.coord.sign": "Vorzeichen von {axis} umschalten",
  "common.coord.hint": "Einfügen von (12|-34) füllt beide Felder.",
  "common.hero": "Held",
  "common.unitN": "Einheit {n}",
};
export default de;
