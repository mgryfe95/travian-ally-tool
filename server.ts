import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();
const httpServer = createServer((req, res) => void handle(req, res));
// Realtime-Chat (Rooms, Berechtigungsprüfung beim Join) folgt in M4.
export const io = new SocketServer(httpServer, { path: "/socket.io" });

httpServer.listen(port, () => console.log(`> ready on :${port} (${dev ? "dev" : "prod"})`));
