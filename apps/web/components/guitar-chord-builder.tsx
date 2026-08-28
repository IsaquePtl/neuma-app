"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ChordNoteEditorDialog,
  type ChordNoteEditorState,
} from "@/components/chord-note-editor-dialog";
import { ChordBuilderControls } from "@/components/chord-builder-controls";
import { brandAssets } from "@/lib/brand";
import {
  fingeringToOverridePayload,
  guitarVoicingStorageId,
  resolveGuitarFingeringWithOverrides,
  type ChordOverrideMap,
  type GuitarOverridePayload,
} from "@/lib/music/chord-overrides";
import {
  DEFAULT_CHORD_SPEC,
  GUITAR_STRING_LABELS,
  chordSymbol,
  type ChordSpec,
  type GuitarFingering,
} from "@/lib/music/chords";
import { resolveGuitarVoicings } from "@/lib/music/guitar-voicings";

/** Cordas na UI: aguda → grave (como se lê um diagrama). */
const DISPLAY_ORDER = [5, 4, 3, 2, 1, 0];

/** Diagrama fixo: sempre 3 casas — não redimensiona por voicing. */
const FRET_SPAN = 3;
const BOARD_W = 215;
const BOARD_H = 144;
const PAD_L = 36;
const PAD_R = 10;
const PAD_T = 22;
const PAD_B = 10;
/** Faixa da pestana sempre reservada à esquerda — board mantém 215px e não desloca. */
const NUT_W = 5;
const VIEW_W = PAD_L + NUT_W + BOARD_W + PAD_R;
const VIEW_H = PAD_T + BOARD_H + PAD_B;

type GuitarChordBuilderProps = {
  editMode?: boolean;
  overrides?: ChordOverrideMap;
  onOverrideChange?: (
    spec: ChordSpec,
    voicingId: string,
    payload: GuitarOverridePayload,
  ) => void;
};

