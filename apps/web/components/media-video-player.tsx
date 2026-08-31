"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";

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

const timelineInputClass =
  "absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0";

const volumeRangeClass =
  "w-14 cursor-pointer appearance-none accent-[var(--neuma-coral)] sm:w-16 h-1 rounded-full bg-white/20 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--neuma-coral)] [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--neuma-coral)]";

const CONTROLS_HIDE_DELAY_MS = 3000;

/**
 * Native `<video>` with custom controls.
 *
 * Mobile volume (iOS silent switch): video starts muted so browsers allow
 * programmatic play after tap. The first user gesture (center play or play
 * button) sets muted=false before play(), which routes audio through the
 * media volume channel on iOS Safari — independent of the ringer/silent switch.
 * Uses playsInline to avoid forced fullscreen on iPhone.
 */
function NativeVideoPlayer({
  url,
  title,
  isPortrait,
  frameClassName,
  onLoadedMetadata,
}: {
  url: string;
  title?: string;
  isPortrait: boolean;
  frameClassName?: string;
  onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

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

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearHideControlsTimeout();
  }, [clearHideControlsTimeout]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncDuration = () => setDuration(video.duration || 0);
    const onTimeUpdate = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
    };
    const onPlay = () => {
      setIsPlaying(true);
      setControlsVisible(true);
      // Mobile/touch: hide after the play gesture. Desktop keeps controls
      // until pointer leaves the player region.
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(hover: none)").matches
      ) {
        clearHideControlsTimeout();
        hideControlsTimeoutRef.current = setTimeout(() => {
          setControlsVisible(false);
          hideControlsTimeoutRef.current = null;
        }, CONTROLS_HIDE_DELAY_MS);
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      clearHideControlsTimeout();
      setControlsVisible(true);
    };
    const onEnded = () => {
      setIsPlaying(false);
      clearHideControlsTimeout();
      setControlsVisible(true);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", syncDuration);
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [clearHideControlsTimeout, isSeeking]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    return () => clearHideControlsTimeout();
  }, [clearHideControlsTimeout]);

  const playWithSound = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    setMuted(false);

    try {
      await video.play();
    } catch {
      // Autoplay policy or load error — leave paused.
    }
  }, []);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await playWithSound();
    } else {
      video.pause();
    }
  }, [playWithSound]);

  const handleSurfaceToggle = useCallback(async () => {
    await togglePlay();
  }, [togglePlay]);

  const handleMouseEnter = useCallback(() => {
    if (!isPlaying) return;
    showControls();
  }, [isPlaying, showControls]);

  const handleMouseLeave = useCallback(() => {
    if (!isPlaying) return;
    scheduleHideControls();
  }, [isPlaying, scheduleHideControls]);

  const handleTouchStart = useCallback(() => {
    if (!isPlaying) return;
    showControls();
    scheduleHideControls();
  }, [isPlaying, scheduleHideControls, showControls]);

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

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (container.requestFullscreen) {
      await container.requestFullscreen();
      return;
    }

    const webkitVideo = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    webkitVideo.webkitEnterFullscreen?.();
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showPlayingControls = isPlaying && controlsVisible;

  return (
    <div
      ref={containerRef}
      className={cn(
        frameClassName ?? playerFrameClass,
        isPortrait ? "aspect-[9/16]" : "aspect-video",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      <video
        ref={videoRef}
        src={url}
        playsInline
        muted
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        className="absolute inset-0 size-full object-contain"
        aria-label={title ?? "Vídeo"}
      >
        <track kind="captions" />
      </video>

      {!isPlaying ? (
        <button
          type="button"
          onClick={playWithSound}
          className="absolute inset-0 z-10 flex size-full items-center justify-center rounded-xl bg-black/40 transition-opacity"
          aria-label="Reproduzir vídeo"
        >
          <span className="grid size-14 place-items-center rounded-full bg-[var(--neuma-coral)] text-white transition-transform hover:scale-105">
            <Play className="ml-0.5 size-7 fill-current" />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSurfaceToggle}
          className="absolute inset-0 z-10 size-full cursor-pointer border-0 bg-transparent p-0"
          aria-label="Pausar vídeo"
        />
      )}

      {isPlaying ? (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 via-black/45 to-transparent pt-8 transition-opacity duration-200",
            showPlayingControls
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => {
            event.stopPropagation();
            showControls();
            scheduleHideControls();
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 px-2 pb-1.5 sm:gap-2 sm:px-3">
            <button
              type="button"
              onClick={togglePlay}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white transition-colors hover:bg-white/10"
              aria-label="Pausar"
            >
              <Pause className="size-4" />
            </button>

            <span className="shrink-0 tabular-nums text-[10px] text-white/70 sm:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-white transition-colors hover:bg-white/10"
                aria-label={muted || volume === 0 ? "Ativar som" : "Silenciar"}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>
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
              />
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white transition-colors hover:bg-white/10"
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

          <div className="px-4 pb-2">
            <div className="relative h-1">
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-white/25"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-[var(--neuma-coral)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progress}
                onChange={(event) => {
                  setIsSeeking(true);
                  handleSeek(Number(event.target.value));
                }}
                onMouseUp={() => setIsSeeking(false)}
                onTouchEnd={() => setIsSeeking(false)}
                className={timelineInputClass}
                aria-label="Linha do tempo"
                aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`}
              />
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
  className,
  fallbackLabel = "Abrir vídeo",
  size = "compact",
  onOrientationChange,
}: {
  url: string | null | undefined;
  title?: string;
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
        url={url}
        title={title}
        isPortrait={isPortrait}
        frameClassName={isFull ? playerFrameFullClass : undefined}
        onLoadedMetadata={handleLoadedMetadata}
      />
    </div>
  );
}
