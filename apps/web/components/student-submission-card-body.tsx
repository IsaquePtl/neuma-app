"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  MediaVideoPlayer,
  type VideoOrientation,
} from "@/components/media-video-player";
import { cn } from "@/lib/utils";

export function StudentSubmissionCardBody({
  videoUrl,
  children,
}: {
  videoUrl?: string | null;
  children?: ReactNode;
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
  const desktopSideBySide = hasVideo && hasContent;
  const isPortraitLayout = hasVideo && orientation === "portrait";

  if (!hasVideo && !hasContent) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        desktopSideBySide &&
          "desktop:flex-row desktop:items-start desktop:gap-6",
      )}
    >
      {hasVideo ? (
        <div
          className={cn(
            "min-w-0 w-full max-w-full shrink-0",
            desktopSideBySide
              ? isPortraitLayout
                ? "desktop:w-[240px] desktop:max-w-[240px]"
                : "desktop:w-[min(100%,28rem)] desktop:max-w-[min(100%,28rem)]"
              : undefined,
          )}
        >
          <MediaVideoPlayer
            url={videoUrl}
            title="A tua submissão"
            fallbackLabel="Abrir ficheiro"
            onOrientationChange={handleOrientationChange}
          />
        </div>
      ) : null}
      {hasContent ? (
        <div
          className={cn(
            "min-w-0 flex-1 space-y-3",
            hasVideo &&
              "border-t border-white/10 pt-4 desktop:border-t-0 desktop:pt-0",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
