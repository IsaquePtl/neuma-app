/**
 * Guitar voicings for the chord builder.
 *
 * Convention (all arrays): index 0 = low E … index 5 = high e.
 *   -1 = muted, 0 = open, 1+ = fret number (absolute).
 *
 * Primary source: Progressions Classics Vol. 1–3 (Jeffrey Kunde) —
 * Standard Shapes CAGED grids for major/minor triads across the neck.
 * Extension/sus/dim/aug shapes are well-known open + barre forms that
 * match the same diagram language (only included when pitch-correct).
 */

import {
  chordSymbol,
  findGuitarFingering,
  noteIndex,
  type ChordSpec,
  type GuitarFingering,
  type NoteName,
} from "@/lib/music/chords";

export type GuitarVoicing = {
  id: string;
  /** Display / lookup symbol, e.g. "C", "Am7", "Cmaj7" */
  symbol: string;
  /** Absolute frets low-E → high-e */
  frets: number[];
  /** First fret shown on diagram (1 = includes nut / open area) */
  baseFret: number;
  /** How many fret spaces to draw */
  fretSpan: number;
  source: "progressions-classics" | "standard" | "algorithmic";
  tags?: string[];
};

const ROOTS: NoteName[] = [
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
];

/** Sharp/flat aliases used when matching chord symbols. */
const ROOT_ALIASES: Record<string, NoteName> = {
  C: "C",
  "C#": "C♯",
  "C♯": "C♯",
  Db: "C♯",
  "D♭": "C♯",
  D: "D",
  "D#": "D♯",
  "D♯": "D♯",
  Eb: "D♯",
  "E♭": "D♯",
  E: "E",
  F: "F",
  "F#": "F♯",
  "F♯": "F♯",
  Gb: "F♯",
  "G♭": "F♯",
  G: "G",
  "G#": "G♯",
  "G♯": "G♯",
  Ab: "G♯",
  "A♭": "G♯",
  A: "A",
  "A#": "A♯",
  "A♯": "A♯",
  Bb: "A♯",
  "B♭": "A♯",
  B: "B",
};

function pc(n: number) {
  return ((n % 12) + 12) % 12;
}

function clampShape(frets: number[]): number[] | null {
  if (frets.some((f) => f < -1 || f > 17)) return null;
  if (frets.filter((f) => f >= 0).length < 3) return null;
  return frets;
}

function diagramMeta(frets: number[]): { baseFret: number; fretSpan: number } {
  const played = frets.filter((f) => f > 0);
  if (!played.length) return { baseFret: 1, fretSpan: 3 };
  const minF = Math.min(...played);
  const maxF = Math.max(...played);
  const atNut = frets.some((f) => f === 0) || minF <= 1;
  if (atNut) {
    return { baseFret: 1, fretSpan: Math.max(3, maxF) };
  }
  const span = Math.max(3, maxF - minF + 1);
  return { baseFret: minF, fretSpan: span };
}

type Template = {
  id: string;
  /** Suffix after root in symbol: "", "m", "7", "maj7", "m7", … */
  suffix: string;
  source: GuitarVoicing["source"];
  tags: string[];
  /** Build absolute fret patterns for root pitch-class 0–11 */
  build: (rootPc: number) => (number[] | null)[];
};

/** All frets on a string where the pitch matches rootPc. */
function rootFretsOnString(rootPc: number, openPc: number, min = 0, max = 12) {
  const out: number[] = [];
  for (let f = min; f <= max; f += 1) {
    if (pc(openPc + f) === rootPc) out.push(f);
  }
  return out;
}

/** @deprecated prefer rootFretsOnString — kept for call-site clarity */
function rootFretOnString(rootPc: number, openPc: number, min = 0, max = 12) {
  return rootFretsOnString(rootPc, openPc, min, max)[0] ?? null;
}

const OPEN_E = 4;
const OPEN_A = 9;
const OPEN_D = 2;
const OPEN_G = 7;
const OPEN_B = 11;

/**
 * CAGED + open shapes from Progressions Classics Standard Shapes pages
 * (major / minor), plus verified extension shapes.
 */
