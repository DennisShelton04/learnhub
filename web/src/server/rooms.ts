import { and, asc, count, desc, eq, gt, lt, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { post } from "@/db/schema/posts";
import { roomParticipant, roomPlayback } from "@/db/schema/rooms";
import type { RoomPlayback } from "@/server/realtime";

/** Participants who haven't sent a heartbeat for this long are treated as gone. */
export const ACTIVE_WINDOW = sql`now() - interval '40 seconds'`;

export async function listActiveParticipants(postId: string) {
  return db
    .select({ userId: roomParticipant.userId, name: user.name, muted: roomParticipant.muted })
    .from(roomParticipant)
    .innerJoin(user, eq(user.id, roomParticipant.userId))
    .where(and(eq(roomParticipant.postId, postId), gt(roomParticipant.lastSeenAt, ACTIVE_WINDOW)))
    .orderBy(asc(roomParticipant.joinedAt));
}

export async function getPlayback(postId: string): Promise<RoomPlayback> {
  const row = await db.query.roomPlayback.findFirst({ where: eq(roomPlayback.postId, postId) });
  return {
    playing: row?.playing ?? false,
    positionSec: row?.positionSec ?? 0,
    updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
  };
}

export type RoomState = {
  participants: { userId: string; name: string; muted: boolean }[];
  /** The longest-present participant controls the shared video. */
  hostId: string | null;
  playback: RoomPlayback;
  serverNow: string;
};

export async function getRoomState(postId: string): Promise<RoomState> {
  const [participants, playback] = await Promise.all([listActiveParticipants(postId), getPlayback(postId)]);
  return { participants, hostId: participants[0]?.userId ?? null, playback, serverNow: new Date().toISOString() };
}

/** Drop rows for people who left without saying so (closed tab, lost connection). */
export async function pruneStaleParticipants(postId: string) {
  await db.delete(roomParticipant).where(and(eq(roomParticipant.postId, postId), lt(roomParticipant.lastSeenAt, ACTIVE_WINDOW)));
}

/** Posts in a community with people in their study room right now. */
export const listLiveRooms = cache(async (communityId: string) => {
  return db
    .select({ postId: post.id, title: post.title, people: count(roomParticipant.userId) })
    .from(roomParticipant)
    .innerJoin(post, eq(post.id, roomParticipant.postId))
    .where(and(eq(post.communityId, communityId), gt(roomParticipant.lastSeenAt, ACTIVE_WINDOW)))
    .groupBy(post.id, post.title)
    .orderBy(desc(count(roomParticipant.userId)));
});
