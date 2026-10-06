import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { userTopic } from "@/server/realtime";
import { realtimeResponse } from "@/server/sse";

/** Live "you have a new notification" pings for the signed-in user. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  return realtimeResponse(request, userTopic(session.user.id));
}
