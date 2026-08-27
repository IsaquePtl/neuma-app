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
const DEFAULT_BPM = 120;
const TAP_RESET_MS = 2000;
/** Número de intervalos recentes usados para calcular o BPM. */
const TAP_WINDOW_INTERVALS = 3;
const CLICK_URL = "/audio/Metronome.wav";
const ACCENT_URL = "/audio/MetronomeUp.wav";
/** Os WAV originais têm ~3–5s; só precisamos do ataque (~100ms). */
const CLICK_DURATION = 0.1;
const SCHEDULE_AHEAD = 0.12;

/** Tiny silent WAV (44.1kHz mono) — fallback iOS antigo p/ sessão media. */
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

/**
 * iOS muta Web Audio no switch de silêncio (sessão ambient).
 * `playback` usa o volume do media — como música / YouTube.
 */
function unlockMediaPlayback() {
  const nav = navigator as NavigatorWithAudioSession;
  if (nav.audioSession) {
    try {
      nav.audioSession.type = "playback";
    } catch {
      // Safari antigo / API experimental — segue com fallback
    }
  }
}

/** Fallback Safari < 17: elemento <audio> puxa a página para sessão media. */
function keepSilentMediaElementAlive(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) return null;

  let el = document.getElementById(
    "neuma-metronome-silent-audio",
  ) as HTMLAudioElement | null;
  if (!el) {
    el = document.createElement("audio");
    el.id = "neuma-metronome-silent-audio";
    el.setAttribute("playsinline", "true");
    el.preload = "auto";
    el.loop = true;
    el.volume = 0.01;
    el.src = SILENT_WAV_DATA_URI;
    el.style.display = "none";
    document.body.appendChild(el);
  }
  void el.play().catch(() => {});
  return el;
}

function trimBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  duration = CLICK_DURATION,
): AudioBuffer {
  const length = Math.min(
    Math.ceil(duration * buffer.sampleRate),
    buffer.length,
  );
  const trimmed = ctx.createBuffer(
    buffer.numberOfChannels,
    length,
    buffer.sampleRate,
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(0, length), ch);
  }
  return trimmed;
}

