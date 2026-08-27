/**
 * Regras de exclusão mútua e transições válidas para o ChordSpec
 * dos construtores de acorde (piano / guitarra).
 */

import {
  EXTENSION_DEGREES,
  type ChordQuality,
  type ChordSpec,
  type ExtensionDegree,
  type SusKind,
} from "@/lib/music/chords";

export type ChordOptionAvailability = {
  quality: Record<ChordQuality, boolean>;
  /** Interruptor Sus. */
  sus: boolean;
  susKind: Record<Exclude<SusKind, "none">, boolean>;
  /** Interruptor Add. */
  add: boolean;
  /** Cada grau de extensão no menu. */
  extensions: Record<ExtensionDegree, boolean>;
};

const HIGH_EXTS = new Set<ExtensionDegree>([9, 11, 13]);

export function hasExplicitSeventh(spec: ChordSpec): boolean {
  return spec.extensions.includes(7);
}

/** 7ª presente (explícita ou implicada por 9/11/13 sem Add). */
export function hasSeventh(spec: ChordSpec): boolean {
  if (hasExplicitSeventh(spec)) return true;
  if (spec.add) return false;
  return spec.extensions.some((d) => HIGH_EXTS.has(d));
}

/** Rótulo do chip da 7ª conforme qualidade e ciclo. */
export function seventhChipLabel(spec: ChordSpec): string {
  if (!spec.extensions.includes(7)) return "7";
  if (spec.quality === "dim") return spec.majSeventh ? "m7b5" : "dim7";
  if (spec.majSeventh) return "maj7";
  return "7";
}

/** Tooltip do ciclo da 7ª. */
export function seventhCycleHint(spec: ChordSpec): string {
  switch (spec.quality) {
    case "major":
      return "Ciclar maj7 → 7 → off";
    case "dim":
      return "Ciclar dim7 → m7b5 → off";
    case "aug":
      return "Ciclar 7 → maj7 → off";
    default:
      return "Ciclar 7 → maj7 → off";
  }
}

/**
 * Quais controlos estão disponíveis no estado actual.
 * Preferir desactivar opções inválidas na UI.
 */
export function getChordOptionAvailability(
  spec: ChordSpec,
): ChordOptionAvailability {
  const susOn = spec.sus !== "none";
  const seventhOn = hasSeventh(spec);

  const extensions = Object.fromEntries(
    EXTENSION_DEGREES.map((deg) => {
      if (deg === 7) return [deg, !spec.add];
      if (deg === 5) {
        // b5 / #5 já vêm de Dim / Aum — não combinar com 5ª “normal”
        return [deg, spec.quality !== "dim" && spec.quality !== "aug"];
      }
      if (deg === 2) return [deg, spec.sus !== "sus2"];
      if (deg === 4) return [deg, spec.sus !== "sus4"];
      return [deg, true];
    }),
  ) as Record<ExtensionDegree, boolean>;

  return {
    // Sus elimina a 3ª — Maior/Menor não combinam com Sus
    quality: {
      major: !susOn,
      minor: !susOn,
      dim: true,
      aug: true,
    },
    sus: true,
    susKind: { sus2: true, sus4: true },
    // Add = extensão sem 7ª (Cadd9, não C7add9). Com Add ligado, permitir desligar.
    add: !seventhOn || spec.add,
    extensions,
  };
}

function sortedExts(exts: ExtensionDegree[]): ExtensionDegree[] {
  return [...exts].sort((a, b) => a - b);
}

function withoutDeg(
  exts: ExtensionDegree[],
  deg: ExtensionDegree,
): ExtensionDegree[] {
  return exts.filter((d) => d !== deg);
}

/**
 * Corrige inconsistências: Add↔7, 9/11/13 implicam 7, 5 com dim/aug, etc.
 */
export function normalizeChordSpec(spec: ChordSpec): ChordSpec {
  let extensions = [...spec.extensions] as ExtensionDegree[];
  let add = spec.add;
  let majSeventh = spec.majSeventh;
  let sus = spec.sus;

  // Dim e Aug são mutuamente exclusivos via `quality` (campo único).

  if (spec.quality === "dim" || spec.quality === "aug") {
    extensions = withoutDeg(extensions, 5);
  }

  if (sus === "sus2") extensions = withoutDeg(extensions, 2);
  if (sus === "sus4") extensions = withoutDeg(extensions, 4);

  const has7 = extensions.includes(7);
  const hasHigh = extensions.some((d) => HIGH_EXTS.has(d));

  if (add && has7) {
    // Add e 7ª não coexistem — manter Add, limpar 7
    extensions = withoutDeg(extensions, 7);
    majSeventh = false;
  } else if (!add && hasHigh && !has7) {
    // 9/11/13 sem Add → acorde completo implica 7ª
    extensions.push(7);
  }

  if (!extensions.includes(7)) {
    majSeventh = false;
  }

  // 13 sem 9 (modo completo): incluir 9 no naming/voicing via resolvedExtensions;
  // espelhar no spec para o chip 9 aparecer activo.
  if (
    !add &&
    extensions.includes(13) &&
    !extensions.includes(9) &&
    extensions.includes(7)
  ) {
    extensions.push(9);
  }

  return {
    ...spec,
    sus,
    add,
    majSeventh,
    extensions: sortedExts(extensions),
  };
}

