"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passRuleLabel } from "@/lib/labels";
import { DEFAULT_QUIZ_PASS_SCORE } from "@/lib/nodes/pass-rule";
import type { NodeKind, NodePassRule } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

function initialCheckInKind(value?: string | null): "video" | "text" | "call" {
  if (value === "text" || value === "call") return value;
  return "video";
}

const PASS_RULE_CHOICES: { value: NodePassRule; label: string }[] = [
  { value: "mentor", label: passRuleLabel.mentor },
  { value: "none", label: passRuleLabel.none },
  { value: "check_in", label: passRuleLabel.check_in },
  { value: "quiz", label: passRuleLabel.quiz },
];

const CHECK_IN_CHOICES: { value: "video" | "text" | "call"; label: string }[] = [
  { value: "video", label: "Vídeo" },
  { value: "text", label: "Texto" },
  { value: "call", label: "Chamada" },
];

const passRuleSelectedClass =
  "border-white/55 bg-white/20 font-medium text-foreground";

export function NodeGateFields({
  kind,
  passRule,
  onPassRuleChange,
  checkInKind,
  passScore,
  inputClass,
  idPrefix = "",
}: {
  kind: NodeKind;
  passRule: NodePassRule;
  onPassRuleChange: (next: NodePassRule) => void;
  checkInKind?: string | null;
  passScore?: number | null;
  inputClass?: string;
  idPrefix?: string;
}) {
  const fid = (name: string) => (idPrefix ? `${idPrefix}-${name}` : name);
  const passRuleInputRef = useRef<HTMLInputElement>(null);
  const checkInKindInputRef = useRef<HTMLInputElement>(null);
  const [checkInKindValue, setCheckInKindValue] = useState(() =>
    initialCheckInKind(checkInKind),
  );
  const [score, setScore] = useState(
    passScore != null ? String(passScore) : String(DEFAULT_QUIZ_PASS_SCORE),
  );

  if (kind === "call") {
    return (
      <div className="hidden">
        <input type="hidden" name="pass_rule" value="mentor" />
        <input type="hidden" name="check_in_kind" value="none" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label id={fid("pass_rule-label")}>Regra de passagem</Label>
        <input
          ref={passRuleInputRef}
          type="hidden"
          name="pass_rule"
          value={passRule}
        />
        <div
          id={fid("pass_rule")}
          role="radiogroup"
          aria-labelledby={fid("pass_rule-label")}
          className="flex gap-2"
        >
          {PASS_RULE_CHOICES.map((choice) => {
            const selected = passRule === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  flushSync(() => {
                    onPassRuleChange(choice.value);
                  });
                  passRuleInputRef.current?.dispatchEvent(
                    new Event("change", { bubbles: true }),
                  );
                }}
                className={cn(
                  "h-10 min-w-0 flex-1 rounded-xl border px-2 text-sm whitespace-nowrap",
                  selected
                    ? passRuleSelectedClass
                    : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
                )}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      </div>

      {passRule === "check_in" ? (
        <div className="space-y-2">
          <Label id={fid("check_in_kind-label")}>Tipo de check-in</Label>
          <input
            ref={checkInKindInputRef}
            type="hidden"
            name="check_in_kind"
            value={checkInKindValue}
          />
          <div
            role="radiogroup"
            aria-labelledby={fid("check_in_kind-label")}
            className="flex gap-2"
          >
            {CHECK_IN_CHOICES.map((choice) => {
              const selected = checkInKindValue === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    flushSync(() => {
                      setCheckInKindValue(choice.value);
                    });
                    checkInKindInputRef.current?.dispatchEvent(
                      new Event("change", { bubbles: true }),
                    );
                  }}
                  className={cn(
                    "h-10 min-w-0 flex-1 rounded-xl border px-2 text-sm whitespace-nowrap",
                    selected
                      ? passRuleSelectedClass
                      : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
                  )}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <input type="hidden" name="check_in_kind" value="none" />
      )}

      {passRule === "quiz" ? (
        <div className="space-y-2">
          <Label htmlFor={fid("pass_score")}>Nota mínima</Label>
          <Input
            id={fid("pass_score")}
            name="pass_score"
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder={String(DEFAULT_QUIZ_PASS_SCORE)}
            className={cn(inputClass)}
          />
        </div>
      ) : null}
    </div>
  );
}
