// Generates the PWA / home-screen icons into public/. Run: node scripts/generate-icons.mjs
import { writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";

const cap = (size) =>
  h(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" }),
    h("path", { d: "M22 10v6" }),
    h("path", { d: "M6 12.5V16a6 3 0 0 0 12 0v-3.5" }),
  );

// `maskable` icons keep the artwork inside the safe zone and fill the whole square.
async function icon(size, file, { maskable = false } = {}) {
  const res = new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5865f2",
          borderRadius: maskable ? 0 : size * 0.22,
        },
      },
      cap(Math.round(size * (maskable ? 0.5 : 0.62))),
    ),
    { width: size, height: size },
  );
  await writeFile(new URL(`../public/${file}`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}

await icon(192, "icon-192.png");
await icon(512, "icon-512.png");
await icon(512, "icon-maskable-512.png", { maskable: true });
await icon(180, "apple-touch-icon.png", { maskable: true });
