import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neuma",
    short_name: "Neuma",
    description: "Mentoria musical premium",
    start_url: "/",
    display: "standalone",
    background_color: "#06090e",
    theme_color: "#06090e",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
