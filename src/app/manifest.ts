import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TCSM clubevenementen",
    short_name: "TCSM",
    description: "Zie wie meedoet en schrijf je in voor de clubevenementen",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#23643c",
    lang: "nl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
