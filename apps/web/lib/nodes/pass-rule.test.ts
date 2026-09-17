import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultPassRule,
  parseNodeKind,
  parsePassRule,
} from "./pass-rule.ts";

describe("path gate defaults", () => {
  it("practice defaults to check_in, not mentor", () => {
    assert.equal(defaultPassRule("practice"), "check_in");
    assert.equal(parsePassRule("", "practice"), "check_in");
    assert.equal(parsePassRule("mentor", "practice"), "mentor");
  });

  it("lesson and resource default to seen (none)", () => {
    assert.equal(defaultPassRule("lesson"), "none");
    assert.equal(defaultPassRule("resource"), "none");
  });

  it("call and milestone default to mentor", () => {
    assert.equal(defaultPassRule("call"), "mentor");
    assert.equal(defaultPassRule("milestone"), "mentor");
  });

  it("parses resource kind instead of collapsing to practice", () => {
    assert.equal(parseNodeKind("resource"), "resource");
    assert.equal(parseNodeKind("nope"), "practice");
  });
});
