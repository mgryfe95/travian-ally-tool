import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, makeT, matchLocale, type Locale, type T } from "./index";
import { getCurrentUser } from "../session";

/** Konto-Einstellung > Cookie > Browser (`Accept-Language`) > Englisch. Pro Request nur einmal berechnet. */
export const getLocale = cache(async (): Promise<Locale> => {
  const user = await getCurrentUser().catch(() => null);
  if (user?.locale && isLocale(user.locale)) return user.locale;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return matchLocale((await headers()).get("accept-language"));
});

export async function getT(): Promise<{ t: T; locale: Locale }> {
  const locale = await getLocale();
  return { t: makeT(locale), locale };
}
