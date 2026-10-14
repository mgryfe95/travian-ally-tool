import { createLimiter } from "../ratelimit";

/** Pro Nutzer: Nachrichten 30/min, Uploads 20/min (in-memory, eine App-Instanz). */
export const postLimiter = createLimiter(30, 60_000);
export const uploadLimiter = createLimiter(20, 60_000);
