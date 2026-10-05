import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * File storage on local disk. Keys look like "voice/<uuid>.webm".
 * Swap this module for S3 / Cloudflare R2 in production; callers only use these functions.
 * The turbopackIgnore hints stop the build from tracing the whole project for these runtime paths.
 */

const root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_DIR ?? "./uploads");

function resolveKey(key: string) {
  const full = path.resolve(root, key);
  // Never let a key escape the storage directory.
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function saveFile(key: string, data: Uint8Array) {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function deleteFile(key: string) {
  await rm(resolveKey(key), { force: true });
}

export async function fileSize(key: string) {
  return (await stat(/*turbopackIgnore: true*/ resolveKey(key))).size;
}

/** Opens a file, or an inclusive byte range of it, as a web stream. */
export function readFile(key: string, range?: { start: number; end: number }) {
  return Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ resolveKey(key), range)) as ReadableStream<Uint8Array>;
}
