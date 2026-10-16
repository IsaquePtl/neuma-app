import type {
  LibraryAssetKind,
  LibraryAssetUsage,
} from "@/lib/types/database.types";

/** What the mentor picks. Image and text stay in the database as a ficheiro. */
export type LibraryAssetFormat = "video" | "link" | "file";

export const LIBRARY_FORMAT_LABEL: Record<LibraryAssetFormat, string> = {
  video: "Vídeo",
  link: "Link",
  file: "Ficheiro",
};

export function libraryAssetFormat(kind: LibraryAssetKind): LibraryAssetFormat {
  if (kind === "video" || kind === "link") return kind;
  return "file";
}

export function formatsForUsage(usage: LibraryAssetUsage): LibraryAssetFormat[] {
  if (usage === "practice") return ["video", "link", "file"];
  return ["video", "link"];
}

export function libraryFormatAllowed(
  usage: LibraryAssetUsage,
  kind: LibraryAssetKind,
): boolean {
  if (usage !== "lesson" && usage !== "practice") return false;
  return formatsForUsage(usage).includes(libraryAssetFormat(kind));
}

export function libraryFormatError(
  usage: LibraryAssetUsage,
  kind: LibraryAssetKind,
): string | null {
  if (libraryFormatAllowed(usage, kind)) return null;
  if (usage === "lesson") return "Uma aula só pode ser vídeo ou link.";
  return "Uma prática pode ser vídeo, link ou ficheiro.";
}
