"use client";

import { useState } from "react";
import { AlertTriangle, Flag, Link2, Unlink } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  normalizePhaseKey,
  suggestNextPhaseKey,
  type PhaseOption,
} from "@/lib/nodes/phases";
import type { NodeKind } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

const NEW_PHASE = "__new__";

/**
 * Phase picker + checkpoint link. Emits `phase_key` and `is_phase_checkpoint`.
 * The server keeps the invariants (phase contiguous, one checkpoint, last).
 */
export function PhaseFields({
  kind,
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
  const closesPhase =
    kind === "milestone" &&
    Boolean(phaseKey) &&
    (linkChoice ?? !otherCheckpoint);

  const fieldId = (name: string) =>
    idPrefix ? `${idPrefix}-${name}` : `node-${name}`;
  const label = phaseKey ? `Fase ${phaseKey}` : "";
  const othersInPhase = phase
    ? phase.count - (nodeId && normalizePhaseKey(initialPhaseKey) === phaseKey ? 1 : 0)
    : 0;

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
              {p.checkpoint ? " · com check-point" : ""}
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

      {kind === "milestone" ? (
        phaseKey ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ligação à fase">
              <button
                type="button"
                role="radio"
                aria-checked={closesPhase}
                onClick={() => setLinkChoice(true)}
                className={cn(
                  "flex min-w-0 flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                  closesPhase
                    ? "border-[var(--neuma-coral)]/55 bg-[var(--neuma-coral)]/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Link2 className="size-3.5 text-[var(--neuma-coral)]" />
                  Fecha a {label}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Fica no fim da fase. Se falhar, o aluno revê os níveis da fase e
                  repete.
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!closesPhase}
                onClick={() => setLinkChoice(false)}
                className={cn(
                  "flex min-w-0 flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                  !closesPhase
                    ? "border-white/25 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Unlink className="size-3.5 text-muted-foreground" />
                  Check-point solto
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Só o quiz. Se falhar, repete logo.
                </span>
              </button>
            </div>
            {closesPhase && otherCheckpoint ? (
              <p className="flex items-start gap-2 rounded-lg border border-[var(--neuma-orange)]/30 bg-[var(--neuma-orange)]/10 px-3 py-2 text-xs leading-snug text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--neuma-orange)]" />
                <span>
                  Substitui «{otherCheckpoint.title}» como check-point da {label}{" "}
                  (passa a solto).
                </span>
              </p>
            ) : closesPhase ? (
              <p className="text-xs text-muted-foreground">
                {othersInPhase > 0
                  ? `Liga-se aos ${othersInPhase} ${othersInPhase === 1 ? "nível" : "níveis"} da ${label} e passa para o fim da fase.`
                  : `Os níveis que juntares à ${label} ficam antes deste check-point.`}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem fase → check-point solto (só o quiz). Escolhe uma fase para o
            ligar aos níveis dela.
          </p>
        )
      ) : phase?.checkpoint && phase.checkpoint.id !== nodeId ? (
        <p className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
          <Flag className="mt-0.5 size-3 shrink-0 text-[var(--neuma-coral)]" />
          Entra na {label} antes do check-point «{phase.checkpoint.title}».
        </p>
      ) : null}
    </div>
  );
}
