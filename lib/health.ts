export type HealthResult = { status: "ok" | "degraded"; db: boolean; time: string };

export async function checkHealth(pingDb: () => Promise<unknown>): Promise<HealthResult> {
  let dbOk = true;
  try {
    await pingDb();
  } catch {
    dbOk = false;
  }
  return { status: dbOk ? "ok" : "degraded", db: dbOk, time: new Date().toISOString() };
}
