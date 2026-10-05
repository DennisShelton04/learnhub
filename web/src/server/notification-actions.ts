"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notification } from "@/db/schema/notifications";
import { requireUser } from "@/lib/session";
import { markRead } from "@/server/notifications";
import { safeNext } from "@/lib/safe-next";

/** Marks one notification read and opens what it points to. */
export async function openNotification(id: string) {
  const user = await requireUser();
  const found = await db.query.notification.findFirst({ where: and(eq(notification.id, id), eq(notification.userId, user.id)) });
  if (!found) redirect("/notifications");
  await markRead(user.id, [id]);
  revalidatePath("/", "layout");
  redirect(safeNext(found.href, "/notifications"));
}

export async function markAllRead() {
  const user = await requireUser();
  await markRead(user.id);
  revalidatePath("/", "layout");
}