const TEMPLATES: Template[] = [
  // ── Major (Progressions Classics / CAGED) ──────────────────────────
  {
    id: "maj-E-barre",
    suffix: "",
    source: "progressions-classics",
    tags: ["E-shape", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 1, 12).map((R) => clampShape([R, R + 2, R + 2, R + 1, R, R]));
    },
  },
  {
    id: "maj-A-barre",
    suffix: "",
    source: "progressions-classics",
    tags: ["A-shape", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 1, 12).map((R) => clampShape([-1, R, R + 2, R + 2, R + 2, R]));
    },
  },
  {
    id: "maj-D-shape",
    suffix: "",
    source: "progressions-classics",
    tags: ["D-shape"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R + 3, R + 2]));
    },
  },
  {
    id: "maj-C-shape",
    suffix: "",
    source: "progressions-classics",
    tags: ["C-shape"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 3, 14).map((R) => clampShape([-1, R, R - 1, R - 3, R - 2, R - 3]));
    },
  },
  {
    id: "maj-G-shape",
    suffix: "",
    source: "progressions-classics",
    tags: ["G-shape"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 3, 14).map((R) => clampShape([R, R - 1, R - 3, R - 3, R - 3, R]));
    },
  },
  {
    id: "maj-high-triad",
    suffix: "",
    source: "progressions-classics",
    tags: ["triad", "high"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R, R, R + 3]));
    },
  },

  // ── Minor (Progressions Classics / CAGED) ──────────────────────────
  {
    id: "min-Em-barre",
    suffix: "m",
    source: "progressions-classics",
    tags: ["Em-shape", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 2, R + 2, R, R, R]));
    },
  },
  {
    id: "min-Am-barre",
    suffix: "m",
    source: "progressions-classics",
    tags: ["Am-shape", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R + 2, R + 1, R]));
    },
  },
  {
    id: "min-Dm-shape",
    suffix: "m",
    source: "progressions-classics",
    tags: ["Dm-shape"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R + 3, R + 1]));
    },
  },
  {
    id: "min-partial-Am",
    suffix: "m",
    source: "progressions-classics",
    tags: ["Am-shape", "partial"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R + 2, R + 1, -1]));
    },
  },
  {
    id: "min-book-cluster",
    suffix: "m",
    source: "progressions-classics",
    tags: ["triad", "cluster"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R + 3, R + 1]));
    },
  },

  // ── Dominant 7 ─────────────────────────────────────────────────────
  {
    id: "dom7-E-shape",
    suffix: "7",
    source: "standard",
    tags: ["E-shape", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 2, R, R + 1, R, R]));
    },
  },
  {
    id: "dom7-A-shape",
    suffix: "7",
    source: "standard",
    tags: ["A-shape"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R, R + 2, R]));
    },
  },
  {
    id: "dom7-D-shape",
    suffix: "7",
    source: "standard",
    tags: ["D-shape"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R, R + 2]));
    },
  },

  // ── Major 7 ────────────────────────────────────────────────────────
  {
    id: "maj7-E-shape",
    suffix: "maj7",
    source: "standard",
    tags: ["E-shape", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 2, R + 1, R + 1, R, R]));
    },
  },
  {
    id: "maj7-A-shape",
    suffix: "maj7",
    source: "standard",
    tags: ["A-shape"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R + 1, R + 2, R]));
    },
  },
  {
    id: "maj7-D-shape",
    suffix: "maj7",
    source: "standard",
    tags: ["D-shape"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R + 2, R + 2]));
    },
  },

  // ── Minor 7 ────────────────────────────────────────────────────────
  {
    id: "m7-Em-shape",
    suffix: "m7",
    source: "standard",
    tags: ["Em-shape", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 2, R + 2, R, R + 3, R]));
    },
  },
  {
    id: "m7-Am-shape",
    suffix: "m7",
    source: "standard",
    tags: ["Am-shape"],
    build: (r) => {
      // b7 on G string (open Am7 = x02010 pattern)
      return rootFretsOnString(r, OPEN_A, 0, 12).map((R) =>
        clampShape([-1, R, R + 2, R, R + 1, R]),
      );
    },
  },
  {
    id: "m7-Dm-shape",
    suffix: "m7",
    source: "standard",
    tags: ["Dm-shape"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R + 1, R + 1]));
    },
  },

  // ── Half-diminished m7♭5 ───────────────────────────────────────────
  {
    id: "m7b5-shape",
    suffix: "m7b5",
    source: "standard",
    tags: ["m7b5"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 1, R + 2, R + 1, -1]));
    },
  },
  {
    id: "m7b5-D-shape",
    suffix: "m7b5",
    source: "standard",
    tags: ["m7b5"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 1, R + 3, R + 1]));
    },
  },

  // ── Diminished 7 / dim triad ───────────────────────────────────────
  {
    id: "dim-triad",
    suffix: "dim",
    source: "standard",
    tags: ["dim"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 1, R + 2, R + 1, -1]));
    },
  },
  {
    id: "dim7",
    suffix: "dim7",
    source: "standard",
    tags: ["dim7"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 1, R + 2, R, -1]));
    },
  },
  {
    id: "dim7-D",
    suffix: "dim7",
    source: "standard",
    tags: ["dim7"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 1, R + 3, R + 1]));
    },
  },

  // ── Augmented ──────────────────────────────────────────────────────
  {
    id: "aug-E-shape",
    suffix: "aug",
    source: "standard",
    tags: ["aug"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 3, R + 2, R + 1, R + 1, R]));
    },
  },
  {
    id: "aug-triad",
    suffix: "aug",
    source: "standard",
    tags: ["aug"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 3, R + 2, R + 2, R + 1]));
    },
  },

  // ── Sus ────────────────────────────────────────────────────────────
  {
    id: "sus2-A-shape",
    suffix: "sus2",
    source: "standard",
    tags: ["sus2"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R + 2, R, R]));
    },
  },
  {
    id: "sus2-D-shape",
    suffix: "sus2",
    source: "standard",
    tags: ["sus2"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R + 3, R]));
    },
  },
  {
    id: "sus4-E-shape",
    suffix: "sus4",
    source: "standard",
    tags: ["sus4", "barre"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 2, R + 2, R + 2, R, R]));
    },
  },
  {
    id: "sus4-A-shape",
    suffix: "sus4",
    source: "standard",
    tags: ["sus4"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R + 2, R + 3, R]));
    },
  },
  {
    id: "sus4-D-shape",
    suffix: "sus4",
    source: "standard",
    tags: ["sus4"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_D, 0, 12).map((R) => clampShape([-1, -1, R, R + 2, R + 3, R + 3]));
    },
  },

  // ── add9 ───────────────────────────────────────────────────────────
  {
    id: "add9-E-shape",
    suffix: "add9",
    source: "standard",
    tags: ["add9"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 2, R + 2, R + 1, R, R + 2]));
    },
  },
  {
    id: "add9-A-shape",
    suffix: "add9",
    source: "standard",
    tags: ["add9"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R + 2, R + 2, R + 2]));
    },
  },

  // ── Dominant / major 9 (shell) ─────────────────────────────────────
  {
    id: "dom9-E-shape",
    suffix: "9",
    source: "standard",
    tags: ["9"],
    build: (r) => {
    return rootFretsOnString(r, OPEN_E, 0, 12).map((R) => clampShape([R, R + 2, R, R + 1, R, R + 2]));
    },
  },
  {
    id: "maj9-A-shape",
    suffix: "maj9",
    source: "standard",
    tags: ["maj9"],
    build: (r) => {
      return rootFretsOnString(r, OPEN_A, 0, 12).map((R) => clampShape([-1, R, R + 2, R + 1, R + 2, R + 2]));
    },
  },
];

