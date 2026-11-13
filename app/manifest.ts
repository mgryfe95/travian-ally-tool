import type { MetadataRoute } from "next";

/** Web-App-Manifest: installierbar als PWA und Grundlage der Android-App (TWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Humans Ally Tool",
    short_name: "Ally Tool",
    description: "Travian alliance tool: chat, calls, villages, AI advice.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4ebd6",
    theme_color: "#14253e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