export function Metronome() {
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [bpmDraft, setBpmDraft] = useState(String(DEFAULT_BPM));
  const [beats, setBeats] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [accentEnabled, setAccentEnabled] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const samplesRef = useRef<{
    click: AudioBuffer | null;
    accent: AudioBuffer | null;
  }>({ click: null, accent: null });
  const loadSamplesRef = useRef<Promise<void> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatCounterRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const beatTimeoutsRef = useRef<number[]>([]);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  const accentEnabledRef = useRef(accentEnabled);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
    setBpmDraft(String(bpm));
  }, [bpm]);
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);
  useEffect(() => {
    accentEnabledRef.current = accentEnabled;
  }, [accentEnabled]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      beatTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      silentAudioRef.current?.pause();
      audioCtxRef.current?.close();
    };
  }, []);

  function getAudioContext() {
    unlockMediaPlayback();
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.gain.value = 1.25;
      masterGainRef.current.connect(audioCtxRef.current.destination);
    }
    return audioCtxRef.current;
  }

  function playClick(time: number, beatInBar: number) {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const useAccentSample = accentEnabledRef.current
      ? beatInBar === 0
      : true;

    const buffer = useAccentSample
      ? samplesRef.current.accent
      : samplesRef.current.click;
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(master);

    const when = Math.max(time, ctx.currentTime);
    source.start(when);
  }

  async function ensureSamples(ctx: AudioContext) {
    if (samplesRef.current.click && samplesRef.current.accent) return;

    if (!loadSamplesRef.current) {
      loadSamplesRef.current = (async () => {
        const [clickRes, accentRes] = await Promise.all([
          fetch(CLICK_URL),
          fetch(ACCENT_URL),
        ]);
        if (!clickRes.ok || !accentRes.ok) {
          throw new Error("Falha ao carregar samples do metrónomo");
        }

        const [clickData, accentData] = await Promise.all([
          clickRes.arrayBuffer(),
          accentRes.arrayBuffer(),
        ]);

        const [clickRaw, accentRaw] = await Promise.all([
          ctx.decodeAudioData(clickData.slice(0)),
          ctx.decodeAudioData(accentData.slice(0)),
        ]);

        samplesRef.current = {
          click: trimBuffer(ctx, clickRaw),
          accent: trimBuffer(ctx, accentRaw),
        };
      })();
    }

    await loadSamplesRef.current;
  }

  function scheduler() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const secondsPerBeat = 60.0 / bpmRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const beatInBar = beatCounterRef.current % beatsRef.current;
      playClick(nextNoteTimeRef.current, beatInBar);

      const scheduledBeat = beatInBar;
      const delay = (nextNoteTimeRef.current - ctx.currentTime) * 1000;
      const timeoutId = window.setTimeout(
        () => setCurrentBeat(scheduledBeat),
        Math.max(0, delay),
      );
      beatTimeoutsRef.current.push(timeoutId);

      nextNoteTimeRef.current += secondsPerBeat;
      beatCounterRef.current += 1;
    }
  }

  async function start() {
    unlockMediaPlayback();
    silentAudioRef.current = keepSilentMediaElementAlive();

    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    try {
      await ensureSamples(ctx);
    } catch {
      return;
    }

    beatCounterRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    timerRef.current = window.setInterval(scheduler, 25);
    setPlaying(true);
  }

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    beatTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    beatTimeoutsRef.current = [];
    silentAudioRef.current?.pause();
    setPlaying(false);
    setCurrentBeat(-1);
  }

  function toggle() {
    if (playing) stop();
    else void start();
  }

  const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, v));

  function updateBpm(next: number) {
    setBpm(clampBpm(next));
  }

  function onBpmDraftChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    setBpmDraft(digits);
  }

  function commitBpmDraft() {
    if (!bpmDraft) {
      setBpmDraft(String(bpm));
      return;
    }
    updateBpm(Number(bpmDraft));
  }

  function handleTapTempo() {
    const now = performance.now();
    const taps = tapTimesRef.current;

    if (taps.length > 0 && now - taps[taps.length - 1] > TAP_RESET_MS) {
      tapTimesRef.current = [now];
      return;
    }

    taps.push(now);

    const maxTaps = TAP_WINDOW_INTERVALS + 1;
    if (taps.length > maxTaps) {
      taps.splice(0, taps.length - maxTaps);
    }

    if (taps.length < 2) return;

    let totalMs = 0;
    for (let i = 1; i < taps.length; i += 1) {
      totalMs += taps[i] - taps[i - 1];
    }
    const avgMs = totalMs / (taps.length - 1);
    updateBpm(Math.round(60_000 / avgMs));
  }

  const timeSignature =
    TIME_SIGNATURES.find((ts) => ts.beats === beats) ?? TIME_SIGNATURES[2];

  return (
    <div className="flex w-full flex-col items-center gap-8 rounded-2xl border bg-card p-8 min-[1360px]:h-full">
      {/* Indicador de batidas */}
      <div className="flex items-center gap-3">
        {Array.from({ length: beats }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full border transition-all duration-75",
              currentBeat === i
                ? accentEnabled && i === 0
                  ? "neuma-bg-gradient-fill scale-125 border-transparent"
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
            onClick={() => updateBpm(bpm - 1)}
            aria-label="Diminuir BPM"
          >
            <Minus className="size-4" />
          </Button>
          <div className="flex flex-col items-center">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="BPM"
              value={bpmDraft}
              onChange={(e) => onBpmDraftChange(e.target.value)}
              onBlur={commitBpmDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="min-w-[3.2ch] max-w-[4.5ch] bg-transparent text-center text-6xl font-semibold tabular-nums outline-none selection:bg-white/20"
            />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              BPM
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateBpm(bpm + 1)}
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
        onValueChange={(v) => updateBpm(Array.isArray(v) ? v[0] : v)}
        className="w-full"
      />

      <div className="flex w-full items-center justify-center gap-3">
        <Select
          value={timeSignature.label}
          disabled={!accentEnabled}
          onValueChange={(v) => {
            const next = TIME_SIGNATURES.find((ts) => ts.label === v);
            if (next) setBeats(next.beats);
          }}
        >
          <SelectTrigger
            disabled={!accentEnabled}
            className="size-16 justify-center rounded-full p-0 text-base *:data-[slot=select-value]:justify-center *:data-[slot=select-value]:text-center [&_svg]:hidden"
          >
            <SelectValue>{timeSignature.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIME_SIGNATURES.map((ts) => (
              <SelectItem
                key={ts.label}
                value={ts.label}
                className="min-h-11 py-2.5 pl-3 text-base"
              >
                {ts.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setAccentEnabled((v) => !v)}
          aria-label={
            accentEnabled ? "Desligar acentuação" : "Ligar acentuação"
          }
          aria-pressed={accentEnabled}
          className={cn(
            "size-14 shrink-0 rounded-full border transition-all",
            accentEnabled
              ? "neuma-bg-gradient-fill border-transparent shadow-sm"
              : "border-border bg-muted grayscale",
          )}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onPointerDown={(e) => {
            e.preventDefault();
            handleTapTempo();
          }}
          aria-label="Tap tempo"
          className="size-14 rounded-full text-[10px] font-semibold uppercase tracking-wider"
        >
          TAP
        </Button>

        <Button
          onClick={toggle}
          size="icon"
          aria-label={playing ? "Parar metrónomo" : "Iniciar metrónomo"}
          className="size-14 rounded-full"
        >
          {playing ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
