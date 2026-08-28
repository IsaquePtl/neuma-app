import {
  chordSymbol,
  pianoVoicingNotes,
  type ChordSpec,
  type ChordToneRole,
  type GuitarFingering,
  type PianoVoicingNote,
  PIANO_KEY_COUNT,
} from "@/lib/music/chords";
import { guitarVoicingSymbol, voicingToFingering } from "@/lib/music/guitar-voicings";

export type ChordInstrument = "piano" | "guitar";

export type PianoOverridePayload = {
  notes: PianoVoicingNote[];
};

export type GuitarOverridePayload = {
  frets: number[];
  baseFret?: number;
  fretSpan?: number;
};

export type ChordOverridePayload = PianoOverridePayload | GuitarOverridePayload;

export type ChordVoicingOverrideRow = {
  instrument: ChordInstrument;
  chord_key: string;
  voicing_id: string;
  payload: ChordOverridePayload;
};

export type ChordOverrideMap = Map<string, ChordOverridePayload>;

/** `${instrument}::${chordKey}::${voicingId}` */
export function overrideStorageKey(
  instrument: ChordInstrument,
  chordKey: string,
  voicingId = "",
) {
  return `${instrument}::${chordKey}::${voicingId}`;
}

export function pianoOverrideKey(spec: ChordSpec) {
  return overrideStorageKey("piano", chordSymbol(spec));
}

export function guitarOverrideKey(spec: ChordSpec, voicingId: string) {
  return overrideStorageKey("guitar", guitarVoicingSymbol(spec), voicingId);
}

export function guitarVoicingStorageId(
  fingering: GuitarFingering,
  index: number,
) {
  return fingering.id ?? `idx:${index}`;
}

export function buildOverrideMap(rows: ChordVoicingOverrideRow[]): ChordOverrideMap {
  const map: ChordOverrideMap = new Map();
  for (const row of rows) {
    map.set(
      overrideStorageKey(row.instrument, row.chord_key, row.voicing_id),
      row.payload,
    );
  }
  return map;
}

export function defaultPianoNotes(
  spec: ChordSpec,
  startMidi: number,
): PianoVoicingNote[] {
  return pianoVoicingNotes(spec, startMidi, PIANO_KEY_COUNT);
}

export function resolvePianoNotes(
  spec: ChordSpec,
  startMidi: number,
  overrides: ChordOverrideMap,
): PianoVoicingNote[] {
  const key = pianoOverrideKey(spec);
  const override = overrides.get(key) as PianoOverridePayload | undefined;
  if (override?.notes?.length) return override.notes;
  return defaultPianoNotes(spec, startMidi);
}

export function fingeringFromOverridePayload(
  payload: GuitarOverridePayload,
  source?: GuitarFingering["source"],
  id?: string,
): GuitarFingering {
  return {
    frets: payload.frets.map((f) => (f < 0 ? null : f)),
    baseFret: payload.baseFret ?? 1,
    fretSpan: payload.fretSpan ?? 3,
    source,
    id,
  };
}

export function fingeringToOverridePayload(
  fingering: GuitarFingering,
): GuitarOverridePayload {
  return {
    frets: fingering.frets.map((f) => (f == null ? -1 : f)),
    baseFret: fingering.baseFret ?? 1,
    fretSpan: fingering.fretSpan ?? 3,
  };
}

export function resolveGuitarFingeringWithOverrides(
  spec: ChordSpec,
  defaults: GuitarFingering[],
  overrides: ChordOverrideMap,
): GuitarFingering[] {
  const chordKey = guitarVoicingSymbol(spec);
  return defaults.map((fingering, index) => {
    const voicingId = guitarVoicingStorageId(fingering, index);
    const key = overrideStorageKey("guitar", chordKey, voicingId);
    const override = overrides.get(key) as GuitarOverridePayload | undefined;
    if (!override) return fingering;
    return fingeringFromOverridePayload(
      override,
      fingering.source,
      fingering.id ?? voicingId,
    );
  });
}

export const CHORD_TONE_ROLE_LABELS: Record<ChordToneRole, string> = {
  triad: "Tríade",
  ext29: "2ª / 9ª",
  ext411: "4ª / 11ª",
  ext613: "6ª / 13ª",
  ext5: "5ª",
  ext7: "7ª",
};

export const CHORD_TONE_ROLES = Object.keys(
  CHORD_TONE_ROLE_LABELS,
) as ChordToneRole[];
