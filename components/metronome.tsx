"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TIME_SIGNATURES = [
  { label: "2/4", beats: 2 },
  { label: "3/4", beats: 3 },
  { label: "4/4", beats: 4 },
  { label: "5/4", beats: 5 },
  { label: "6/8", beats: 6 },
  { label: "7/8", beats: 7 },
];

const MIN_BPM = 40;
const MAX_BPM = 240;

export function Metronome() {
  const [bpm, setBpm] = useState(90);
  const [beats, setBeats] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatCounterRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  function playClick(time: number, accent: boolean) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 800;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  function scheduler() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const secondsPerBeat = 60.0 / bpmRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const beatInBar = beatCounterRef.current % beatsRef.current;
      playClick(nextNoteTimeRef.current, beatInBar === 0);
      const scheduledBeat = beatInBar;
      const delay = (nextNoteTimeRef.current - ctx.currentTime) * 1000;
      window.setTimeout(() => setCurrentBeat(scheduledBeat), Math.max(0, delay));
      nextNoteTimeRef.current += secondsPerBeat;
      beatCounterRef.current += 1;
    }
  }

  function start() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    beatCounterRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    timerRef.current = window.setInterval(scheduler, 25);
    setPlaying(true);
  }

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setCurrentBeat(-1);
  }

  function toggle() {
    if (playing) stop();
    else start();
  }

  const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, v));

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 rounded-2xl border bg-card p-8">
      {/* Indicador de batidas */}
      <div className="flex items-center gap-3">
        {Array.from({ length: beats }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full border transition-all duration-75",
              currentBeat === i
                ? i === 0
                  ? "neuma-gradient scale-125 border-transparent"
                  : "scale-125 border-transparent bg-foreground"
                : "border-border bg-transparent",
            )}
          />
        ))}
      </div>

      {/* BPM */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setBpm((v) => clampBpm(v - 1))}
            aria-label="Diminuir BPM"
          >
            <Minus className="size-4" />
          </Button>
          <div className="flex flex-col items-center">
            <span className="font-heading text-6xl font-semibold tabular-nums">
              {bpm}
            </span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              BPM
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setBpm((v) => clampBpm(v + 1))}
            aria-label="Aumentar BPM"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <Slider
        value={[bpm]}
        min={MIN_BPM}
        max={MAX_BPM}
        step={1}
        onValueChange={(v) => setBpm(Array.isArray(v) ? v[0] : v)}
        className="w-full"
      />

      <div className="flex w-full items-center justify-between gap-4">
        <Select
          value={String(beats)}
          onValueChange={(v) => setBeats(Number(v))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_SIGNATURES.map((ts) => (
              <SelectItem key={ts.label} value={String(ts.beats)}>
                {ts.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={toggle} size="lg" className="gap-2">
          {playing ? (
            <>
              <Pause className="size-4" /> Parar
            </>
          ) : (
            <>
              <Play className="size-4" /> Iniciar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
