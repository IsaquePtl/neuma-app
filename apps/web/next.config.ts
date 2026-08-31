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

function r2PublicHostname() {
  const raw = process.env.R2_PUBLIC_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseHostname();
const r2Host = r2PublicHostname();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/studio/library",
        destination: "/studio/paths",
      },
      {
        source: "/studio/library/:path*",
        destination: "/studio/paths/:path*",
      },
    ];
  },
  experimental: {
    // Default Server Actions = 1 MB; check-in / feedback videos up to 500 MB
    serverActions: {
      bodySizeLimit: "520mb",
    },
    // Proxy (Next 16) — evita cortar o body em produção
    proxyClientMaxBodySize: "520mb",
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
      ...(r2Host
        ? [
            {
              protocol: "https" as const,
              hostname: r2Host,
              pathname: "/**",
            },
          ]
        : []),
      {
        protocol: "https" as const,
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
