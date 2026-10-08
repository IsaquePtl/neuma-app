"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

import { VideoEmbed, toEmbedUrl } from "@/components/video-embed";
import { cn } from "@/lib/utils";

const playerFrameClass =
  "relative w-full overflow-hidden rounded-xl bg-black/40";

const playerFrameFullClass =
  "relative w-full overflow-hidden rounded-xl bg-black/40";

/** Compact, card-friendly embed sizing for student submission/feedback views. */
function playerSizeClass(isPortrait: boolean) {
  return isPortrait ? "mx-auto max-w-[240px]" : "mx-auto max-w-md";
}

export type MediaVideoPlayerSize = "compact" | "full";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

const volumeRangeClass =
  "h-1 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--neuma-coral)] sm:w-16 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--neuma-coral)] [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--neuma-coral)]";

const CONTROLS_HIDE_DELAY_MS = 2500;

const chromeBtnClass =
  "grid size-8 shrink-0 place-items-center rounded-lg text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40";

/**
 * Native `<video>` with custom controls.
 *
 * Before the first play: the cover is the picture (the video file stays
 * unloaded so it cannot paint black over it). Play hides the cover.
 * Desktop: a click anywhere on the picture toggles play. Mobile: only the
 * center button does, with a larger hit area than the orange circle.
 * After the first play, chrome shows on hover (desktop) or after
 * play/pause, and hides after 2.5s. The timeline and the other controls
 * do not toggle playback.
 *
 * Mobile volume (iOS silent switch): video starts muted; first play gesture
 * unmute before play(). playsInline avoids forced fullscreen on iPhone.
 */
