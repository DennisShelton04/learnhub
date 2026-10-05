import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { message } from "@/db/schema/messages";

/** A message as sent to the browser (dates as ISO strings, body hidden once deleted). */
export type ChatMessage = {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  kind: "text" | "voice";
  body: string;
  /** Voice notes only. */
  audioUrl: string | null;
  audioDurationMs: number | null;
  createdAt: string;
  deleted: boolean;
};

const fields = {
  id: message.id,
  postId: message.postId,
  parentId: message.parentId,
  authorId: message.authorId,
  authorName: user.name,
  kind: message.kind,
  body: message.body,
  audioKey: message.audioKey,
  audioDurationMs: message.audioDurationMs,
  createdAt: message.createdAt,
  deletedAt: message.deletedAt,
};

type Row = Omit<ChatMessage, "createdAt" | "deleted" | "audioUrl"> & {
  audioKey: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

function toChatMessage({ deletedAt, createdAt, body, audioKey, audioDurationMs, ...rest }: Row): ChatMessage {
  const deleted = deletedAt !== null;
  return {
    ...rest,
    body: deleted ? "" : body,
    audioUrl: audioKey && !deleted ? `/api/messages/${rest.id}/audio` : null,
    audioDurationMs: deleted ? null : audioDurationMs,
    createdAt: createdAt.toISOString(),
    deleted,
  };
}

export async function listMessages(postId: string) {
  const rows = await db
    .select(fields)
    .from(message)
    .innerJoin(user, eq(user.id, message.authorId))
    .where(eq(message.postId, postId))
    .orderBy(asc(message.createdAt))
    .limit(500);
  return rows.map(toChatMessage);
}

export async function getChatMessage(id: string) {
  const [row] = await db.select(fields).from(message).innerJoin(user, eq(user.id, message.authorId)).where(eq(message.id, id));
  return row ? toChatMessage(row) : null;
}
