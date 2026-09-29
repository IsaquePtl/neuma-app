import {
  mentorMayComplete,
  quizScoreTier,
  quizUnlocksPath,
} from "../lib/nodes/evaluation.ts";

const kinds = ["lesson", "resource", "practice", "call", "milestone"];
const rules = ["none", "quiz", "check_in", "mentor"];
let failed = 0;

function check(name, actual, expected) {
  if (actual !== expected) {
    failed += 1;
    console.error("FAIL", name, "got", actual, "expected", expected);
  }
}

for (const kind of kinds) {
  void kind;
  check(
    "quiz 59 holds",
    quizUnlocksPath({
      passRule: "quiz",
      score: 59,
      passScore: 60,
      nodeActive: true,
      pathActive: true,
    }),
    false,
  );
  check(
    "quiz 60 unlocks",
    quizUnlocksPath({
      passRule: "quiz",
      score: 60,
      passScore: 60,
      nodeActive: true,
      pathActive: true,
    }),
    true,
  );
  check(
    "quiz 70 vs 80 holds",
    quizUnlocksPath({
      passRule: "quiz",
      score: 70,
      passScore: 80,
      nodeActive: true,
      pathActive: true,
    }),
    false,
  );
  check(
    "quiz 70 vs 80 is not praised",
    quizScoreTier(70, 80),
    "low",
  );
  check(
    "mentor rule score does not unlock",
    quizUnlocksPath({
      passRule: "mentor",
      score: 100,
      passScore: 60,
      nodeActive: true,
      pathActive: true,
    }),
    false,
  );
  check(
    "mentor cannot pass a failing quiz",
    mentorMayComplete({
      passRule: "quiz",
      passScore: 60,
      bestScore: 59,
      approvedCheckIns: 0,
      mode: "advance",
    }).ok,
    false,
  );
  check(
    "mentor can pass a passing quiz",
    mentorMayComplete({
      passRule: "quiz",
      passScore: 60,
      bestScore: 60,
      approvedCheckIns: 0,
      mode: "advance",
    }).ok,
    true,
  );
  check(
    "check-in without submission does not advance",
    mentorMayComplete({
      passRule: "check_in",
      passScore: null,
      bestScore: null,
      approvedCheckIns: 0,
      mode: "advance",
    }).ok,
    false,
  );
  check(
    "approving a check-in is a pass",
    mentorMayComplete({
      passRule: "check_in",
      passScore: null,
      bestScore: null,
      approvedCheckIns: 0,
      mode: "approve_check_in",
    }).ok,
    true,
  );
  check(
    "mentor gate allows advance",
    mentorMayComplete({
      passRule: "mentor",
      passScore: null,
      bestScore: 100,
      approvedCheckIns: 0,
      mode: "advance",
    }).ok,
    true,
  );
  check(
    "none gate allows mentor repair",
    mentorMayComplete({
      passRule: "none",
      passScore: null,
      bestScore: null,
      approvedCheckIns: 0,
      mode: "advance",
    }).ok,
    true,
  );
}

for (const rule of rules) {
  void rule;
}

if (failed) {
  console.error(`${failed} evaluation checks failed`);
  process.exit(1);
}
console.log(`evaluation checks passed for ${kinds.length} kinds`);