/** Open-position shapes that don't transpose cleanly via CAGED root frets. */
const OPEN_SHAPES: { symbol: string; frets: number[]; tags: string[] }[] = [
  { symbol: "C", frets: [-1, 3, 2, 0, 1, 0], tags: ["open"] },
  { symbol: "D", frets: [-1, -1, 0, 2, 3, 2], tags: ["open"] },
  { symbol: "E", frets: [0, 2, 2, 1, 0, 0], tags: ["open"] },
  { symbol: "F", frets: [1, 3, 3, 2, 1, 1], tags: ["open", "barre"] },
  { symbol: "G", frets: [3, 2, 0, 0, 0, 3], tags: ["open"] },
  { symbol: "A", frets: [-1, 0, 2, 2, 2, 0], tags: ["open"] },
  { symbol: "B", frets: [-1, 2, 4, 4, 4, 2], tags: ["open", "barre"] },
  { symbol: "Cm", frets: [-1, 3, 5, 5, 4, 3], tags: ["open", "barre"] },
  { symbol: "Dm", frets: [-1, -1, 0, 2, 3, 1], tags: ["open"] },
  { symbol: "Em", frets: [0, 2, 2, 0, 0, 0], tags: ["open"] },
  { symbol: "Fm", frets: [1, 3, 3, 1, 1, 1], tags: ["open", "barre"] },
  { symbol: "Gm", frets: [3, 5, 5, 3, 3, 3], tags: ["open", "barre"] },
  { symbol: "Am", frets: [-1, 0, 2, 2, 1, 0], tags: ["open"] },
  { symbol: "Bm", frets: [-1, 2, 4, 4, 3, 2], tags: ["open", "barre"] },
  { symbol: "C7", frets: [-1, 3, 2, 3, 1, 0], tags: ["open"] },
  { symbol: "D7", frets: [-1, -1, 0, 2, 1, 2], tags: ["open"] },
  { symbol: "E7", frets: [0, 2, 0, 1, 0, 0], tags: ["open"] },
  { symbol: "G7", frets: [3, 2, 0, 0, 0, 1], tags: ["open"] },
  { symbol: "A7", frets: [-1, 0, 2, 0, 2, 0], tags: ["open"] },
  { symbol: "B7", frets: [-1, 2, 1, 2, 0, 2], tags: ["open"] },
  { symbol: "Cmaj7", frets: [-1, 3, 2, 0, 0, 0], tags: ["open"] },
  { symbol: "Dmaj7", frets: [-1, -1, 0, 2, 2, 2], tags: ["open"] },
  { symbol: "Fmaj7", frets: [-1, -1, 3, 2, 1, 0], tags: ["open"] },
  { symbol: "Amaj7", frets: [-1, 0, 2, 1, 2, 0], tags: ["open"] },
  { symbol: "Am7", frets: [-1, 0, 2, 0, 1, 0], tags: ["open"] },
  { symbol: "Dm7", frets: [-1, -1, 0, 2, 1, 1], tags: ["open"] },
  { symbol: "Em7", frets: [0, 2, 2, 0, 3, 0], tags: ["open"] },
  { symbol: "Csus2", frets: [-1, 3, 0, 0, 1, 3], tags: ["open"] },
  { symbol: "Csus4", frets: [-1, 3, 3, 0, 1, 1], tags: ["open"] },
  { symbol: "Dsus2", frets: [-1, -1, 0, 2, 3, 0], tags: ["open"] },
  { symbol: "Dsus4", frets: [-1, -1, 0, 2, 3, 3], tags: ["open"] },
  { symbol: "Asus2", frets: [-1, 0, 2, 2, 0, 0], tags: ["open"] },
  { symbol: "Asus4", frets: [-1, 0, 2, 2, 3, 0], tags: ["open"] },
  { symbol: "Esus4", frets: [0, 2, 2, 2, 0, 0], tags: ["open"] },
  { symbol: "Cadd9", frets: [-1, 3, 2, 0, 3, 0], tags: ["open"] },
  { symbol: "Gadd9", frets: [3, 2, 0, 2, 0, 3], tags: ["open"] },
];

