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

export const userRoom = (userId: string) => `user:${userId}`;

/** Persönliche Benachrichtigung (Messenger): `messenger:new` → Client lädt neu. */
export function publishUser(userId: string, event: "messenger:new", payload: unknown = {}) {
  (globalThis as G).__io?.to(userRoom(userId)).emit(event, payload);
}
