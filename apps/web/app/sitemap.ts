import type { MetadataRoute } from "next";

const SITE = "https://www.comunidadeneuma.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/login", "/login/signup", "/subscrever", "/privacidade", "/termos"].map(
    (path) => ({ url: `${SITE}${path}`, changeFrequency: "monthly" }),
  );
}
