import type en from "../en/common";

const fr: Record<keyof typeof en, string> = {
  "common.language": "Langue",
  "common.role.admin": "Admin",
  "common.role.moderator": "Modérateur",
  "common.role.member": "Membre",
  "common.role.guest": "Invité",
  "common.coord.minus": "{axis} moins 1",
  "common.coord.plus": "{axis} plus 1",
  "common.coord.sign": "Inverser le signe de {axis}",
  "common.coord.hint": "Coller (12|-34) remplit les deux champs.",
  "common.hero": "Héros",
  "common.unitN": "Unité {n}",
};
export default fr;
