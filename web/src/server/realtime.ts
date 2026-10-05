import { sql } from "drizzle-orm";
import { Client } from "pg";
import { db } from "@/db";
import { type ChatMessage, getChatMessage } from "@/server/messages";

/**
 * Live updates via Postgres LISTEN/NOTIFY.
 * Writers call publish(); every server process keeps one LISTEN connection and fans
 * events out to its in-memory subscribers (open SSE streams). Works across multiple
 * server instances without Redis.
 */

const CHANNEL = "learnhub_events";

type Notification =
  | { topic: string; type: "message.created" | "message.deleted" | "battle.updated" | "room.updated" | "notifications.changed"; id: string }
  // Room events carry their data inline (must fit in Postgres' 8 KB NOTIFY payload).
  | { topic: string; type: "room.playback" | "room.signal"; id: string; data: RoomData };

export type RoomSignal = { from: string; to: string; kind: "offer" | "answer" | "ice"; payload: unknown };
export type RoomPlayback = { playing: boolean; positionSec: number; updatedAt: string };
type RoomData = RoomSignal | RoomPlayback;

export type RealtimeEvent =
  | { type: "message.created"; message: ChatMessage }
  | { type: "message.deleted"; messageId: string }
  // Battle and room clients refetch their own state when told something changed.
  | { type: "battle.updated" }
  | { type: "room.updated" }
  | { type: "notifications.changed" }
  | { type: "room.playback"; data: RoomPlayback }
  | { type: "room.signal"; data: RoomSignal };

type Subscriber = (event: RealtimeEvent) => void;

class RealtimeHub {
  private topics = new Map<string, Set<Subscriber>>();
  private connecting: Promise<void> | null = null;

  subscribe(topic: string, fn: Subscriber) {
    let subs = this.topics.get(topic);
    if (!subs) this.topics.set(topic, (subs = new Set()));
    subs.add(fn);
    void this.ready().catch(() => {});
    return () => {
      subs.delete(fn);
      if (subs.size === 0) this.topics.delete(topic);
    };
  }

  /** Resolves once this process is listening for notifications. */
  ready() {
    this.connecting ??= this.connect().catch((err) => {
      this.connecting = null;
      throw err;
    });
    return this.connecting;
  }

  private async connect() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.on("notification", (n) => void this.dispatch(n.payload));
    const reconnect = () => {
      if (this.connecting === null) return;
      this.connecting = null;
      client.removeAllListeners();
      client.end().catch(() => {});
      setTimeout(() => {
        if (this.topics.size > 0) void this.ready().catch((err) => console.error("realtime reconnect failed", err));
      }, 1000);
    };
    client.on("error", reconnect);
    client.on("end", reconnect);
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
  }

  private async dispatch(payload: string | undefined) {
    if (!payload) return;
    const n = JSON.parse(payload) as Notification;
    const subs = this.topics.get(n.topic);
    if (!subs?.size) return;

    let event: RealtimeEvent;
    if (n.type === "message.created") {
      const message = await getChatMessage(n.id);
      if (!message) return;
      event = { type: n.type, message };
    } else if (n.type === "message.deleted") {
      event = { type: n.type, messageId: n.id };
    } else if (n.type === "room.playback") {
      event = { type: n.type, data: n.data as RoomPlayback };
    } else if (n.type === "room.signal") {
      event = { type: n.type, data: n.data as RoomSignal };
    } else {
      event = { type: n.type };
    }
    for (const fn of subs) fn(event);
  }
}

const globalForRealtime = globalThis as unknown as { realtime?: RealtimeHub };
// One hub per server process (survives hot reloads in development).
export const realtime = (globalForRealtime.realtime ??= new RealtimeHub());

export async function publish(notification: Notification) {
  const payload = JSON.stringify(notification);
  if (Buffer.byteLength(payload) > 7900) throw new Error("Realtime payload too large");
  await db.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
}

export const postTopic = (postId: string) => `post:${postId}`;
export const battleTopic = (battleId: string) => `battle:${battleId}`;
export const roomTopic = (postId: string) => `room:${postId}`;
export const userTopic = (userId: string) => `user:${userId}`;
