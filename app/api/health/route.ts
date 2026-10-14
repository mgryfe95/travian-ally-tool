import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth(() => db.$queryRaw`SELECT 1`);
  return NextResponse.json(result, { status: result.db ? 200 : 503 });
}
