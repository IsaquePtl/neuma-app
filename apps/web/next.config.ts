import path from "node:path";
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

const CANONICAL_ORIGIN = "https://www.comunidadeneuma.com";
const LEGACY_ALIAS_HOST = "neuma-app-topaz.vercel.app";

const supabaseOrigins = [
  "https://*.supabase.co",
  "wss://*.supabase.co",
  ...(supabaseHost ? [`https://${supabaseHost}`, `wss://${supabaseHost}`] : []),
];
const r2Origins = [
  "https://*.r2.cloudflarestorage.com",
  "https://*.r2.dev",
  ...(r2Host ? [`https://${r2Host}`] : []),
];
const stripeOrigins = [
  "https://js.stripe.com",
  "https://*.stripe.com",
  "https://hooks.stripe.com",
  "https://*.stripe.network",
];
const calOrigins = ["https://app.cal.com", "https://cal.com", "https://*.cal.com"];
const videoEmbedOrigins = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://www.loom.com",
  "https://drive.google.com",
];

// Report-Only: violations surface in the browser console without breaking
// Stripe / Cal / Tally / uploads. Promote to enforcing after a clean week.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://checkout.stripe.com",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://tally.so ${stripeOrigins.join(" ")} ${calOrigins.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigins.filter((o) => o.startsWith("https")).join(" ")} ${r2Origins.join(" ")} ${stripeOrigins.join(" ")} https://*.googleusercontent.com https://i.ytimg.com https://i.vimeocdn.com https://tally.so`,
  `media-src 'self' blob: ${supabaseOrigins.filter((o) => o.startsWith("https")).join(" ")} ${r2Origins.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins.join(" ")} ${r2Origins.join(" ")} ${stripeOrigins.join(" ")} ${calOrigins.join(" ")} https://api.cal.com https://tally.so https://vitals.vercel-insights.com`,
  `frame-src 'self' ${stripeOrigins.join(" ")} ${calOrigins.join(" ")} ${videoEmbedOrigins.join(" ")} https://tally.so`,
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(self "https://tally.so"), microphone=(self "https://tally.so"), geolocation=(), browsing-topics=()',
  },
  // No `preload`: with a preloaded HSTS entry, browsers stop offering
  // "continue anyway" on ISP block pages, which makes filtered networks worse.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        // Webhooks (Stripe/Cal/Tally) may still be registered on the alias.
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: LEGACY_ALIAS_HOST }],
        destination: `${CANONICAL_ORIGIN}/:path`,
        permanent: true,
      },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
  // Evita o Turbopack escolher a pasta do monorepo quando há lockfiles extra.
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // Default Server Actions = 1 MB. Biblioteca sobe por URL assinada ao R2;
    // estes limites cobrem só fallbacks que ainda passam pelo Next.
    serverActions: {
      bodySizeLimit: "100mb",
    },
    // Proxy (Next 16) — evita cortar o body em produção
    proxyClientMaxBodySize: "100mb",
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
