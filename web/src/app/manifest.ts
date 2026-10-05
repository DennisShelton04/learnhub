import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LearnHub",
    short_name: "LearnHub",
    description: "Learn together: discuss videos and articles, share voice notes, and quiz each other.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#313338",
    theme_color: "#5865f2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
