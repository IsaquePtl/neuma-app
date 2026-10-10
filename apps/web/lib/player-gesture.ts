/** How long playback controls stay up during playback before auto-hiding. */
export const CONTROLS_HIDE_DELAY_MS = 2500;

const TAP_MOVE_TOLERANCE_PX = 12;

export function isTouchPointerType(pointerType: string | undefined): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

/**
 * Phones and tablets, including iPad.
 *
 * iPadOS reports a desktop pointer (`hover: hover` and `pointer: fine`) while
 * still being a touch device. A Mac does not: `maxTouchPoints` stays 0.
 */
export function isPrimaryTouchDevice(input: {
  hoverNoneAndCoarse: boolean;
  maxTouchPoints: number;
  userAgent: string;
}): boolean {
  if (input.hoverNoneAndCoarse) return true;
  if (/iPad|iPhone|iPod/.test(input.userAgent)) return true;
  if (/Macintosh/.test(input.userAgent) && input.maxTouchPoints > 1) return true;
  return false;
}

/**
 * Clicking the picture toggles playback only for a mouse on a desktop.
 * Touch, pen, phones, and iPads never pause from the video surface.
 */
export function surfaceTogglesPlayback(input: {
  pointerType: string | undefined;
  primaryTouchDevice: boolean;
}): boolean {
  if (isTouchPointerType(input.pointerType)) return false;
  if (input.primaryTouchDevice) return false;
  return true;
}

export function isTapWithinTolerance(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): boolean {
  const dx = endX - startX;
  const dy = endY - startY;
  return dx * dx + dy * dy <= TAP_MOVE_TOLERANCE_PX * TAP_MOVE_TOLERANCE_PX;
}
