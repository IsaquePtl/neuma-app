import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neuma",
    short_name: "Neuma",
    description:
      "Plataforma e mentoria musical focada em expressão, autonomia e consciência musical. Evolui sem horários fixos através de um percurso personalizado e acompanhamento 1:1.",
    start_url: "/",
    display: "standalone",
    // Android Chrome splash ≈ background_color + theme_color + ícone centrado
    background_color: "#161616",
    theme_color: "#161616",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon-512-any.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
