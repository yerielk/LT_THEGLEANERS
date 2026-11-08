import { count } from "drizzle-orm";
import { ok } from "@/lib/http";
import { getDb } from "@/lib/db";
import { exhibitions, works } from "@/lib/schema";
import { demoModeEnabled } from "@/lib/services/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const [[w], [e]] = await Promise.all([db.select({ n: count() }).from(works), db.select({ n: count() }).from(exhibitions)]);
    return ok({ status: "ok", db: true, works: w.n, exhibitions: e.n, demoMode: demoModeEnabled() });
  } catch {
    return ok({ status: "degraded", db: false, demoMode: demoModeEnabled() }, 503);
  }
}
