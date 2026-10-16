export type CategoryTheme = "acoustic" | "electric" | "piano" | "theory";

export const CATEGORY_THEMES: Record<
  CategoryTheme,
  { label: string; color: string; icon: string }
> = {
  acoustic: {
    label: "Guitarra acústica",
    color: "#cecf12",
    icon: "/brand/icon-acoustic.png",
  },
  piano: {
    label: "Piano",
    color: "#f27c25",
    icon: "/brand/icon-piano.png",
  },
  electric: {
    label: "Guitarra elétrica",
    color: "#127eee",
    icon: "/brand/icon-electric.png",
  },
  theory: {
    label: "Teoria Musical",
    color: "#127eee",
    icon: "/brand/icon-theory.png",
  },
};

export function isCategoryTheme(value: string | null | undefined): value is CategoryTheme {
  return (
    value === "acoustic" ||
    value === "electric" ||
    value === "piano" ||
    value === "theory"
  );
}

export function inferCategoryTheme(input: {
  theme?: string | null;
  slug?: string | null;
  name?: string | null;
}): CategoryTheme | null {
  if (isCategoryTheme(input.theme)) return input.theme;

  const hay = `${input.slug ?? ""} ${input.name ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/teoria|theory/.test(hay)) return "theory";
  if (/eletr|electr/.test(hay)) return "electric";
  if (/acust/.test(hay)) return "acoustic";
  if (/piano|teclado|keyboard/.test(hay)) return "piano";
  if (/guitar/.test(hay)) return "acoustic";
  return null;
}

export function categoryThemeWash(color: string) {
  return `linear-gradient(155deg, color-mix(in srgb, ${color} 32%, #161616) 0%, #1a1a1a 58%, #161616 100%)`;
}

const NEUTRAL_WASH = "linear-gradient(155deg, #1f1f1f 0%, #161616 100%)";

export function categoryCardWash(input: {
  theme?: string | null;
  slug?: string | null;
  name?: string | null;
}): string {
  const theme = inferCategoryTheme(input);
  if (theme) return categoryThemeWash(CATEGORY_THEMES[theme].color);
  return NEUTRAL_WASH;
}
