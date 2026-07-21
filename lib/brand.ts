// Tokens da marca Neuma, extraidos do branding oficial (branding/Neuma_AP.pdf + PNGS).
// A estetica sera aplicada ao tema numa fase posterior; isto centraliza os valores.

/** Paleta da marca (amostrada do gradiente e do app icon oficiais). */
export const brandColors = {
  ink: "#0D0D0D",
  white: "#FFFFFF",
  red: "#FF2F04", // vermelho quente do gradiente
  coral: "#FA4F33", // coral do app icon
  orange: "#F8AA66",
  lavender: "#C9B2EC",
  periwinkle: "#7B89F0",
  blue: "#2364CB",
} as const;

/** Gradiente assinatura da Neuma (quente -> frio). */
export const brandGradient =
  "linear-gradient(90deg, #FF2F04 0%, #F8AA66 30%, #C9B2EC 55%, #7B89F0 75%, #2364CB 100%)";

/**
 * Tipografia oficial.
 * - PP Eiko (Pangram Pangram): display/headings. Licenca comercial paga.
 *   O wordmark ja vem como asset (public/brand), portanto nao e obrigatorio
 *   como webfont ate decidirmos.
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
} as const;
