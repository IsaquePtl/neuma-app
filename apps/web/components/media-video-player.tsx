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

const volumeRangeClass =
  "h-1 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--neuma-coral)] sm:w-16 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--neuma-coral)] [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--neuma-coral)]";

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
  const timelineRef = useRef<HTMLDivElement>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);
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
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [isFinePointer, setIsFinePointer] = useState(false);
  const [isTimelineHovered, setIsTimelineHovered] = useState(false);
  const [isTimelinePointerActive, setIsTimelinePointerActive] = useState(false);
  const [volumeSliderPinned, setVolumeSliderPinned] = useState(false);
  const scrubbingRef = useRef(false);

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
      setVolumeSliderPinned(false);
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
          setVolumeSliderPinned(false);
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

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setIsFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
      showControls();
      clearHideControlsTimeout();
      event.currentTarget.setPointerCapture(event.pointerId);
      seekFromClientX(event.clientX);
    },
    [clearHideControlsTimeout, seekFromClientX, showControls],
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

  const handleVolumeButtonClick = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  const handleVolumeButtonKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setVolumeSliderPinned(true);
        handleVolumeChange(Math.min(1, volume + 0.05));
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setVolumeSliderPinned(true);
        handleVolumeChange(Math.max(0, volume - 0.05));
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        toggleMute();
      }
    },
    [handleVolumeChange, toggleMute, volume],
  );

  const handleVolumeMouseLeave = useCallback(() => {
    setVolumeSliderPinned(false);
  }, []);

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
      onKeyDown={handleContainerKeyDown}
    >
      <video
        ref={videoRef}
        src={url}
        playsInline
        muted
        preload="metadata"
        tabIndex={-1}
        onLoadedMetadata={onLoadedMetadata}
        className="absolute inset-0 size-full object-contain outline-none"
        aria-label={title ?? "Vídeo"}
      >
        <track kind="captions" />
      </video>

      {!isPlaying ? (
        <button
          type="button"
          onClick={playWithSound}
          className="absolute inset-0 z-10 flex size-full items-center justify-center rounded-xl bg-black/40 transition-opacity outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Reproduzir vídeo"
        >
          <span className="grid size-14 place-items-center rounded-full bg-[var(--neuma-coral)] text-white transition-transform hover:scale-105">
            <Play className="ml-0.5 size-7 fill-current" />
          </span>
        </button>
      ) : (
        <button
          type="button"
          tabIndex={-1}
          onClick={handleSurfaceToggle}
          className="absolute inset-0 z-10 size-full cursor-pointer border-0 bg-transparent p-0 outline-none focus:outline-none"
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

            <div
              ref={volumeControlRef}
              role="group"
              aria-label="Controlo de volume"
              className={cn(
                "group/volume hidden shrink-0 items-center gap-1 rounded-lg transition-colors hover:bg-white/10 focus-within:bg-white/10 sm:flex",
                volumeSliderPinned && "bg-white/10",
              )}
              onMouseLeave={handleVolumeMouseLeave}
            >
              <button
                type="button"
                onClick={handleVolumeButtonClick}
                onKeyDown={handleVolumeButtonKeyDown}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
                aria-label={
                  muted || volume === 0 ? "Ativar som" : "Silenciar"
                }
                aria-expanded={volumeSliderPinned}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>
              <div
                className={cn(
                  "max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 ease-out",
                  "group-hover/volume:max-w-16 group-hover/volume:opacity-100",
                  "group-focus-within/volume:max-w-16 group-focus-within/volume:opacity-100",
                  volumeSliderPinned && "max-w-16 opacity-100",
                )}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={muted ? 0 : volume * 100}
                  onChange={(event) =>
                    handleVolumeChange(Number(event.target.value) / 100)
                  }
                  onFocus={() => setVolumeSliderPinned(true)}
                  className={volumeRangeClass}
                  aria-label="Volume"
                  aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} por cento`}
                />
              </div>
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

          <div className="px-4 py-1.5 sm:py-0 sm:pb-2">
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
              {/* Track: height grows for hover/scrub — never scaleY (that stretched the thumb). */}
              <div
                className={cn(
                  "pointer-events-none relative flex items-center transition-[height] duration-200 ease-out",
                  isTimelineZoomed ? "h-2.5" : "h-1",
                )}
                aria-hidden
              >
                <div className="relative h-full w-full overflow-hidden rounded-full bg-white/25">
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

              {/* Thumb sits outside the track so it stays a perfect circle on every screen. */}
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 z-[1] aspect-square shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-[var(--neuma-coral)] shadow-[0_0_0_1px_rgba(0,0,0,0.2)]",
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
