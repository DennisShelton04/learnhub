import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listMessages } from "@/server/messages";
import { getPostAccess } from "@/server/posts";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/posts/[postId]/messages">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { postId } = await ctx.params;
  if (!(await getPostAccess(postId, session.user.id))) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(await listMessages(postId));
}
