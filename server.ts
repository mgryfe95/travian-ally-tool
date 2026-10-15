import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { canReadChannel } from "./lib/chat/access";
import { auth } from "./lib/auth";
import { db } from "./lib/db";
import { env } from "./lib/env";
import { effectiveRole } from "./lib/permissions";
import { channelRoom, setIo } from "./lib/realtime";
import { seedPermissions } from "./lib/services/admin";
import { chatCtx, seedChat } from "./lib/services/chat";
import { dispatchDueCalls, seedSchedule } from "./lib/services/schedule";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, port, hostname: "localhost" });
const handle = app.getRequestHandler();

await app.prepare();
// Idempotent: Rechte-Defaults, ALLY-Kanäle und Tags beim ersten Start anlegen.
await seedPermissions(db);
await seedChat(db);
await seedSchedule(db);
const httpServer = createServer((req, res) => void handle(req, res));
const io = new SocketServer(httpServer, { path: "/socket.io" });
setIo(io);

/** Aktueller Nutzer aus der Session des Handshakes (Rolle/Sperre immer frisch aus der DB). */
async function userFromCookie(cookie: string | undefined) {
  if (!cookie) return null;
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!session) return null;
  const u = await db.user.findUnique({ where: { id: session.user.id } });
  if (!u || u.banned) return null;
  return { id: u.id, role: effectiveRole(u, env().SYSTEMADMIN_EMAILS) };
}

// Geplante Calls (Allianz-Schedule) alle 30 s prüfen und zur Zeit in den Zielkanal posten.
setInterval(() => void dispatchDueCalls(db).catch((e) => console.error("[schedule]", e)), 30_000);

io.use(async (socket, nextFn) => {
  try {
    const user = await userFromCookie(socket.handshake.headers.cookie);
    if (!user) return nextFn(new Error("unauthorized"));
    socket.data.userId = user.id;
    nextFn();
  } catch {
    nextFn(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  // Berechtigung wird bei jedem Join serverseitig geprüft (Rolle/Mitgliedschaft frisch aus der DB).
  socket.on("join", async (channelId: unknown, ack?: (r: { ok: boolean }) => void) => {
    try {
      const user = await userFromCookie(socket.handshake.headers.cookie);
      const ch = typeof channelId === "number" ? await db.channel.findUnique({ where: { id: channelId } }) : null;
      if (!user || !ch || !canReadChannel(ch, await chatCtx(db, user))) return ack?.({ ok: false });
      await socket.join(channelRoom(ch.id));
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false });
    }
  });
  socket.on("leave", (channelId: unknown) => {
    if (typeof channelId === "number") void socket.leave(channelRoom(channelId));
  });
});

httpServer.listen(port, () => console.log(`> ready on :${port} (${dev ? "dev" : "prod"})`));
