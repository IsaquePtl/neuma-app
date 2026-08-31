"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  MediaVideoPlayer,
  type VideoOrientation,
} from "@/components/media-video-player";
import { cn } from "@/lib/utils";

export function StudentFeedbackCardBody({
  videoUrl,
  videoTitle = "Feedback do mentor",
  children,
  nextSteps,
  footer,
}: {
  videoUrl?: string | null;
  videoTitle?: string;
  children?: ReactNode;
  nextSteps?: ReactNode;
  footer?: ReactNode;
}) {
  const [orientation, setOrientation] =
    useState<VideoOrientation>("landscape");

  useEffect(() => {
    setOrientation("landscape");
  }, [videoUrl]);

  const handleOrientationChange = useCallback(
    (next: VideoOrientation) => {
      setOrientation((prev) => (prev === next ? prev : next));
    },
    [],
  );

  const hasVideo = Boolean(videoUrl?.trim());
  const hasContent = Boolean(children);
  const hasNextSteps = Boolean(nextSteps);
  const hasFooter = Boolean(footer);

  if (!hasVideo && !hasContent && !hasNextSteps && !hasFooter) return null;

  // Desktop with video + feedback: video left, Feedback right (same height).
  // Portrait ~240px; landscape wider (~28rem). Próximos passos full width below.
  // Decisão stays in footer (full width below that).
  const isPortraitLayout = hasVideo && orientation === "portrait";
  const desktopSideBySide = hasVideo && hasContent;
  const noVideoTwoCol = !hasVideo && hasContent && hasNextSteps;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {hasVideo || hasContent ? (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-4",
            desktopSideBySide &&
              "desktop:flex-row desktop:items-stretch desktop:gap-6",
            // No video: Feedback | Próximos passos side by side on desktop
            noVideoTwoCol && "desktop:grid desktop:min-w-0 desktop:grid-cols-2 desktop:gap-4",
          )}
        >
          {hasVideo ? (
            <div
              className={cn(
                "min-w-0 w-full max-w-full",
                desktopSideBySide
                  ? isPortraitLayout
                    ? "desktop:w-[240px] desktop:max-w-[240px] desktop:shrink-0"
                    : "desktop:max-w-[min(100%,28rem)] desktop:flex-shrink"
                  : "desktop:mx-auto desktop:max-w-2xl",
              )}
            >
              <MediaVideoPlayer
                url={videoUrl}
                title={videoTitle}
                fallbackLabel="Abrir vídeo"
                onOrientationChange={handleOrientationChange}
                className={desktopSideBySide ? undefined : "max-w-2xl"}
              />
            </div>
          ) : null}
          {hasContent ? (
            <div
              className={cn(
                "min-w-0",
                hasVideo &&
                  "border-t border-white/10 pt-3 desktop:border-t-0 desktop:pt-0",
                desktopSideBySide &&
                  "desktop:flex desktop:min-h-0 desktop:flex-1 desktop:flex-col",
              )}
            >
              <div
                className={cn(
                  desktopSideBySide &&
                    "desktop:flex desktop:h-full desktop:min-h-0 desktop:flex-1 desktop:flex-col",
                )}
              >
                {children}
              </div>
            </div>
          ) : null}
          {/* No-video desktop: próximos passos sits in the same 2-col grid */}
          {noVideoTwoCol ? nextSteps : null}
        </div>
      ) : null}
      {/* With video (or next-steps-only): full width below the video+feedback row */}
      {(hasVideo || !hasContent) && hasNextSteps ? (
        <div className="min-w-0">{nextSteps}</div>
      ) : null}
      {hasFooter ? <div className="min-w-0">{footer}</div> : null}
    </div>
  );
}