function NativeVideoPlayer({
  url,
  title,
  poster,
  isPortrait,
  frameClassName,
  onLoadedMetadata,
}: {
  url: string;
  title?: string;
  poster?: string | null;
  isPortrait: boolean;
  frameClassName?: string;
  onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [isFinePointer, setIsFinePointer] = useState(false);
  const [isTimelineHovered, setIsTimelineHovered] = useState(false);
  const [isTimelinePointerActive, setIsTimelinePointerActive] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const scrubbingRef = useRef(false);
  const isSeekingRef = useRef(false);
  const playRequestRef = useRef<Promise<void> | null>(null);
  const hasStartedRef = useRef(false);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  const clearHideControlsTimeout = useCallback(() => {
    if (hideControlsTimeoutRef.current !== null) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideControlsTimeout();
    hideControlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      hideControlsTimeoutRef.current = null;
    }, CONTROLS_HIDE_DELAY_MS);
  }, [clearHideControlsTimeout]);

  /** Reveal chrome. While playing, hide again after 2.5s. */
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (isPlayingRef.current) scheduleHideControls();
  }, [scheduleHideControls]);

  const revealControlsFromHover = useCallback(() => {
    if (!isFinePointer || !hasStartedRef.current) return;
    revealControls();
  }, [isFinePointer, revealControls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncDuration = () =>
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onTimeUpdate = () => {
      if (!isSeekingRef.current) setCurrentTime(video.currentTime);
    };
    const onWaiting = () => {
      if (!video.paused) setIsBuffering(true);
    };
    const onReady = () => setIsBuffering(false);
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setControlsVisible(true);
      clearHideControlsTimeout();
      const code = video.error?.code;
      setPlayError(
        code === 4
          ? "Este browser não consegue reproduzir este formato de vídeo."
          : "Não foi possível carregar o vídeo.",
      );
    };
    const onPlay = () => {
      setPlayError(null);
      hasStartedRef.current = true;
      isPlayingRef.current = true;
      setHasStarted(true);
      setIsPlaying(true);
      setControlsVisible(true);
      clearHideControlsTimeout();
      hideControlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
        hideControlsTimeoutRef.current = null;
      }, CONTROLS_HIDE_DELAY_MS);
    };
    const onPause = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setIsBuffering(false);
      clearHideControlsTimeout();
      setControlsVisible(true);
    };
    const onEnded = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setIsBuffering(false);
      clearHideControlsTimeout();
      setControlsVisible(true);
    };

    const listeners: [string, () => void][] = [
      ["timeupdate", onTimeUpdate],
      ["durationchange", syncDuration],
      ["loadedmetadata", syncDuration],
      ["play", onPlay],
      ["pause", onPause],
      ["ended", onEnded],
      ["waiting", onWaiting],
      ["stalled", onWaiting],
      ["playing", onReady],
      ["canplay", onReady],
      ["seeked", onReady],
      ["error", onError],
    ];
    for (const [name, fn] of listeners) video.addEventListener(name, fn);

    // Events may have fired before hydration attached the listeners.
    syncDuration();
    if (!video.paused) setIsPlaying(true);
    if (video.error) onError();

    return () => {
      for (const [name, fn] of listeners) video.removeEventListener(name, fn);
    };
  }, [clearHideControlsTimeout]);

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const onFullscreenChange = () => {
      setIsFullscreen(
        Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement),
      );
    };
    const video = videoRef.current;
    const onWebkitEnd = () => setIsFullscreen(false);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    video?.addEventListener("webkitendfullscreen", onWebkitEnd);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      video?.removeEventListener("webkitendfullscreen", onWebkitEnd);
    };
  }, []);

  useEffect(() => {
    return () => clearHideControlsTimeout();
  }, [clearHideControlsTimeout]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setIsFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const playWithSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return Promise.resolve();
    if (playRequestRef.current) return playRequestRef.current;

    setPlayError(null);
    if (!video.getAttribute("src")) {
      video.preload = "auto";
      video.src = url;
    } else if (video.error) {
      // Retry after a failed load (e.g. network blip).
      video.load();
    }
    if (video.ended) video.currentTime = 0;
    video.muted = false;
    setMuted(false);
    if (video.readyState < 3) setIsBuffering(true);

    const request = (async () => {
      try {
        await video.play();
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "AbortError") return;
        if (name === "NotAllowedError") {
          // Browser blocked sound: start muted so playback still works.
          video.muted = true;
          setMuted(true);
          try {
            await video.play();
            return;
          } catch {
            // fall through to error state
          }
        }
        setIsBuffering(false);
        setPlayError(
          name === "NotSupportedError"
            ? "Este browser não consegue reproduzir este formato de vídeo."
            : "Não foi possível reproduzir o vídeo.",
        );
      } finally {
        playRequestRef.current = null;
      }
    })();
    playRequestRef.current = request;
    return request;
  }, [url]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await playWithSound();
    } else {
      video.pause();
    }
  }, [playWithSound]);

  /** The picture itself is play/pause. Controls sit above this layer. */
  const handleSurfaceActivate = useCallback(
    (event: React.SyntheticEvent) => {
      event.preventDefault();
      void togglePlay();
    },
    [togglePlay],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);

    if (!nextMuted && video.volume === 0) {
      video.volume = 1;
      setVolume(1);
    }
  }, []);

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    const clamped = Math.max(0, Math.min(1, nextVolume));
    video.volume = clamped;
    setVolume(clamped);

    if (clamped === 0) {
      video.muted = true;
      setMuted(true);
      return;
    }

    video.muted = false;
    setMuted(false);
  }, []);

  const handleSeek = useCallback(
    (percent: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(duration) || duration <= 0) return;

      const time = (percent / 100) * duration;
      video.currentTime = time;
      setCurrentTime(time);
    },
    [duration],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const percent = Math.max(
        0,
        Math.min(100, ((clientX - rect.left) / rect.width) * 100),
      );
      handleSeek(percent);
    },
    [duration, handleSeek],
  );

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const el = container as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const webkitVideo = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (doc.webkitFullscreenElement) {
        await doc.webkitExitFullscreen?.();
        return;
      }
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
      if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        return;
      }
    } catch {
      // Element fullscreen refused (iOS) — fall back to the native player.
    }
    webkitVideo.webkitEnterFullscreen?.();
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showChrome = controlsVisible;
  const isTimelineZoomed =
    isTimelineHovered || isTimelinePointerActive || isSeeking;
  const showHoverPreview =
    isFinePointer &&
    hoverPercent !== null &&
    hoverPercent > progress + 0.5;

  const handleTimelineMouseEnter = useCallback(() => {
    setIsTimelineHovered(true);
  }, []);

  const handleTimelineMouseLeave = useCallback(() => {
    if (scrubbingRef.current) return;
    setIsTimelineHovered(false);
    setHoverPercent(null);
  }, []);

  const endTimelineScrub = useCallback(
    (target: HTMLElement, pointerId: number) => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      setIsSeeking(false);
      setIsTimelinePointerActive(false);
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // already released
      }
      if (isPlaying) scheduleHideControls();
    },
    [isPlaying, scheduleHideControls],
  );

  const handleTimelinePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      scrubbingRef.current = true;
      setIsSeeking(true);
      setIsTimelinePointerActive(true);
      setIsTimelineHovered(true);
      setControlsVisible(true);
      clearHideControlsTimeout();
      event.currentTarget.setPointerCapture(event.pointerId);
      seekFromClientX(event.clientX);
    },
    [clearHideControlsTimeout, seekFromClientX],
  );

  const handleTimelinePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (scrubbingRef.current) {
        event.preventDefault();
        seekFromClientX(event.clientX);
        return;
      }
      if (!isFinePointer || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const percent = Math.max(
        0,
        Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
      );
      setHoverPercent(percent);
    },
    [isFinePointer, seekFromClientX],
  );

  const handleTimelinePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      endTimelineScrub(event.currentTarget, event.pointerId);
    },
    [endTimelineScrub],
  );

  const handleTimelineKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (duration <= 0) return;
      const step = event.shiftKey ? 10 : 5;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        handleSeek(Math.min(100, progress + step));
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        handleSeek(Math.max(0, progress - step));
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        handleSeek(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        handleSeek(100);
      }
    },
    [duration, handleSeek, progress],
  );

  const handleContainerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== " " && event.key !== "k" && event.key !== "K") return;

      const target = event.target as HTMLElement;
      if (target.closest('[role="slider"]')) return;

      event.preventDefault();
      void togglePlay();
    },
    [togglePlay],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        frameClassName ?? playerFrameClass,
        isPortrait ? "aspect-[9/16]" : "aspect-video",
      )}
      onKeyDown={handleContainerKeyDown}
      onMouseEnter={revealControlsFromHover}
      onMouseMove={revealControlsFromHover}
      style={
        poster && !hasStarted
          ? {
              backgroundImage: `url("${poster.replaceAll('"', "%22")}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {poster ? (
        <link rel="preload" as="image" href={poster} fetchPriority="high" />
      ) : null}
      <video
        ref={videoRef}
        src={poster ? undefined : url}
        poster={poster ?? undefined}
        playsInline
        muted
        preload={poster ? "none" : "metadata"}
        tabIndex={-1}
        onLoadedMetadata={onLoadedMetadata}
        onClick={(event) => event.preventDefault()}
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-contain outline-none",
          poster && !hasStarted && "invisible",
        )}
        aria-label={title ?? "Vídeo"}
      >
        <track kind="captions" />
      </video>

      {poster && !hasStarted ? (
        <img
          src={poster}
          alt=""
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="pointer-events-none absolute inset-0 z-[5] size-full object-cover"
        />
      ) : null}

      {/* Desktop: the whole picture toggles play. Mobile uses the center button. */}
      {isFinePointer && !playError ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={handleSurfaceActivate}
          className="absolute inset-0 z-10 size-full cursor-pointer border-0 bg-transparent p-0 outline-none"
          aria-hidden={!isPlaying || showChrome ? true : undefined}
          aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
        />
      ) : null}

      {/* Dim when paused — visual only; the coral control owns the hit target. */}
      {!isPlaying && !playError ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 rounded-xl",
            poster && !hasStarted ? "bg-black/20" : "bg-black/40",
          )}
          aria-hidden
        />
      ) : null}

      {/* Center play / pause. Hit box is larger than the circle, especially on touch. */}
      {playError ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/70 px-4 text-center">
          <p className="max-w-xs text-sm text-white/90">{playError}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void playWithSound();
              }}
              className="touch-manipulation rounded-full bg-[var(--neuma-coral)] px-4 py-2 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Tentar novamente
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Abrir vídeo
            </a>
          </div>
        </div>
      ) : isBuffering && isPlaying ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="grid size-14 place-items-center rounded-full bg-black/50 text-white">
            <Loader2 className="size-7 animate-spin" aria-label="A carregar" />
          </span>
        </div>
      ) : !isPlaying || showChrome || !isFinePointer ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void togglePlay();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "absolute top-1/2 left-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            isFinePointer ? "size-28" : "size-56",
          )}
          aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
        >
          {!isPlaying || showChrome ? (
            <span className="grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--neuma-coral)_82%,transparent)] text-white shadow-lg">
              {isBuffering ? (
                <Loader2 className="size-7 animate-spin" aria-hidden />
              ) : isPlaying ? (
                <Pause className="size-7 fill-current" />
              ) : (
                <Play className="ml-0.5 size-7 fill-current" />
              )}
            </span>
          ) : null}
        </button>
      ) : null}

      {/* Bottom chrome only after the video has started. */}
      {hasStarted && showChrome ? (
        <div
          className="absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/75 via-black/45 to-transparent pt-8"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="-mb-1 flex items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
            <span className="shrink-0 tabular-nums text-[10px] text-white/70 sm:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div
              role="group"
              aria-label="Controlo de volume"
              className="group/volume hidden shrink-0 items-center gap-1 rounded-lg hover:bg-white/10 focus-within:bg-white/10 sm:flex"
            >
              <button
                type="button"
                onClick={toggleMute}
                className={chromeBtnClass}
                aria-label={
                  muted || volume === 0 ? "Ativar som" : "Silenciar"
                }
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>
              <div className="max-w-0 overflow-hidden opacity-0 group-hover/volume:max-w-16 group-hover/volume:opacity-100 group-focus-within/volume:max-w-16 group-focus-within/volume:opacity-100">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={muted ? 0 : volume * 100}
                  onChange={(event) =>
                    handleVolumeChange(Number(event.target.value) / 100)
                  }
                  className={volumeRangeClass}
                  aria-label="Volume"
                  aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} por cento`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className={chromeBtnClass}
              aria-label={
                isFullscreen ? "Sair de ecrã inteiro" : "Ecrã inteiro"
              }
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </button>
          </div>

          <div className="px-4 pb-1.5 sm:pb-2">
            <div
              ref={timelineRef}
              role="slider"
              tabIndex={0}
              aria-label="Linha do tempo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`}
              className="relative touch-none overflow-visible py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-white/35 sm:py-2.5"
              onMouseEnter={handleTimelineMouseEnter}
              onMouseLeave={handleTimelineMouseLeave}
              onPointerDown={handleTimelinePointerDown}
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={handleTimelinePointerUp}
              onPointerCancel={handleTimelinePointerUp}
              onKeyDown={handleTimelineKeyDown}
            >
              <div
                className="pointer-events-none relative flex h-2.5 items-center"
                aria-hidden
              >
                <div
                  className={cn(
                    "relative w-full overflow-hidden rounded-full bg-white/25 transition-[height] duration-150 ease-out",
                    isTimelineZoomed ? "h-2.5" : "h-1",
                  )}
                >
                  {showHoverPreview && hoverPercent !== null ? (
                    <div
                      className="absolute inset-y-0 bg-white/20"
                      style={{
                        left: `${progress}%`,
                        width: `${hoverPercent - progress}%`,
                      }}
                    />
                  ) : null}
                  <div
                    className="h-full rounded-full bg-[var(--neuma-coral)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 z-[1] aspect-square shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-[var(--neuma-coral)] shadow-[0_0_0_1px_rgba(0,0,0,0.2)] transition-[width,height] duration-150 ease-out",
                  isTimelineZoomed ? "size-3.5" : "size-3",
                )}
                style={{ left: `${progress}%` }}
                aria-hidden
              />

              {showHoverPreview && hoverPercent !== null ? (
                <div
                  className="pointer-events-none absolute top-1/2 z-[2] h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-white/45"
                  style={{ left: `${hoverPercent}%` }}
                  aria-hidden
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type VideoOrientation = "portrait" | "landscape";

/** Embedded player for uploaded or hosted video URLs. */
export function MediaVideoPlayer({
  url,
  title,
  poster,
  className,
  fallbackLabel = "Abrir vídeo",
  size = "compact",
  onOrientationChange,
}: {
  url: string | null | undefined;
  title?: string;
  poster?: string | null;
  className?: string;
  fallbackLabel?: string;
  /**
   * `compact` — card-friendly max-width (feedback/check-ins).
   * `full` — full width within the content column (no max-width clamp).
   */
  size?: MediaVideoPlayerSize;
  /** Fires when native video metadata reveals portrait vs landscape. Defaults to landscape until known. */
  onOrientationChange?: (orientation: VideoOrientation) => void;
}) {
  const [isPortrait, setIsPortrait] = useState(false);
  const onOrientationChangeRef = useRef(onOrientationChange);
  const isFull = size === "full";

  useEffect(() => {
    onOrientationChangeRef.current = onOrientationChange;
  }, [onOrientationChange]);

  useEffect(() => {
    setIsPortrait(false);
    onOrientationChangeRef.current?.("landscape");
  }, [url]);

  const handleLoadedMetadata = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget;
      const portrait = video.videoHeight > video.videoWidth;
      setIsPortrait(portrait);
      onOrientationChangeRef.current?.(portrait ? "portrait" : "landscape");
    },
    [],
  );

  if (!url) return null;

  const orientation: VideoOrientation = isPortrait ? "portrait" : "landscape";
  const shellClass = cn(
    "min-w-0 w-full max-w-full",
    !isFull && playerSizeClass(isPortrait),
    isFull && isPortrait && "mx-auto max-w-[min(100%,420px)]",
    className,
  );

  if (toEmbedUrl(url)) {
    return (
      <div className={shellClass} data-orientation={orientation}>
        <VideoEmbed
          url={url}
          title={title}
          fallbackLabel={fallbackLabel}
          className="rounded-xl"
        />
      </div>
    );
  }

  return (
    <div className={shellClass} data-orientation={orientation}>
      <NativeVideoPlayer
        key={url}
        url={url}
        title={title}
        poster={poster}
        isPortrait={isPortrait}
        frameClassName={isFull ? playerFrameFullClass : undefined}
        onLoadedMetadata={handleLoadedMetadata}
      />
    </div>
  );
}
