/** Teoria e voicings para os construtores de acordes. */

export const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

export type ChordQuality = "major" | "minor" | "dim" | "aug";
export type SusKind = "none" | "sus2" | "sus4";

/** Graus de extensão seleccionáveis no menu. */
export const EXTENSION_DEGREES = [2, 4, 5, 6, 7, 9, 11, 13] as const;
export type ExtensionDegree = (typeof EXTENSION_DEGREES)[number];

export type ChordSpec = {
  root: NoteName;
  quality: ChordQuality;
  sus: SusKind;
  /** Extensões activas (graus). */
  extensions: ExtensionDegree[];
  /** true = add (ex.: Cadd9); false = acorde completo (ex.: C9 implica 7). */
  add: boolean;
  /** 7ª maior (Δ) em vez de dominante. */
  majSeventh: boolean;
};

export const DEFAULT_CHORD_SPEC: ChordSpec = {
  root: "C",
  quality: "major",
  sus: "none",
  extensions: [],
  add: false,
  majSeventh: false,
};

/** Papel da nota no acorde (para cor no piano). */
export type ChordToneRole =
  | "triad"
  | "ext29"
  | "ext411"
  | "ext613"
  | "ext5"
  | "ext7";

/** Semitom do grau diatónico (base maior). */
function degreeToSemitone(
  degree: number,
  quality: ChordQuality,
  majSeventh: boolean,
): number {
  const majorMap: Record<number, number> = {
    1: 0,
    2: 2,
    3: 4,
    4: 5,
    5: 7,
    6: 9,
    7: 11,
    8: 12,
    9: 14,
    10: 16,
    11: 17,
    12: 19,
    13: 21,
  };

  let st = majorMap[degree] ?? 0;

  if (degree === 3 && (quality === "minor" || quality === "dim")) st = 3;
  if (degree === 5 && quality === "dim") st = 6;
  if (degree === 5 && quality === "aug") st = 8;
  if (degree === 7) {
    // Dim: majSeventh=false → dim7 (bb7); true → meio-diminuto m7b5 (b7)
    if (quality === "dim") st = majSeventh ? 10 : 9;
    else st = majSeventh ? 11 : 10;
  }
  if (degree === 10) st = quality === "minor" || quality === "dim" ? 15 : 16;

  return st;
}

function pc(semitone: number) {
  return ((semitone % 12) + 12) % 12;
}

function extensionRoleForDegree(degree: number): ChordToneRole {
  const mod = ((degree - 1) % 7) + 1;
  if (mod === 2) return "ext29";
  if (mod === 4) return "ext411";
  if (mod === 6) return "ext613";
  if (mod === 5) return "ext5";
  if (mod === 7) return "ext7";
  return "ext7";
}

/** Extensões efectivamente usadas (inclui 7/9 implícitos quando não é add). */
function resolvedExtensions(spec: ChordSpec): Set<number> {
  const exts = new Set<number>(spec.extensions);

  if (
    !spec.add &&
    (exts.has(9) || exts.has(11) || exts.has(13)) &&
    !exts.has(7)
  ) {
    exts.add(7);
  }

  if (!spec.add && exts.has(13) && !exts.has(9)) exts.add(9);

  return exts;
}

/**
 * Intervalos em semitons a partir da tónica (podem > 12).
 * Ordem: raiz, estrutura da tríade/sus, depois extensões.
 */
export function chordIntervals(spec: ChordSpec): number[] {
  const out = new Set<number>([0]);

  if (spec.sus === "sus2") {
    out.add(2);
  } else if (spec.sus === "sus4") {
    out.add(5);
  } else if (spec.quality === "major" || spec.quality === "aug") {
    out.add(4);
  } else {
    out.add(3);
  }

  if (spec.quality === "dim") out.add(6);
  else if (spec.quality === "aug") out.add(8);
  else out.add(7);

  const exts = resolvedExtensions(spec);

  for (const deg of exts) {
    // Graus 3 e 5 já vêm da tríade; toggle só reforça / não remove.
    if (deg === 3 && spec.sus !== "none") continue;
    out.add(degreeToSemitone(deg, spec.quality, spec.majSeventh));
  }

  return [...out].sort((a, b) => a - b);
}

/**
 * Intervalo → papel (tríade tem prioridade sobre extensão no mesmo semitom).
 */
