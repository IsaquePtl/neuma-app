import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { AppBackground } from "@/components/app-background";
import { AccentProvider } from "@/components/accent-provider";
import { MobileKeyboardAvoidance } from "@/components/mobile-keyboard-avoidance";
import { geistMono, nataSans } from "@/app/fonts";

export const metadata: Metadata = {
  title: "Neuma",
  description:
    "Plataforma e mentoria musical focada em expressão, autonomia e consciência musical. Evolui sem horários fixos através de um percurso personalizado e acompanhamento 1:1.",
  applicationName: "Neuma",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Neuma",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      {
        url: "/brand/app-icon.browser.png",
        type: "image/png",
        sizes: "512x512",
      },
      {
        url: "/brand/app-icon.browser.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        url: "/brand/app-icon.browser.png",
        type: "image/png",
        sizes: "32x32",
      },
    ],
    apple: [
      { url: "/brand/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
      { url: "/brand/app-icon.png", type: "image/png", sizes: "1024x1024" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#161616",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  /* Teclado sobrepõe — o layout/fundo NÃO encolhem */
  interactiveWidget: "overlays-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      data-neuma-build="wall-v5"
      data-neuma-bg="crepusculo"
      suppressHydrationWarning
      className={`dark ${nataSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('neuma-bg-theme');if(t==='neon'||t==='crepusculo')document.documentElement.setAttribute('data-neuma-bg',t)}catch(e){}",
          }}
        />
        {/* Primeiro paint imediato — evita flash preto antes do CSS/JS */}
        <style
          dangerouslySetInnerHTML={{
            __html: "html,body{background-color:#161616!important;}",
          }}
        />
        {/* iOS Home Screen launch: mostra fundo Neuma em vez de ecrã preto */}
        <link
          rel="apple-touch-startup-image"
          href="/brand/startup/splash-iphone-14-pro-max.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/brand/startup/splash-iphone-14-pro.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/brand/startup/splash-iphone-13-14.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/brand/startup/splash-iphone-12-13-pro-max.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/brand/startup/splash-iphone-x.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/brand/startup/splash-iphone-xr.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/brand/startup/splash-iphone-8.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link rel="preconnect" href="https://app.cal.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://app.cal.com" />
        <link rel="preconnect" href="https://tally.so" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tally.so" />

        {/* Ajuda o Google a escolher o ícone/branding e o snippet na SERP */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Comunidade Neuma",
              url: "https://www.comunidadeneuma.com/",
              logo: "https://www.comunidadeneuma.com/brand/app-icon.browser.png",
              description:
                "Plataforma e mentoria musical focada em expressão, autonomia e consciência musical. Evolui sem horários fixos através de um percurso personalizado e acompanhamento 1:1.",
            }),
          }}
        />
      </head>
      <body>
        {/* Parede: camada atrás, nunca scroll / teclado */}
        <AppBackground />
        <MobileKeyboardAvoidance />
        {/* UI: única camada que faz scroll e reage ao teclado */}
        <div data-neuma-ui className="neuma-ui">
          <AccentProvider>{children}</AccentProvider>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
