import { and, eq, gt, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { roomParticipant, roomPlayback } from "@/db/schema/rooms";
import { auth } from "@/lib/auth";
import { getPostAccess } from "@/server/posts";
import { publish, roomTopic } from "@/server/realtime";
import { ACTIVE_WINDOW, listActiveParticipants, pruneStaleParticipants } from "@/server/rooms";

const signalSchema = z.object({
  to: z.string().min(1),
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown(),
});
const playbackSchema = z.object({ playing: z.boolean(), positionSec: z.number().min(0).max(24 * 3600) });
const heartbeatSchema = z.object({ muted: z.boolean().optional() });

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Study room actions: join, heartbeat, leave, playback (host only), signal (WebRTC relay). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/rooms/[postId]/[action]">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return json({ error: "Please log in again." }, 401);
  const { postId, action } = await ctx.params;
  const access = await getPostAccess(postId, session.user.id);
  if (!access) return json({ error: "Not found" }, 404);
  if (!access.role) return json({ error: "Join this community to use its study rooms." }, 403);
  const me = session.user.id;
  const body = await request.json().catch(() => ({}));
  const changed = () => publish({ topic: roomTopic(postId), type: "room.updated", id: postId });

  const isActive = async (userId: string) =>
    Boolean(
      await db.query.roomParticipant.findFirst({
        where: and(eq(roomParticipant.postId, postId), eq(roomParticipant.userId, userId), gt(roomParticipant.lastSeenAt, ACTIVE_WINDOW)),
      }),
    );

  switch (action) {
    case "join": {
      await pruneStaleParticipants(postId);
      await db
        .insert(roomParticipant)
        .values({ postId, userId: me })
        .onConflictDoUpdate({ target: [roomParticipant.postId, roomParticipant.userId], set: { lastSeenAt: sql`now()` } });
      await changed();
      return json({ ok: true });
    }
    case "heartbeat": {
      const parsed = heartbeatSchema.safeParse(body);
      const muted = parsed.success ? parsed.data.muted : undefined;
      const updated = await db
        .update(roomParticipant)
        .set({ lastSeenAt: sql`now()`, ...(muted !== undefined ? { muted } : {}) })
        .where(and(eq(roomParticipant.postId, postId), eq(roomParticipant.userId, me)))
        .returning({ muted: roomParticipant.muted });
      if (updated.length === 0) return json({ error: "Not in the room" }, 409);
      if (muted !== undefined) await changed();
      return json({ ok: true });
    }
    case "leave": {
      await db.delete(roomParticipant).where(and(eq(roomParticipant.postId, postId), eq(roomParticipant.userId, me)));
      await changed();
      return json({ ok: true });
    }
    case "playback": {
      const parsed = playbackSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Invalid playback state" }, 400);
      const [host] = await listActiveParticipants(postId);
      if (host?.userId !== me) return json({ error: "Only the room host controls the video." }, 403);
      const updatedAt = new Date();
      await db
        .insert(roomPlayback)
        .values({ postId, ...parsed.data, updatedAt })
        .onConflictDoUpdate({ target: roomPlayback.postId, set: { ...parsed.data, updatedAt } });
      await publish({ topic: roomTopic(postId), type: "room.playback", id: postId, data: { ...parsed.data, updatedAt: updatedAt.toISOString() } });
      return json({ ok: true });
    }
    case "signal": {
      const parsed = signalSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Invalid signal" }, 400);
      if (!(await isActive(me)) || !(await isActive(parsed.data.to))) return json({ error: "Both people must be in the room." }, 409);
      try {
        await publish({ topic: roomTopic(postId), type: "room.signal", id: postId, data: { from: me, ...parsed.data } });
      } catch {
        return json({ error: "Signal too large" }, 413);
      }
      return json({ ok: true });
    }
    default:
      return json({ error: "Unknown action" }, 404);
  }
}
