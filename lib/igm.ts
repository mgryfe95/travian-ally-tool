/**
 * Link zum Schreibfenster der Ingame-Nachrichten, Empfänger vorausgefüllt. Vorlage über `IGM_WRITE_URL` anpassbar
 * (`{server}` = TRAVIAN_SERVER_URL, `{id}` = Spieler-ID aus map.sql, `{name}` = URL-kodierter Spielername). Betreff/Text lassen
 * sich nicht per URL vorbelegen.
 */
export const DEFAULT_IGM_WRITE_URL = "{server}/messages/write?to={id}";

export const igmWriteUrl = (server: string, player: { id: number; name: string }, template = DEFAULT_IGM_WRITE_URL): string =>
  template.replace("{server}", server.replace(/\/+$/, "")).replace("{id}", String(player.id)).replace("{name}", encodeURIComponent(player.name));
