"use client";

import { useState } from "react";
import { AlertTriangle, Link2, Unlink } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  normalizePhaseKey,
  suggestNextPhaseKey,
  type PhaseOption,
} from "@/lib/nodes/phases";
import type { NodeKind, NodePassRule } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

const NEW_PHASE = "__new__";

/**
 * Phase picker + checkpoint link. Emits `phase_key` and `is_phase_checkpoint`.
 * The server keeps the invariants (phase contiguous, one checkpoint, last).
 */
export function PhaseFields({
  kind,
  passRule,
  phases,
  nodeId,
  initialPhaseKey,
  initialIsCheckpoint = false,
  selectClass,
  inputClass,
  idPrefix = "",
  inline = false,
}: {
  kind: NodeKind;
  passRule: NodePassRule;
  phases: PhaseOption[];
  nodeId?: string;
  initialPhaseKey?: string | null;
  initialIsCheckpoint?: boolean;
  selectClass: string;
  inputClass?: string;
  idPrefix?: string;
  inline?: boolean;
}) {
  const initialKey = normalizePhaseKey(initialPhaseKey);
  const knownKeys = phases.map((p) => p.key);
  const [choice, setChoice] = useState<string>(
    initialKey ? (knownKeys.includes(initialKey) ? initialKey : NEW_PHASE) : "",
  );
  const [newKey, setNewKey] = useState(
    initialKey && !knownKeys.includes(initialKey)
      ? initialKey
      : suggestNextPhaseKey(phases),
  );
  const phaseKey =
    choice === NEW_PHASE ? normalizePhaseKey(newKey) : choice || null;
  const phase = phases.find((p) => p.key === phaseKey) ?? null;
  const otherCheckpoint =
    phase?.checkpoint && phase.checkpoint.id !== nodeId ? phase.checkpoint : null;

  // New milestone in a phase without a checkpoint: closing it is the natural default.
  const [linkChoice, setLinkChoice] = useState<boolean | null>(
    nodeId ? initialIsCheckpoint : null,
  );
  const quizClosesPhase = kind !== "call" && passRule === "quiz";
  const closesPhase =
    quizClosesPhase && Boolean(phaseKey) && (linkChoice ?? !otherCheckpoint);

  const fieldId = (name: string) =>
    idPrefix ? `${idPrefix}-${name}` : `node-${name}`;
  const label = phaseKey ? `Fase ${phaseKey}` : "";

  return (
    <div className={cn("space-y-2", inline && "space-y-1.5")}>
      <input type="hidden" name="phase_key" value={phaseKey ?? ""} />
      <input type="hidden" name="is_phase_checkpoint" value={closesPhase ? "1" : ""} />

      <Label htmlFor={fieldId("phase")}>Fase</Label>
      <div className="flex gap-2">
        <select
          id={fieldId("phase")}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setLinkChoice(null);
          }}
          className={selectClass}
        >
          <option value="">Sem fase</option>
          {phases.map((p) => (
            <option key={p.key} value={p.key}>
              Fase {p.key} · {p.count} {p.count === 1 ? "nível" : "níveis"}
              {p.checkpoint ? " · com fecho" : ""}
            </option>
          ))}
          <option value={NEW_PHASE}>+ Nova fase…</option>
        </select>
        {choice === NEW_PHASE ? (
          <Input
            aria-label="Nome da nova fase"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            maxLength={8}
            placeholder="A"
            className={cn("w-20 shrink-0 uppercase", inputClass)}
          />
        ) : null}
      </div>

      {quizClosesPhase ? (
        phaseKey ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ligação à fase">
              <button
                type="button"
                role="radio"
                aria-checked={closesPhase}
                onClick={() => setLinkChoice(true)}
                className={cn(
                  "flex min-h-11 min-w-0 items-center rounded-xl border px-4 text-left transition-colors",
                  closesPhase
                    ? "border-[var(--neuma-coral)]/55 bg-[var(--neuma-coral)]/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Link2 className="size-4 text-[var(--neuma-coral)]" />
                  Fecha a {label}
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!closesPhase}
                onClick={() => setLinkChoice(false)}
                className={cn(
                  "flex min-h-11 min-w-0 items-center rounded-xl border px-4 text-left transition-colors",
                  !closesPhase
                    ? "border-white/25 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Unlink className="size-4 text-muted-foreground" />
                  Quiz solto
                </span>
              </button>
            </div>
            {closesPhase && otherCheckpoint ? (
              <p className="flex items-start gap-2 rounded-xl border border-[var(--neuma-orange)]/30 bg-[var(--neuma-orange)]/10 px-3 py-2 text-sm leading-snug text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--neuma-orange)]" />
                <span>
                  Substitui «{otherCheckpoint.title}» como fecho da {label}{" "}
                  (passa a quiz solto).
                </span>
              </p>
            ) : null}
          </div>
        ) : null
      ) : null}
    </div>
  );
}