/** Default da 7ª ao activar / ao mudar qualidade com 7 ligada. */
function defaultMajSeventhForQuality(quality: ChordQuality): boolean {
  // Maior → maj7; resto começa em 7 dominante / dim7 / aug7
  return quality === "major";
}

export function applyQuality(
  spec: ChordSpec,
  quality: ChordQuality,
): ChordSpec {
  const next: ChordSpec = {
    ...spec,
    quality,
    // Qualidade de tríade limpa Sus (3ª volta)
    sus: "none",
  };
  if (next.extensions.includes(7)) {
    next.majSeventh = defaultMajSeventhForQuality(quality);
  }
  return normalizeChordSpec(next);
}

export function applySus(spec: ChordSpec, sus: SusKind): ChordSpec {
  return normalizeChordSpec({ ...spec, sus });
}

export function applyAdd(spec: ChordSpec, add: boolean): ChordSpec {
  if (add) {
    return normalizeChordSpec({
      ...spec,
      add: true,
      extensions: withoutDeg(spec.extensions, 7),
      majSeventh: false,
    });
  }
  return normalizeChordSpec({ ...spec, add: false });
}

/**
 * Ciclo da 7ª (teoria por qualidade):
 * - Maior: maj7 → 7 → off
 * - Menor / Aum / Sus: 7 → maj7 → off
 * - Dim: dim7 → m7b5 → off  (majSeventh=false → dim7; true → m7b5)
 */
export function cycleSeventh(spec: ChordSpec): ChordSpec {
  if (spec.add) return spec;

  const has7 = spec.extensions.includes(7);
  const { quality, majSeventh } = spec;

  if (!has7) {
    const maj = defaultMajSeventhForQuality(quality);
    return normalizeChordSpec({
      ...spec,
      add: false,
      extensions: sortedExts([...spec.extensions, 7]),
      majSeventh: maj,
    });
  }

  // Segundo passo do ciclo
  if (quality === "major") {
    // maj7 → 7 → off
    if (majSeventh) {
      return normalizeChordSpec({ ...spec, majSeventh: false });
    }
    return normalizeChordSpec({
      ...spec,
      extensions: withoutDeg(spec.extensions, 7),
      majSeventh: false,
    });
  }

  if (quality === "dim") {
    // dim7 → m7b5 → off
    if (!majSeventh) {
      return normalizeChordSpec({ ...spec, majSeventh: true });
    }
    return normalizeChordSpec({
      ...spec,
      extensions: withoutDeg(spec.extensions, 7),
      majSeventh: false,
    });
  }

  // minor / aug / (sus com quality por baixo): 7 → maj7 → off
  if (!majSeventh) {
    return normalizeChordSpec({ ...spec, majSeventh: true });
  }
  return normalizeChordSpec({
    ...spec,
    extensions: withoutDeg(spec.extensions, 7),
    majSeventh: false,
  });
}

export function toggleExtension(
  spec: ChordSpec,
  deg: ExtensionDegree,
): ChordSpec {
  const availability = getChordOptionAvailability(spec);
  if (!availability.extensions[deg]) return spec;

  if (deg === 7) return cycleSeventh(spec);

  const has = spec.extensions.includes(deg);
  if (has) {
    return normalizeChordSpec({
      ...spec,
      extensions: withoutDeg(spec.extensions, deg),
    });
  }

  const had7 = spec.extensions.includes(7);
  let extensions = sortedExts([...spec.extensions, deg]);
  let majSeventh = spec.majSeventh;

  // Extensão alta sem Add → garantir 7ª apropriada
  if (!spec.add && HIGH_EXTS.has(deg) && !extensions.includes(7)) {
    extensions = sortedExts([...extensions, 7]);
  }
  if (!had7 && extensions.includes(7)) {
    // 9/11/13 em tríade maior/aum → 7 dominante (C9); maj7 só via ciclo do 7
    if (
      HIGH_EXTS.has(deg) &&
      (spec.quality === "major" || spec.quality === "aug")
    ) {
      majSeventh = false;
    } else {
      majSeventh = defaultMajSeventhForQuality(spec.quality);
    }
  }

  return normalizeChordSpec({ ...spec, extensions, majSeventh });
}

/** Patch genérico com normalização (ex.: mudar root). */
export function applyChordPatch(
  spec: ChordSpec,
  patch: Partial<ChordSpec>,
): ChordSpec {
  if (patch.quality != null && patch.quality !== spec.quality) {
    return normalizeChordSpec({
      ...applyQuality(spec, patch.quality),
      ...patch,
      quality: patch.quality,
      sus: patch.sus ?? "none",
    });
  }
  if (patch.sus != null && patch.sus !== spec.sus) {
    return normalizeChordSpec({
      ...applySus(spec, patch.sus),
      ...patch,
      sus: patch.sus,
    });
  }
  if (patch.add != null && patch.add !== spec.add) {
    return normalizeChordSpec({
      ...applyAdd(spec, patch.add),
      ...patch,
      add: patch.add,
    });
  }
  return normalizeChordSpec({ ...spec, ...patch });
}