export function chordIntervalRoles(spec: ChordSpec): Map<number, ChordToneRole> {
  const roles = new Map<number, ChordToneRole>();

  roles.set(0, "triad");

  if (spec.sus === "sus2") {
    roles.set(2, "triad");
  } else if (spec.sus === "sus4") {
    roles.set(5, "triad");
  } else if (spec.quality === "major" || spec.quality === "aug") {
    roles.set(4, "triad");
  } else {
    roles.set(3, "triad");
  }

  if (spec.quality === "dim") roles.set(6, "triad");
  else if (spec.quality === "aug") roles.set(8, "triad");
  else roles.set(7, "triad");

  for (const deg of resolvedExtensions(spec)) {
    if (deg === 3 && spec.sus !== "none") continue;
    const st = degreeToSemitone(deg, spec.quality, spec.majSeventh);
    if (!roles.has(st)) {
      roles.set(st, extensionRoleForDegree(deg));
    }
  }

  return roles;
}

export function chordPitchClasses(spec: ChordSpec): number[] {
  return [...new Set(chordIntervals(spec).map(pc))].sort((a, b) => a - b);
}

export function noteIndex(note: NoteName): number {
  return NOTE_NAMES.indexOf(note);
}

export function chordSymbol(spec: ChordSpec): string {
  const root = spec.root;
  const exts = [...spec.extensions].sort((a, b) => a - b);
  const has7 = exts.includes(7) || (!spec.add && exts.some((e) => e >= 9));
  const highTop =
    exts.filter((e) => e >= 9).sort((a, b) => b - a)[0] ?? null;
  const lowTop =
    exts.filter((e) => e === 6 || e === 2 || e === 4 || e === 5)[0] ?? null;

  // Dim7 (bb7) / m7b5 — nomes dedicados para o catálogo de guitarra
  if (
    spec.sus === "none" &&
    spec.quality === "dim" &&
    has7 &&
    !spec.add &&
    highTop == null
  ) {
    return spec.majSeventh ? `${root}m7b5` : `${root}dim7`;
  }

  // Aum + maj7 → maj7#5 (mais legível que “augmaj7”)
  if (
    spec.sus === "none" &&
    spec.quality === "aug" &&
    has7 &&
    spec.majSeventh &&
    !spec.add &&
    highTop == null
  ) {
    return `${root}maj7#5`;
  }

  let quality = "";
  if (spec.sus === "sus2") quality = "sus2";
  else if (spec.sus === "sus4") quality = "sus4";
  else if (spec.quality === "minor") quality = "m";
  else if (spec.quality === "dim") quality = "dim";
  else if (spec.quality === "aug") quality = "aug";

  const top = highTop ?? (has7 ? 7 : null) ?? lowTop;

  let ext = "";
  if (spec.add && top != null) {
    ext = `add${top}`;
  } else if (top != null) {
    if (top === 7 && spec.majSeventh) ext = "maj7";
    else if (top === 7) ext = "7";
    else if (spec.majSeventh && top > 7) ext = `maj${top}`;
    else ext = String(top);
  } else if (exts.includes(6)) {
    ext = spec.add ? "add6" : "6";
  } else if (exts.includes(2) || exts.includes(4)) {
    const d = exts.includes(2) ? 2 : 4;
    ext = spec.add ? `add${d}` : String(d);
  }

  // Evitar "msus" — sus substitui qualidade menor/maior.
  if (spec.sus !== "none") {
    return `${root}${quality}${ext && !ext.startsWith("sus") ? ext : ""}`;
  }
  return `${root}${quality}${ext}`;
}

/** Afinação standard, corda grave → aguda (índices 0..5). */
export const GUITAR_OPEN_PCS = [4, 9, 2, 7, 11, 4]; // E A D G B E
export const GUITAR_STRING_LABELS = ["E", "A", "D", "G", "B", "e"];

export type GuitarFingering = {
  /** fret por corda (0=solta, null=abafada), índice 0 = Mi grave */
  frets: (number | null)[];
  /** Primeira casa do diagrama (1 = pestana / zona aberta). */
  baseFret?: number;
  /** Quantas casas desenhar. */
  fretSpan?: number;
  source?: "progressions-classics" | "standard" | "algorithmic";
  id?: string;
};

/**
 * Escolhe um voicing nas primeiras `maxFret` casas.
 * Preferência: inclui tónica, 3ª e 5ª; poucas cordas abafadas; baixo com raiz.
 */