export function GuitarChordBuilder({
  editMode = false,
  overrides,
  onOverrideChange,
}: GuitarChordBuilderProps) {
  const [spec, setSpec] = useState<ChordSpec>(DEFAULT_CHORD_SPEC);
  const [voicingIndex, setVoicingIndex] = useState(0);
  const [editorState, setEditorState] = useState<ChordNoteEditorState | null>(
    null,
  );
  const [editorOpen, setEditorOpen] = useState(false);

  const defaultVoicings = useMemo(() => resolveGuitarVoicings(spec), [spec]);
  const voicings = useMemo(() => {
    if (!overrides) return defaultVoicings;
    return resolveGuitarFingeringWithOverrides(spec, defaultVoicings, overrides);
  }, [spec, defaultVoicings, overrides]);

  useEffect(() => {
    setVoicingIndex(0);
  }, [spec]);

  const safeIndex =
    voicings.length === 0
      ? 0
      : ((voicingIndex % voicings.length) + voicings.length) % voicings.length;
  const fingering = voicings[safeIndex] ?? {
    frets: [null, null, null, null, null, null],
    baseFret: 1,
    fretSpan: 3,
    source: "algorithmic" as const,
  };
  const voicingId = guitarVoicingStorageId(fingering, safeIndex);

  const total = voicings.length;
  const canNavigate = total > 1;

  function prev() {
    if (!canNavigate) return;
    setVoicingIndex((i) => (i - 1 + total) % total);
  }

  function next() {
    if (!canNavigate) return;
    setVoicingIndex((i) => (i + 1) % total);
  }

  const baseFret = fingering.baseFret ?? 1;
  const showPosition = baseFret > 0;

  function openStringEditor(stringIdx: number) {
    if (!editMode) return;
    const fret = fingering.frets[stringIdx];
    setEditorState({
      kind: "guitar",
      stringIdx,
      state: fret == null ? "muted" : fret === 0 ? "open" : "fretted",
      fret: fret != null && fret > 0 ? fret : 1,
    });
    setEditorOpen(true);
  }

  function applyGuitarEdit(next: ChordNoteEditorState) {
    if (next.kind !== "guitar" || !onOverrideChange) return;

    const nextFrets = [...fingering.frets] as (number | null)[];
    if (next.state === "muted") nextFrets[next.stringIdx] = null;
    else if (next.state === "open") nextFrets[next.stringIdx] = 0;
    else nextFrets[next.stringIdx] = next.fret;

    const nextFingering: GuitarFingering = {
      ...fingering,
      frets: nextFrets,
    };

    onOverrideChange(spec, voicingId, fingeringToOverridePayload(nextFingering));
  }

  return (
    <div className="@container flex w-full flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8 min-[1360px]:h-full min-[1360px]:flex-1">
      <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <Image
          src={brandAssets.iconGuitar}
          alt=""
          width={22}
          height={22}
          className="size-8 opacity-80"
        />
        Construtor de acordes · Guitarra
        {editMode ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-700 dark:text-amber-300">
            Modo edição
          </span>
        ) : null}
      </p>

      <div className="flex min-h-0 flex-col gap-8 @min-[32rem]:flex-row @min-[32rem]:items-start @min-[32rem]:gap-10 min-[1360px]:!flex-col min-[1360px]:!items-stretch min-[1360px]:!gap-8 min-[1360px]:flex-1">
        <div className="min-w-0 flex-1 min-[1360px]:flex-none">
          <ChordBuilderControls
            value={spec}
            onChange={setSpec}
            showSymbol={false}
          />
        </div>

        <div className="flex w-full shrink-0 flex-col items-center @min-[32rem]:w-auto min-[1360px]:!w-full min-[1360px]:flex-1 min-[1360px]:justify-center">
          <div className="mb-1 text-center">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Acorde
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {chordSymbol(spec)}
            </p>
          </div>

          <div className="flex shrink-0 select-none flex-col items-stretch px-1">
            <p
              className="flex h-7 w-full items-end justify-start text-sm text-muted-foreground"
              style={{ paddingLeft: PAD_L + NUT_W }}
            >
              {showPosition ? `${baseFret}ª casa` : "\u00a0"}
            </p>
            <GuitarNeck
              fingering={fingering}
              editMode={editMode}
              onStringClick={openStringEditor}
            />
          </div>

          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={prev}
                disabled={!canNavigate}
                aria-label="Voicing anterior"
                className="inline-flex items-center justify-center text-foreground transition-colors hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="size-5" strokeWidth={2} />
              </button>
              {total > 0 ? (
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="text-foreground">{safeIndex + 1}</span>
                  {" / "}
                  {total}
                </p>
              ) : null}
              <button
                type="button"
                onClick={next}
                disabled={!canNavigate}
                aria-label="Voicing seguinte"
                className="inline-flex items-center justify-center text-foreground transition-colors hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="size-5" strokeWidth={2} />
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {editMode
                ? "Clica numa corda ou bolinha para editar · ○ aberta · × abafada · ● dedo"
                : fingering.source === "algorithmic"
                  ? "Voicing estimado · ○ aberta · × abafada · ● dedo"
                  : "○ aberta · × abafada · ● dedo"}
            </p>
          </div>
        </div>
      </div>

      <ChordNoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        state={editorState}
        onConfirm={applyGuitarEdit}
      />
    </div>
  );
}

