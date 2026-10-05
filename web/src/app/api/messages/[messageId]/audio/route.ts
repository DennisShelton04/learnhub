import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { message } from "@/db/schema/messages";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/server/posts";
import { fileSize, readFile } from "@/server/storage";

/** Streams a voice note to people allowed to see its post. Supports Range requests for seeking. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/messages/[messageId]/audio">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { messageId } = await ctx.params;
  const found = await db.query.message.findFirst({ where: eq(message.id, messageId) });
  if (!found?.audioKey || found.deletedAt || !(await getPostAccess(found.postId, session.user.id))) {
    return new Response("Not found", { status: 404 });
  }

  const headers = {
    "Content-Type": found.audioType ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };

  const size = await fileSize(found.audioKey);

  const match = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    // "bytes=start-end", "bytes=start-" or "bytes=-suffixLength"
    let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    let end = match[1] && match[2] ? Number(match[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    start = Math.max(0, start);
    return new Response(readFile(found.audioKey, { start, end }), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(readFile(found.audioKey), { headers: { ...headers, "Content-Length": String(size) } });
}
