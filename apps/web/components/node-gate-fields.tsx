"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passRuleLabel } from "@/lib/labels";
import {
  DEFAULT_QUIZ_PASS_SCORE,
  defaultPassRule,
} from "@/lib/nodes/pass-rule";
import type { NodeKind, NodePassRule } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

export function NodeGateFields({
  kind,
  passRule,
  onPassRuleChange,
  checkInKind,
  passScore,
  inputClass,
  selectClass,
  idPrefix = "",
}: {
  kind: NodeKind;
  passRule: NodePassRule;
  onPassRuleChange: (next: NodePassRule) => void;
  checkInKind?: string | null;
  passScore?: number | null;
  inputClass?: string;
  selectClass?: string;
  idPrefix?: string;
}) {
  const fid = (name: string) => (idPrefix ? `${idPrefix}-${name}` : name);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={fid("pass_rule")}>Regra de passagem</Label>
        <select
          id={fid("pass_rule")}
          name="pass_rule"
          value={passRule}
          onChange={(e) => onPassRuleChange(e.target.value as NodePassRule)}
          className={selectClass}
        >
          <option value="mentor">{passRuleLabel.mentor} — só o mentor avança</option>
          <option value="none">{passRuleLabel.none} — aluno marca visto</option>
          <option value="check_in">{passRuleLabel.check_in} — mentor aprova o envio</option>
          <option value="quiz">{passRuleLabel.quiz} — nota ≥ limiar avança</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Padrão para {kind}: {passRuleLabel[defaultPassRule(kind)]}. O mentor
          pode sempre usar «Avançar nível».
        </p>
      </div>

      {passRule === "check_in" ? (
        <div className="space-y-1.5">
          <Label htmlFor={fid("check_in_kind")}>Tipo de check-in</Label>
          <select
            id={fid("check_in_kind")}
            name="check_in_kind"
            defaultValue={checkInKind === "text" ? "text" : "video"}
            className={selectClass}
          >
            <option value="video">Vídeo (quando é para tocar)</option>
            <option value="text">Texto (escuta / sem tocar)</option>
          </select>
        </div>
      ) : (
        <input type="hidden" name="check_in_kind" value="none" />
      )}

      {passRule === "quiz" ? (
        <div className="space-y-1.5">
          <Label htmlFor={fid("pass_score")}>
            Nota mínima ({DEFAULT_QUIZ_PASS_SCORE}% se vazio)
          </Label>
          <Input
            id={fid("pass_score")}
            name="pass_score"
            type="number"
            min={0}
            max={100}
            defaultValue={passScore ?? DEFAULT_QUIZ_PASS_SCORE}
            className={cn(inputClass)}
          />
        </div>
      ) : null}
    </div>
  );
}
