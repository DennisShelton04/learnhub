import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LinkPreview = {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const YOUTUBE_ID = /^[\w-]{11}$/;

/** Returns the 11-character video id for YouTube watch, short, embed and youtu.be links. */
export function parseYouTubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else id = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export async function fetchYouTubePreview(videoId: string): Promise<LinkPreview> {
  const fallback = {
    title: null,
    description: null,
    image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    siteName: "YouTube",
  };
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return { ...fallback, title: clip(data.title, 200), description: data.author_name ? `by ${clip(data.author_name, 100)}` : null };
  } catch {
    return fallback;
  }
}

const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

/**
 * Fetches Open Graph / meta tags for an article link.
 * Refuses non-HTTP(S) URLs and any host that resolves to a private, loopback or link-local
 * address (checked again on every redirect) so users can't make the server probe internal networks.
 * Returns null on any failure; previews are best-effort.
 */
export async function fetchArticlePreview(rawUrl: string): Promise<LinkPreview | null> {
  try {
    let current = new URL(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicHttpUrl(current))) return null;

      const res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { "user-agent": "LearnHubBot/0.1 (link preview)", accept: "text/html" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        current = new URL(location, current);
        continue;
      }
      if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) return null;

      return parseMeta(await readLimited(res, MAX_HTML_BYTES), current);
    }
    return null;
  } catch {
    return null;
  }
}

async function isPublicHttpUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast and reserved
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) {
    const mapped = v6.slice(7);
    // Block hex-form mapped addresses outright rather than decoding them.
    return isIP(mapped) === 4 ? isPrivateAddress(mapped) : true;
  }
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function readLimited(res: Response, maxBytes: number) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return html;
}

function parseMeta(html: string, pageUrl: URL): LinkPreview {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const key = attr(tag, "property") ?? attr(tag, "name");
    const content = attr(tag, "content");
    if (key && content && !meta.has(key.toLowerCase())) meta.set(key.toLowerCase(), decodeEntities(content));
  }
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];

  return {
    title: clip(meta.get("og:title") ?? meta.get("twitter:title") ?? (titleTag && decodeEntities(titleTag)), 200),
    description: clip(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), 300),
    image: absoluteHttpUrl(meta.get("og:image") ?? meta.get("twitter:image"), pageUrl),
    siteName: clip(meta.get("og:site_name") ?? pageUrl.hostname.replace(/^www\./, ""), 100),
  };
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.slice(1).find((v) => v !== undefined);
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function absoluteHttpUrl(value: string | undefined, base: URL) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function clip(value: string | null | undefined, max: number) {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}
