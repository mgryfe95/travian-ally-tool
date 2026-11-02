"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | undefined;

/** Eine Verbindung pro Browser-Tab; Cookies der Session gehen automatisch mit (gleiche Origin). */
export function getSocket(): Socket {
  return (socket ??= io({ path: "/socket.io", withCredentials: true }));
}
