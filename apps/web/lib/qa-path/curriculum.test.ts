import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { flattenQaNodes } from "./curriculum.ts";

describe("QA — Percurso Completo coverage", () => {
  it("has the 10-node table with mixed gates, phases and durations", () => {
    const nodes = flattenQaNodes();
    assert.equal(nodes.length, 10);
    assert.deepEqual(
      nodes.map((n) => n.code),
      [
        "QA-L1",
        "QA-P1",
        "QA-P2",
        "QA-M1",
        "QA-C1",
        "QA-L2",
        "QA-M2",
        "QA-R1",
        "QA-P3",
        "QA-END",
      ],
    );
    assert.equal(nodes[0].phaseKey, "A");
    assert.equal(nodes[4].phaseKey, "A");
    assert.equal(nodes[5].phaseKey, "B");
    assert.equal(nodes[9].phaseKey, "B");
    assert.ok(nodes.some((n) => n.durationWeeks >= 2));
    assert.ok(nodes.some((n) => n.kind === "resource"));
    assert.deepEqual(
      new Set(nodes.map((n) => n.passRule)),
      new Set(["none", "check_in", "quiz", "mentor"]),
    );
    const quizzes = nodes.filter((n) => n.passRule === "quiz");
    assert.equal(quizzes.length, 2);
    for (const q of quizzes) {
      assert.ok((q.quiz?.length ?? 0) >= 2);
    }
  });
});