function symbolForRoot(root: NoteName, suffix: string) {
  return `${root}${suffix}`;
}

function normalizeLookupSymbol(raw: string): string {
  const s = raw.replace(/♭/g, "b").replace(/♯/g, "#").trim();
  const m = s.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!m) return s;
  const root = ROOT_ALIASES[m[1]] ?? (m[1] as NoteName);
  let suf = m[2]
    .replace(/^maj7$/, "maj7")
    .replace(/^M7$/, "maj7")
    .replace(/^Δ7?$/, "maj7")
    .replace(/^min7$/, "m7")
    .replace(/^mi7$/, "m7")
    .replace(/^m7b5$/, "m7b5")
    .replace(/^ø7?$/, "m7b5")
    .replace(/^°7$/, "dim7")
    .replace(/^dim7$/, "dim7")
    .replace(/^\+$/, "aug");
  return `${root}${suf}`;
}

function buildCatalog(): Map<string, GuitarVoicing[]> {
  const map = new Map<string, GuitarVoicing[]>();
  const push = (v: GuitarVoicing) => {
    const key = normalizeLookupSymbol(v.symbol);
    const list = map.get(key) ?? [];
    // dedupe identical fret patterns
    if (list.some((x) => x.frets.join(",") === v.frets.join(","))) return;
    list.push(v);
    map.set(key, list);
  };

  for (const open of OPEN_SHAPES) {
    const meta = diagramMeta(open.frets);
    push({
      id: `open-${open.symbol}`,
      symbol: normalizeLookupSymbol(open.symbol),
      frets: open.frets,
      ...meta,
      source: open.tags.includes("open")
        ? "progressions-classics"
        : "standard",
      tags: open.tags,
    });
  }

  for (const root of ROOTS) {
    const rootPc = noteIndex(root);
    for (const t of TEMPLATES) {
      const shapes = t.build(rootPc);
      shapes.forEach((frets, i) => {
        if (!frets) return;
        const symbol = symbolForRoot(root, t.suffix);
        const meta = diagramMeta(frets);
        push({
          id: `${t.id}-${root}${i ? `-${i}` : ""}`,
          symbol: normalizeLookupSymbol(symbol),
          frets,
          ...meta,
          source: t.source,
          tags: t.tags,
        });
      });
    }
  }

  // Prefer open / lower frets first within each symbol
  for (const [k, list] of map) {
    list.sort((a, b) => {
      const score = (v: GuitarVoicing) => {
        const played = v.frets.filter((f) => f >= 0);
        const max = Math.max(0, ...played);
        const openBonus = v.frets.includes(0) ? -20 : 0;
        return max + openBonus + (v.source === "progressions-classics" ? -5 : 0);
      };
      return score(a) - score(b);
    });
    map.set(k, list);
  }

  return map;
}