function GuitarNeck({
  fingering,
  editMode = false,
  onStringClick,
}: {
  fingering: GuitarFingering;
  editMode?: boolean;
  onStringClick?: (stringIdx: number) => void;
}) {
  const frets = fingering.frets;
  const baseFret = fingering.baseFret ?? 1;
  const atNut = baseFret <= 1;

  const stringCount = DISPLAY_ORDER.length;
  const nutX = PAD_L;
  const boardLeft = nutX + NUT_W;
  const boardRight = boardLeft + BOARD_W;
  const topY = PAD_T;
  const bottomY = PAD_T + BOARD_H;

  const fretIndices = Array.from({ length: FRET_SPAN }, (_, i) => i + 1);

  function stringY(row: number) {
    if (stringCount === 1) return topY + BOARD_H / 2;
    return topY + (row / (stringCount - 1)) * BOARD_H;
  }

  function fretX(absoluteFret: number) {
    const local = atNut ? absoluteFret : absoluteFret - baseFret + 1;
    const span = boardRight - boardLeft;
    return boardLeft + ((local - 0.5) / FRET_SPAN) * span;
  }

  function fretLineX(afterLocalFret: number) {
    const span = boardRight - boardLeft;
    return boardLeft + (afterLocalFret / FRET_SPAN) * span;
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={VIEW_W}
      height={VIEW_H}
      className="shrink-0"
      role="img"
      aria-label="Diagrama de acorde no braço da guitarra"
    >
      <rect
        x={boardLeft}
        y={topY}
        width={boardRight - boardLeft}
        height={BOARD_H}
        rx={2}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />

      {atNut ? (
        <rect
          x={nutX}
          y={topY - 1}
          width={NUT_W}
          height={BOARD_H + 2}
          rx={1}
          fill="rgba(255,255,255,0.55)"
        />
      ) : null}

      {fretIndices.map((local) => (
        <line
          key={`fret-${local}`}
          x1={fretLineX(local)}
          y1={topY}
          x2={fretLineX(local)}
          y2={bottomY}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={local === FRET_SPAN ? 1.25 : 1}
        />
      ))}

      {DISPLAY_ORDER.map((stringIdx, row) => {
        const fret = frets[stringIdx];
        const muted = fret == null;
        const open = fret === 0;
        const fretted = fret != null && fret > 0;
        const y = stringY(row);
        const label = GUITAR_STRING_LABELS[stringIdx];

        const inWindow =
          fretted &&
          (atNut
            ? fret >= 1 && fret <= FRET_SPAN
            : fret >= baseFret && fret < baseFret + FRET_SPAN);

        const hitX = muted || open ? boardLeft - 8 : fretted && inWindow ? fretX(fret) : boardLeft + (boardRight - boardLeft) / 2;
        const hitR = editMode ? 14 : 0;

        return (
          <g key={stringIdx}>
            <text
              x={PAD_L - 10}
              y={y + 3.5}
              textAnchor="end"
              fill="currentColor"
              opacity={0.55}
              style={{ fontSize: 10, fontWeight: 500 }}
            >
              {label}
            </text>

            <line
              x1={boardLeft}
              y1={y}
              x2={boardRight}
              y2={y}
              stroke={
                muted ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)"
              }
              strokeWidth={1 + row * 0.12}
            />

            {editMode ? (
              <circle
                cx={hitX}
                cy={y}
                r={hitR}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onStringClick?.(stringIdx)}
              />
            ) : null}

            {muted ? (
              <text
                x={boardLeft - 8}
                y={y + 4}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.55}
                style={{ fontSize: 13 }}
                className={editMode ? "cursor-pointer" : undefined}
                onClick={editMode ? () => onStringClick?.(stringIdx) : undefined}
              >
                ×
              </text>
            ) : null}

            {open ? (
              <circle
                cx={boardLeft - 8}
                cy={y}
                r={5.5}
                fill="none"
                stroke="#fff"
                strokeWidth={1.5}
                className={editMode ? "cursor-pointer" : undefined}
                onClick={editMode ? () => onStringClick?.(stringIdx) : undefined}
              />
            ) : null}

            {fretted && inWindow ? (
              <circle
                cx={fretX(fret)}
                cy={y}
                r={7}
                fill="#fff"
                className={editMode ? "cursor-pointer" : undefined}
                onClick={editMode ? () => onStringClick?.(stringIdx) : undefined}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
