import type { MetadataRoute } from "next";

// Served by Next.js at /manifest.webmanifest and linked from every page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MDM Management System",
    short_name: "MDM",
    description: "Daily MDM registers for schools: meals, milk, eggs and stock.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // The tables are wide, so users rotate the phone
    orientation: "any",
    background_color: "#ffffff",
    // Green of the shield in public/logo.png (keep in sync with app/layout.tsx)
    theme_color: "#59916d",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
