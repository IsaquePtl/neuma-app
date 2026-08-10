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
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://app.cal.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://app.cal.com" />
      </head>
      <body className="relative flex min-h-full flex-col">
        <AppBackground />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <AccentProvider>{children}</AccentProvider>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