export function findGuitarFingering(
  spec: ChordSpec,
  maxFret = 3,
): GuitarFingering {
  const pcs = new Set(chordPitchClasses(spec));
  const rootPc = noteIndex(spec.root);
  const thirdPc =
    spec.sus === "sus2"
      ? pc(rootPc + 2)
      : spec.sus === "sus4"
        ? pc(rootPc + 5)
        : spec.quality === "minor" || spec.quality === "dim"
          ? pc(rootPc + 3)
          : pc(rootPc + 4);
  const fifthPc =
    spec.quality === "dim"
      ? pc(rootPc + 6)
      : spec.quality === "aug"
        ? pc(rootPc + 8)
        : pc(rootPc + 7);

  type Option = { fret: number; pc: number };
  const optionsPerString: Option[][] = GUITAR_OPEN_PCS.map((open) => {
    const opts: Option[] = [];
    for (let f = 0; f <= maxFret; f += 1) {
      const p = pc(open + f);
      if (pcs.has(p)) opts.push({ fret: f, pc: p });
    }
    return opts;
  });

  let bestFrets: (number | null)[] | undefined;
  let bestScore = -Infinity;

  function search(stringIdx: number, chosen: (number | null)[]) {
    if (stringIdx === 6) {
      const active = chosen
        .map((f, i) =>
          f == null ? null : { fret: f, pc: pc(GUITAR_OPEN_PCS[i] + f) },
        )
        .filter(Boolean) as { fret: number; pc: number }[];

      if (active.length < 3) return;

      const played = new Set(active.map((a) => a.pc));
      let score = active.length * 4;
      if (played.has(rootPc)) score += 12;
      if (played.has(thirdPc)) score += 8;
      if (played.has(fifthPc)) score += 6;
      // Baixo com raiz
      const lowest = chosen.findIndex((f) => f != null);
      if (
        lowest >= 0 &&
        pc(GUITAR_OPEN_PCS[lowest] + (chosen[lowest] as number)) === rootPc
      ) {
        score += 10;
      }
      // Preferir cordas soltas e shapes compactos
      score -= active.reduce((s, a) => s + a.fret, 0) * 0.3;
      const fretted = active.filter((a) => a.fret > 0).map((a) => a.fret);
      if (fretted.length) {
        score -= (Math.max(...fretted) - Math.min(...fretted)) * 0.5;
      }
      // Penalizar abafadas no meio
      let mutedGaps = 0;
      let seen = false;
      for (const f of chosen) {
        if (f != null) seen = true;
        else if (seen) mutedGaps += 1;
      }
      score -= mutedGaps * 2;

      if (score > bestScore) {
        bestScore = score;
        bestFrets = [...chosen];
      }
      return;
    }

    // Opção abafar
    search(stringIdx + 1, [...chosen, null]);
    for (const opt of optionsPerString[stringIdx]) {
      search(stringIdx + 1, [...chosen, opt.fret]);
    }
  }

  search(0, []);

  if (bestFrets) {
    const played = bestFrets.filter((f): f is number => f != null && f > 0);
    const max = played.length ? Math.max(...played) : 3;
    return {
      frets: bestFrets,
      baseFret: 1,
      fretSpan: Math.max(3, max),
      source: "algorithmic",
    };
  }

  // Fallback: em cada corda, primeira casa possível (ou mute)
  return {
    frets: optionsPerString.map((opts) => (opts[0] ? opts[0].fret : null)),
    baseFret: 1,
    fretSpan: maxFret,
    source: "algorithmic",
  };
}

/** Teclas de piano: duas oitavas a partir de C (25 teclas, C→C). */
export const PIANO_KEY_COUNT = 25;

export function pianoKeyMidi(startMidi: number, index: number) {
  return startMidi + index;
}

export function isBlackKey(midi: number) {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

export function isChordToneMidi(midi: number, spec: ChordSpec) {
  const pcs = chordPitchClasses(spec);
  return pcs.includes(pc(midi));
}

export function isRootMidi(midi: number, spec: ChordSpec) {
  return pc(midi) === noteIndex(spec.root);
}

export type PianoVoicingNote = {
  midi: number;
  role: ChordToneRole;
  interval: number;
};

/**
 * Um único voicing (mão) dentro do teclado de duas oitavas.
 * Coloca a tónica o mais grave possível desde que o voicing caiba no range.
 */
export function pianoVoicingNotes(
  spec: ChordSpec,
  startMidi: number,
  keyCount: number = PIANO_KEY_COUNT,
): PianoVoicingNote[] {
  const intervals = chordIntervals(spec);
  const roles = chordIntervalRoles(spec);
  const rootPc = noteIndex(spec.root);
  const endMidi = startMidi + keyCount - 1;
  const maxInterval = Math.max(...intervals, 0);

  const rootCandidates: number[] = [];
  for (let m = startMidi; m <= endMidi; m += 1) {
    if (pc(m) === rootPc) rootCandidates.push(m);
  }

  let rootMidi = rootCandidates[0] ?? startMidi;
  for (const candidate of rootCandidates) {
    if (candidate + maxInterval <= endMidi) {
      rootMidi = candidate;
      break;
    }
  }

  return intervals
    .map((interval) => {
      const midi = rootMidi + interval;
      if (midi < startMidi || midi > endMidi) return null;
      return {
        midi,
        interval,
        role: roles.get(interval) ?? "triad",
      };
    })
    .filter(Boolean) as PianoVoicingNote[];
}
