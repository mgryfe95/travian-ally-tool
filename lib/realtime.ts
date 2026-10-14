import type { Server } from "socket.io";

/** Der Socket.IO-Server lebt im Custom Server (server.ts) im selben Prozess; Services veröffentlichen darüber. */
type G = typeof globalThis & { __io?: Server };

export const setIo = (io: Server) => {
  (globalThis as G).__io = io;
};

export const channelRoom = (channelId: number) => `channel:${channelId}`;

export function publish(channelId: number, event: "message:new" | "message:edit" | "message:delete", payload: unknown) {
  (globalThis as G).__io?.to(channelRoom(channelId)).emit(event, payload);
}
