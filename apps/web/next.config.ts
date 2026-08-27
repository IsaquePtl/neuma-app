import type { NextConfig } from "next";

function supabaseHostname() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseHostname();

const nextConfig: NextConfig = {
  experimental: {
    // Default Server Actions = 1 MB → fotos iPhone → "unexpected response"
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Proxy (Next 16) — evita cortar o body em produção
    proxyClientMaxBodySize: "12mb",
  },
  images: {
    // Vercel Services (vercel.json services.web) does not expose /_next/image —
    // optimizer returns HTML 404 (x-matched-path: /404) while /brand/* static works.
    unoptimized: true,
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
