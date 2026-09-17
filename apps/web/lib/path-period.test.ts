import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { segmentNodeTimeline } from "./path-period.ts";

describe("segmentNodeTimeline", () => {
  it("treats null duration_weeks as 1 when any custom duration is set", () => {
    const segments = segmentNodeTimeline(4, 10, [1, null, 2, null]);
    assert.deepEqual(
      segments.map((s) => s.duration_weeks),
      [1, 1, 2, 1],
    );
    assert.deepEqual(
      segments.map((s) => s.week_number),
      [1, 2, 3, 5],
    );
  });

  it("auto-splits when every duration is null", () => {
    const segments = segmentNodeTimeline(3, 6, [null, null, null]);
    assert.equal(segments.length, 3);
    assert.equal(
      segments.reduce((sum, s) => sum + s.duration_weeks, 0),
      6,
    );
  });
});
