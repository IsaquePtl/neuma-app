import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTROLS_HIDE_DELAY_MS,
  isPrimaryTouchDevice,
  isTapWithinTolerance,
  isTouchPointerType,
  surfaceTogglesPlayback,
} from "./player-gesture.ts";

describe("player gesture policy", () => {
  it("keeps the 2.5s controls timeout", () => {
    assert.equal(CONTROLS_HIDE_DELAY_MS, 2500);
  });

  it("treats touch and pen as touch pointers", () => {
    assert.equal(isTouchPointerType("touch"), true);
    assert.equal(isTouchPointerType("pen"), true);
    assert.equal(isTouchPointerType("mouse"), false);
    assert.equal(isTouchPointerType(""), false);
  });

  it("detects phones from the coarse pointer media query", () => {
    assert.equal(
      isPrimaryTouchDevice({
        hoverNoneAndCoarse: true,
        maxTouchPoints: 5,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      }),
      true,
    );
  });

  it("counts iPadOS as touch even when it claims a fine pointer", () => {
    assert.equal(
      isPrimaryTouchDevice({
        hoverNoneAndCoarse: false,
        maxTouchPoints: 5,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      }),
      true,
    );
    assert.equal(
      isPrimaryTouchDevice({
        hoverNoneAndCoarse: false,
        maxTouchPoints: 0,
        userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)",
      }),
      true,
    );
  });

  it("keeps a desktop Mac on the fine-pointer path", () => {
    assert.equal(
      isPrimaryTouchDevice({
        hoverNoneAndCoarse: false,
        maxTouchPoints: 0,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      }),
      false,
    );
  });

  it("lets only a desktop mouse toggle playback from the video surface", () => {
    assert.equal(
      surfaceTogglesPlayback({ pointerType: "mouse", primaryTouchDevice: false }),
      true,
    );
    assert.equal(
      surfaceTogglesPlayback({ pointerType: "touch", primaryTouchDevice: false }),
      false,
    );
    assert.equal(
      surfaceTogglesPlayback({ pointerType: "pen", primaryTouchDevice: false }),
      false,
    );
    assert.equal(
      surfaceTogglesPlayback({ pointerType: "mouse", primaryTouchDevice: true }),
      false,
    );
  });

  it("ignores a finger that moved far enough to be a scroll", () => {
    assert.equal(isTapWithinTolerance(0, 0, 8, 4), true);
    assert.equal(isTapWithinTolerance(0, 0, 40, 0), false);
  });
});
