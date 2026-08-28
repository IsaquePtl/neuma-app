"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import {
  ChordNoteEditorDialog,
  type ChordNoteEditorState,
} from "@/components/chord-note-editor-dialog";
import { ChordBuilderControls } from "@/components/chord-builder-controls";
import { brandAssets } from "@/lib/brand";
import {
  defaultPianoNotes,
  resolvePianoNotes,
  type ChordOverrideMap,
  type PianoOverridePayload,
} from "@/lib/music/chord-overrides";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CHORD_SPEC,
  PIANO_KEY_COUNT,
  chordSymbol,
  isBlackKey,
  type ChordSpec,
  type ChordToneRole,
  type PianoVoicingNote,
} from "@/lib/music/chords";

/** C3 → C5 (duas oitavas + C final). */
const START_MIDI = 48;

/** Cores por papel: tríade coral; extensões em azuis distintos (2/9, 4/11, 6/13, 5, 7). */
const ROLE_COLORS: Record<ChordToneRole, string> = {
  triad: "var(--neuma-coral)",
  ext29: "var(--neuma-blue)",
  ext411: "#5eb0ff",
  ext613: "#0a5cb8",
  ext5: "#3d9fd9",
  ext7: "#3b82f6",
};

type PianoChordBuilderProps = {
  editMode?: boolean;
  overrides?: ChordOverrideMap;
  onOverrideChange?: (spec: ChordSpec, payload: PianoOverridePayload) => void;
};

export function PianoChordBuilder({
  editMode = false,
  overrides,
  onOverrideChange,
}: PianoChordBuilderProps) {
  const [spec, setSpec] = useState<ChordSpec>(DEFAULT_CHORD_SPEC);
  const [editorState, setEditorState] = useState<ChordNoteEditorState | null>(
    null,
  );
  const [editorOpen, setEditorOpen] = useState(false);

  const notes = useMemo(() => {
    if (overrides) return resolvePianoNotes(spec, START_MIDI, overrides);
    return defaultPianoNotes(spec, START_MIDI);
  }, [spec, overrides]);

  const voicingByMidi = useMemo(
    () => new Map(notes.map((n) => [n.midi, n])),
    [notes],
  );

  const keys = useMemo(
    () =>
      Array.from({ length: PIANO_KEY_COUNT }, (_, i) => {
        const midi = START_MIDI + i;
        const tone = voicingByMidi.get(midi);
        return {
          midi,
          black: isBlackKey(midi),
          active: Boolean(tone),
          role: tone?.role ?? null,
          root: tone?.interval === 0,
        };
      }),
    [voicingByMidi],
  );

  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);

  /** Posição horizontal das pretas relativa às brancas (índice white). */
  function blackLeftPercent(midi: number) {
    const whiteBefore = keys.filter((k) => k.midi < midi && !k.black).length;
    const width = 100 / whites.length;
    return whiteBefore * width - width * 0.32;
  }

  function activeStyle(role: ChordToneRole | null) {
    if (!role) return undefined;
    return { backgroundColor: ROLE_COLORS[role] };
  }

  function openKeyEditor(midi: number) {
    if (!editMode) return;
    const tone = voicingByMidi.get(midi);
    setEditorState({
      kind: "piano",
      midi,
      active: Boolean(tone),
      role: tone?.role ?? "triad",
    });
    setEditorOpen(true);
  }

  function applyPianoEdit(next: ChordNoteEditorState) {
    if (next.kind !== "piano" || !onOverrideChange) return;

    const currentNotes = [...notes];
    const withoutMidi = currentNotes.filter((n) => n.midi !== next.midi);

    let nextNotes: PianoVoicingNote[];
    if (next.active) {
      const rootMidi =
        currentNotes.find((n) => n.interval === 0)?.midi ??
        currentNotes[0]?.midi ??
        START_MIDI;
      const existing = currentNotes.find((n) => n.midi === next.midi);
      nextNotes = [
        ...withoutMidi,
        {
          midi: next.midi,
          role: next.role,
          interval: existing?.interval ?? next.midi - rootMidi,
        },
      ].sort((a, b) => a.midi - b.midi);
    } else {
      nextNotes = withoutMidi;
    }

    onOverrideChange(spec, { notes: nextNotes });
  }

  const keyClasses = editMode
    ? "cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground/40"
    : "";

  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8 min-[1360px]:h-full min-[1360px]:flex-1">
      <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <Image
          src={brandAssets.iconPiano}
          alt=""
          width={22}
          height={22}
          className="size-8 opacity-80"
        />
        Construtor de acordes · Piano
        {editMode ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-700 dark:text-amber-300">
            Modo edição
          </span>
        ) : null}
      </p>

      <ChordBuilderControls
        value={spec}
        onChange={setSpec}
        showSymbol={false}
      />

      <div className="relative mx-auto flex w-full max-w-2xl min-h-0 flex-col select-none min-[1360px]:flex-1">
        <div className="mb-3 shrink-0 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Acorde
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {chordSymbol(spec)}
          </p>
        </div>

        <div className="min-[1360px]:flex min-[1360px]:flex-1 min-[1360px]:items-center min-[1360px]:justify-center">
          <div className="relative flex h-36 w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-100 sm:h-44">
            {whites.map((key) => (
              <button
                key={key.midi}
                type="button"
                disabled={!editMode}
                onClick={() => openKeyEditor(key.midi)}
                style={key.active ? activeStyle(key.role) : undefined}
                className={cn(
                  "relative h-full flex-1 border-r border-black/10 last:border-r-0",
                  !key.active && "bg-zinc-50",
                  keyClasses,
                )}
                aria-label={
                  editMode
                    ? `Editar tecla ${key.midi}`
                    : key.active
                      ? "Nota activa"
                      : "Tecla inactiva"
                }
              >
                {key.active ? (
                  <span
                    className={cn(
                      "absolute bottom-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full sm:size-2",
                      key.root ? "bg-white" : "bg-white/70",
                    )}
                  />
                ) : null}
              </button>
            ))}

            {blacks.map((key) => (
              <button
                key={key.midi}
                type="button"
                disabled={!editMode}
                onClick={() => openKeyEditor(key.midi)}
                style={{
                  left: `${blackLeftPercent(key.midi)}%`,
                  ...(key.active ? activeStyle(key.role) : undefined),
                }}
                className={cn(
                  "absolute top-0 z-10 h-[58%] w-[4.6%] rounded-b-md border border-black/40 shadow-sm",
                  !key.active && "bg-[#1a1a1a]",
                  keyClasses,
                )}
                aria-label={
                  editMode
                    ? `Editar tecla ${key.midi}`
                    : key.active
                      ? "Nota activa"
                      : "Tecla inactiva"
                }
              />
            ))}
          </div>
        </div>
      </div>

      <ChordNoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        state={editorState}
        onConfirm={applyPianoEdit}
      />
    </div>
  );
}
