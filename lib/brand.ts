// Tokens da marca Neuma, extraidos do branding oficial (branding/Neuma_AP.pdf + PNGS).

/** Paleta oficial (branding/PNGS/paleta-cores.png). */
export const brandColors = {
  ink: "#161616",
  white: "#FFFFFF",
  cream: "#ffffe9",
  red: "#f54336",
  orange: "#f27c25",
  blue: "#127eee",
  magenta: "#f16df3",
  lime: "#cecf12",
  purple: "#6f51bc",
} as const;

/** Gradiente assinatura da Neuma (quente -> frio). */
export const brandGradient =
  "linear-gradient(90deg, #f54336 0%, #f27c25 28%, #f16df3 52%, #6f51bc 76%, #127eee 100%)";

/**
 * Tipografia oficial.
 * - PP Eiko (Pangram Pangram): display/títulos. Licenca comercial paga.
 *   Ficheiros em app/eiko/; por agora a app nao a carrega.
 * - Nata Sans: sans-serif de corpo. Disponivel gratuitamente (Google Fonts).
 * - Jubilat (Darden Studio): serif de apoio. Licenca comercial paga.
 */
export const brandFonts = {
  display: "PP Eiko",
  sans: "Nata Sans",
  serifSupport: "Jubilat",
} as const;

/** Caminhos dos assets servidos (public/brand). */
export const brandAssets = {
  wordmarkWhite: "/brand/wordmark-white.png",
  wordmarkBlack: "/brand/wordmark-black.png",
  markWhite: "/brand/mark-white.png",
  markBlack: "/brand/mark-black.png",
  appIcon: "/brand/app-icon.png",
  gradient: "/brand/gradient.png",
  appBackground: "/brand/app-background.png",
  backgroundNeuma: "/brand/background-neuma.png",
  backgroundPhoto: "/brand/background-photo.png",
  writtenNeumas: "/brand/written-neumas-white.png",
  iconAcoustic: "/brand/icon-acoustic.png",
  iconPiano: "/brand/icon-piano.png",
  iconElectric: "/brand/icon-electric.png",
} as const;
