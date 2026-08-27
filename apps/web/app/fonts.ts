import { Geist_Mono, Nata_Sans } from "next/font/google";

/**
 * Nata Sans — unica tipografia da app por agora.
 * PP Eiko fica em app/eiko/ (nao carregada).
 */
export const nataSans = Nata_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-nata",
  display: "swap",
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
