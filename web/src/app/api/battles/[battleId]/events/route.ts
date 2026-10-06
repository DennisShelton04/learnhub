import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getBattleAccess } from "@/server/battles";
import { battleTopic } from "@/server/realtime";
import { realtimeResponse } from "@/server/sse";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/battles/[battleId]/events">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { battleId } = await ctx.params;
  if (!(await getBattleAccess(battleId, session.user.id))) return new Response("Not found", { status: 404 });
  return realtimeResponse(request, battleTopic(battleId));
}
