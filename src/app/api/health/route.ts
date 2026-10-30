import { ok } from "@/lib/http";
import { getDb } from "@/lib/db";
import { demoModeEnabled } from "@/lib/services/actor";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const r = getDb().prepare("SELECT (SELECT COUNT(*) FROM works) AS works, (SELECT COUNT(*) FROM exhibitions) AS exhibitions").get() as { works: number; exhibitions: number };
    return ok({ status: "ok", db: true, works: r.works, exhibitions: r.exhibitions, demoMode: demoModeEnabled() });
  } catch {
    return ok({ status: "degraded", db: false, demoMode: demoModeEnabled() }, 503);
  }
}
