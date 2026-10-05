import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getBattleState } from "@/server/battles";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/battles/[battleId]/state">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { battleId } = await ctx.params;
  const state = await getBattleState(battleId, session.user.id);
  if (!state) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
