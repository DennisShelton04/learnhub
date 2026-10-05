import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { message } from "@/db/schema/messages";
import { auth } from "@/lib/auth";
import { detectAudioFormat, MAX_VOICE_BYTES, MAX_VOICE_MS } from "@/server/audio";
import { getChatMessage } from "@/server/messages";
import { getMessageInPost, getPostAccess } from "@/server/posts";
import { postTopic, publish } from "@/server/realtime";
import { deleteFile, saveFile } from "@/server/storage";
import { notifyAboutMessage } from "@/server/notifications";
import { awardXp } from "@/server/xp";

const fieldsSchema = z.object({
  durationMs: z.coerce.number().int().min(300).max(MAX_VOICE_MS),
  parentId: z.string().min(1).nullable(),
});

/** Upload a recorded voice note and post it as a message. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/posts/[postId]/voice">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please log in again." }, { status: 401 });
  const { postId } = await ctx.params;
  const access = await getPostAccess(postId, session.user.id);
  if (!access) return Response.json({ error: "This post no longer exists." }, { status: 404 });
  if (!access.role) return Response.json({ error: "Join this community to take part in the discussion." }, { status: 403 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_VOICE_BYTES + 64 * 1024) return Response.json({ error: "Voice notes can be up to 5 MB." }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File)) return Response.json({ error: "No recording received." }, { status: 400 });
  if (audio.size > MAX_VOICE_BYTES) return Response.json({ error: "Voice notes can be up to 5 MB." }, { status: 413 });

  const fields = fieldsSchema.safeParse({ durationMs: form!.get("durationMs"), parentId: form!.get("parentId") || null });
  if (!fields.success) return Response.json({ error: "Voice notes must be between 1 second and 5 minutes." }, { status: 400 });
  const { durationMs, parentId } = fields.data;
  if (parentId && !(await getMessageInPost(parentId, postId))) {
    return Response.json({ error: "The message you're replying to was deleted." }, { status: 400 });
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  const format = detectAudioFormat(bytes);
  if (!format) return Response.json({ error: "That recording format isn't supported." }, { status: 415 });

  const id = crypto.randomUUID();
  const key = `voice/${id}.${format.ext}`;
  await saveFile(key, bytes);
  try {
    await db.insert(message).values({
      id,
      postId,
      authorId: session.user.id,
      parentId,
      kind: "voice",
      body: "",
      audioKey: key,
      audioType: format.type,
      audioDurationMs: Math.round(durationMs),
    });
  } catch (err) {
    await deleteFile(key);
    throw err;
  }

  await publish({ topic: postTopic(postId), type: "message.created", id });
  await awardXp({ userId: session.user.id, communityId: access.communityId, kind: "voice_sent", refId: id });
  await notifyAboutMessage(id);
  return Response.json({ message: await getChatMessage(id) }, { status: 201 });
}