const CATALOG = buildCatalog();

/** Map builder ChordSpec → dataset symbol key. */
export function guitarVoicingSymbol(spec: ChordSpec): string {
  // Prefer chordSymbol, then normalise accidentals / aliases
  const raw = chordSymbol(spec);
  let key = normalizeLookupSymbol(raw);

  // dim7 / m7b5 — chordSymbol already emits these; keep aliases for safety
  if (
    spec.quality === "dim" &&
    spec.extensions.includes(7) &&
    spec.sus === "none" &&
    !spec.add &&
    !spec.extensions.some((e) => e >= 9)
  ) {
    key = normalizeLookupSymbol(
      spec.majSeventh ? `${spec.root}m7b5` : `${spec.root}dim7`,
    );
  }

  // maj9 / 9 from extensions
  if (
    spec.extensions.includes(9) &&
    !spec.add &&
    spec.sus === "none" &&
    spec.quality !== "dim"
  ) {
    if (spec.majSeventh) {
      key = normalizeLookupSymbol(
        `${spec.root}${spec.quality === "minor" ? "m" : ""}maj9`,
      );
      if (spec.quality === "minor") {
        key = normalizeLookupSymbol(`${spec.root}m9`);
      }
    } else if (spec.quality === "major") {
      key = normalizeLookupSymbol(`${spec.root}9`);
    } else if (spec.quality === "minor") {
      key = normalizeLookupSymbol(`${spec.root}m9`);
    }
  }

  return key;
}

export function lookupGuitarVoicings(spec: ChordSpec): GuitarVoicing[] {
  const key = guitarVoicingSymbol(spec);
  return CATALOG.get(key) ?? [];
}

/** Absolute frets (-1 mute) → fingering used by the diagram (null mute). */
export function voicingToFingering(v: GuitarVoicing): GuitarFingering {
  return {
    frets: v.frets.map((f) => (f < 0 ? null : f)),
    baseFret: v.baseFret,
    fretSpan: v.fretSpan,
    source: v.source,
    id: v.id,
  };
}

/**
 * Book/standard voicings for the chord, or a single algorithmic fallback.
 */
export function resolveGuitarVoicings(spec: ChordSpec): GuitarFingering[] {
  const found = lookupGuitarVoicings(spec);
  if (found.length) return found.map(voicingToFingering);
  return [findGuitarFingering(spec, 5)];
}

export function guitarVoicingStats() {
  let total = 0;
  const bySuffix = new Map<string, number>();
  for (const [sym, list] of CATALOG) {
    total += list.length;
    const suf = sym.replace(/^[A-G][♯#]?/, "") || "(maj)";
    bySuffix.set(suf, (bySuffix.get(suf) ?? 0) + list.length);
  }
  return { symbols: CATALOG.size, voicings: total, bySuffix };
}
