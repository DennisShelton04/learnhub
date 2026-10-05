import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/server/posts";
import { roomTopic } from "@/server/realtime";
import { sseResponse } from "@/server/sse";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/rooms/[postId]/events">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { postId } = await ctx.params;
  if (!(await getPostAccess(postId, session.user.id))) return new Response("Not found", { status: 404 });
  const me = session.user.id;
  // WebRTC signals are addressed to one person; nobody else receives them.
  return sseResponse(request, roomTopic(postId), (event) => event.type !== "room.signal" || event.data.to === me);
}
