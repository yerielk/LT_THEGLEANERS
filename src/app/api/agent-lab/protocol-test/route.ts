import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { protocolTest } from "@/lib/mcp-inspect";
import { LectaError } from "@/lib/services/errors";
import { canUseAgentLab, webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

/** Runs a real, read-only MCP client session against the MCP server and returns the trace. */
export async function POST(req: Request) {
  try {
    if (!canUseAgentLab(await webActor())) throw new LectaError("FORBIDDEN", "The agent lab is limited to admins on this deployment.");
    rateLimit(req, "agent-lab", 6);
    const body = (await readJson(req)) as { exhibitionId?: string };
    const id = typeof body.exhibitionId === "string" && /^[A-Za-z0-9_\-]{3,64}$/.test(body.exhibitionId) ? body.exhibitionId : "ex_on_things_left_unsaid";
    try {
      return ok({ trace: await protocolTest(id), ranAt: new Date().toISOString() });
    } catch (e) {
      throw new LectaError("SERVICE_UNAVAILABLE", `MCP server unreachable: ${(e as Error).message}. Start it with npm run mcp:dev.`);
    }
  } catch (e) {
    return fail(e);
  }
}
