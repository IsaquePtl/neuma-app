"use client";

import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NOTES = [
  "C",
  "C♯",
  "D",
  "E♭",
  "E",
  "F",
  "F♯",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
] as const;

/** Intervalos em semitons a partir da tónica (7 graus). */
const SCALES = [
  { id: "major", label: "Maior", intervals: [0, 2, 4, 5, 7, 9, 11] },
  {
    id: "minor-natural",
    label: "Menor natural",
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    id: "minor-harmonic",
    label: "Menor harmónica",
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  {
    id: "minor-melodic",
    label: "Menor melódica",
    intervals: [0, 2, 3, 5, 7, 9, 11],
  },
  { id: "dorian", label: "Dório", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "phrygian", label: "Frígio", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", label: "Lídio", intervals: [0, 2, 4, 6, 7, 9, 11] },
  {
    id: "mixolydian",
    label: "Mixolídio",
    intervals: [0, 2, 4, 5, 7, 9, 10],
  },
  { id: "locrian", label: "Lócrio", intervals: [0, 1, 3, 5, 6, 8, 10] },
] as const;

type ScaleId = (typeof SCALES)[number]["id"];

function triadQuality(scalePcs: number[], degree: number) {
  const root = scalePcs[degree];
  const third = scalePcs[(degree + 2) % 7];
  const fifth = scalePcs[(degree + 4) % 7];
  const thirdInterval = (third - root + 12) % 12;
  const fifthInterval = (fifth - root + 12) % 12;

  if (thirdInterval === 4 && fifthInterval === 7) return "";
  if (thirdInterval === 3 && fifthInterval === 7) return "m";
  if (thirdInterval === 3 && fifthInterval === 6) return "°";
  if (thirdInterval === 4 && fifthInterval === 8) return "+";
  if (thirdInterval === 3) return "m";
  if (thirdInterval === 4) return "";
  return "";
}

export function HarmonicField() {
  const [root, setRoot] = useState<(typeof NOTES)[number]>("C");
  const [scaleId, setScaleId] = useState<ScaleId>("major");

  const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0];
  const rootIndex = NOTES.indexOf(root);

  const degrees = useMemo(() => {
    const pcs = scale.intervals.map((semitone) => (rootIndex + semitone) % 12);
    return pcs.map((pc, i) => ({
      number: i + 1,
      note: NOTES[pc],
      quality: triadQuality(pcs, i),
    }));
  }, [rootIndex, scale]);

  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Tom
          </p>
          <Select
            value={root}
            onValueChange={(v) => {
              if (v && NOTES.includes(v as (typeof NOTES)[number])) {
                setRoot(v as (typeof NOTES)[number]);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{root}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {NOTES.map((note) => (
                <SelectItem key={note} value={note}>
                  {note}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Escala
          </p>
          <Select
            value={scaleId}
            onValueChange={(v) => {
              if (v && SCALES.some((s) => s.id === v)) {
                setScaleId(v as ScaleId);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{scale.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SCALES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {degrees.map((degree) => (
          <div
            key={degree.number}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.03] py-3 ring-1 ring-white/8"
          >
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {degree.number}
              {degree.quality}
            </span>
            <span
              className={cn(
                "text-base font-semibold sm:text-lg",
                degree.number === 1 && "text-[var(--neuma-coral)]",
              )}
            >
              {degree.note}
            </span>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {root} {scale.label.toLowerCase()} · 7 graus
      </p>
    </div>
  );
}
