import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { AppBackground } from "@/components/app-background";
import { AccentProvider } from "@/components/accent-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Neuma",
  description: "Mentoria 1:1 premium de transformacao musical.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Neuma",
  },
};

export const viewport: Viewport = {
  themeColor: "#06090e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`dark ${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://app.cal.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://app.cal.com" />
      </head>
      <body className="relative flex min-h-dvh flex-col">
        {/* Fundo inviolável: ponta a ponta, sob safe areas do iOS */}
        <AppBackground />
        {/* Conteúdo interior respeita safe areas */}
        <div
          className={
            "relative z-10 flex min-h-dvh flex-1 flex-col " +
            "pt-[env(safe-area-inset-top,0px)] " +
            "pb-[env(safe-area-inset-bottom,0px)] " +
            "pl-[env(safe-area-inset-left,0px)] " +
            "pr-[env(safe-area-inset-right,0px)]"
          }
        >
          <AccentProvider>{children}</AccentProvider>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
