import type { MetadataRoute } from "next";

const SITE = "https://www.comunidadeneuma.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/subscrever", "/privacidade", "/termos"],
      disallow: ["/api/", "/studio/", "/home", "/path", "/session", "/settings"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
