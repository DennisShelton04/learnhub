import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/server/posts";
import { getRoomState } from "@/server/rooms";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/rooms/[postId]">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { postId } = await ctx.params;
  if (!(await getPostAccess(postId, session.user.id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await getRoomState(postId), { headers: { "Cache-Control": "no-store" } });
}
