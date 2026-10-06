import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/server/posts";
import { postTopic } from "@/server/realtime";
import { realtimeResponse } from "@/server/sse";

/** Server-Sent Events stream of new and deleted messages for one post. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/posts/[postId]/events">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { postId } = await ctx.params;
  if (!(await getPostAccess(postId, session.user.id))) return new Response("Not found", { status: 404 });
  return realtimeResponse(request, postTopic(postId));
}
