export type CategoryTheme = "acoustic" | "electric" | "piano";

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
};

export function isCategoryTheme(value: string | null | undefined): value is CategoryTheme {
  return value === "acoustic" || value === "electric" || value === "piano";
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

  if (/eletr|electr/.test(hay)) return "electric";
  if (/acust/.test(hay)) return "acoustic";
  if (/piano|teclado|keyboard/.test(hay)) return "piano";
  if (/guitar/.test(hay)) return "acoustic";
  return null;
}

export function categoryThemeWash(color: string) {
  return `linear-gradient(155deg, color-mix(in srgb, ${color} 32%, #161616) 0%, #1a1a1a 58%, #161616 100%)`;
}
