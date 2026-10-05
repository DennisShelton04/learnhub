import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { countUnread } from "@/server/notifications";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ unread: await countUnread(session.user.id) }, { headers: { "Cache-Control": "no-store" } });
}
