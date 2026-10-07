"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { createNode, updateNode } from "@/lib/actions/nodes";
import {
  LibraryAssetPicker,
  type PickerAsset,
  type PickerCategory,
  type PickerTopic,
} from "@/components/library-asset-picker";
import { NodeQuizEditor } from "@/components/node-quiz-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WeekStepper } from "@/components/week-stepper";
import { nodeKindHint, nodeKindLabel } from "@/lib/labels";
import { NodeGateFields } from "@/components/node-gate-fields";
import { PhaseFields } from "@/components/phase-fields";
import type { PhaseOption } from "@/lib/nodes/phases";
import { defaultPassRule } from "@/lib/nodes/pass-rule";
import { MAX_LEVEL_WEEKS, plannedWeeks } from "@/lib/nodes/week-budget";
import type { NodeKind, NodePassRule, NodeStatus } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

export type NodeEditorData = {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  duration_weeks?: number | null;
  kind: NodeKind;
  status: NodeStatus;
  due_date: string | null;
  resource_url?: string | null;
  content_body?: string | null;
  pass_rule?: NodePassRule | null;
  pass_score?: number | null;
  check_in_kind?: string | null;
  phase_key?: string | null;
  node_code?: string | null;
  is_phase_checkpoint?: boolean | null;
};

function FormSectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function normalizeKind(kind: NodeKind): NodeKind {
  return kind === "resource" ? "lesson" : kind;
}

function allowsContent(kind: NodeKind) {
  return (
    kind === "lesson" ||
    kind === "practice" ||
    kind === "call" ||
    kind === "milestone"
  );
}

/** Named fields only; controls inside `[data-dirty-ignore]` (e.g. the quiz editor) save on their own. */
function serializeForm(form: HTMLFormElement): string {
  const parts: string[] = [];
  for (const el of Array.from(form.elements)) {
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }
    if (!el.name || el.disabled || el.closest("[data-dirty-ignore]")) continue;
    if (
      el instanceof HTMLInputElement &&
      (el.type === "checkbox" || el.type === "radio")
    ) {
      if (el.checked) parts.push(`${el.name}=${el.value}`);
      continue;
    }
    parts.push(`${el.name}=${el.value}`);
  }
  return parts.join("\n");
}

export type NodeEditorSaveHandle = { current: (() => Promise<boolean>) | null };

const glassInputClass =
  "border-white/10 bg-black/20 focus-visible:border-white/20 focus-visible:ring-white/10";
const glassSelectClass =
  "h-10 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 text-sm";

export function NodeEditorForm({
  pathId,
  node,
  categories = [],
  topics = [],
  assets = [],
  inline = false,
  idPrefix = "",
  onSuccess,
  className,
  phases = [],
  onDirtyChange,
  saveHandleRef,
  weeksMax,
  hideWeeks = false,
  defaultWeeks,
}: {
  pathId: string;
  node?: NodeEditorData;
  categories?: PickerCategory[];
  topics?: PickerTopic[];
  assets?: PickerAsset[];
  inline?: boolean;
  idPrefix?: string;
  onSuccess?: () => void;
  className?: string;
  phases?: PhaseOption[];
  onDirtyChange?: (dirty: boolean) => void;
  saveHandleRef?: NodeEditorSaveHandle;
  /** Most weeks this level may take (its own + free); omit when the path has no calendar. */
  weeksMax?: number;
  /** The weeks are edited elsewhere (level card); the form leaves them untouched. */
  hideWeeks?: boolean;
  /** Suggested weeks for a new level (e.g. free block size from the calendar). */
  defaultWeeks?: number;
}) {
  const [pending, setPending] = useState(false);
  const [initial] = useState(() => {
    const k = normalizeKind(node?.kind ?? "practice");
    const suggested =
      !node && defaultWeeks != null && defaultWeeks >= 1
        ? Math.min(defaultWeeks, weeksMax ?? MAX_LEVEL_WEEKS)
        : null;
    return {
      kind: k,
      passRule: node?.pass_rule ?? defaultPassRule(k),
      title: node?.title ?? "",
      resourceUrl: node?.resource_url ?? "",
      contentBody: node?.content_body ?? "",
      weeks: suggested ?? plannedWeeks(node?.duration_weeks),
    };
  });
  const [weeks, setWeeks] = useState(initial.weeks);
  const weeksCap = Math.max(1, weeksMax ?? MAX_LEVEL_WEEKS);
  const [kind, setKind] = useState<NodeKind>(initial.kind);
  const [passRule, setPassRule] = useState<NodePassRule>(initial.passRule);
  const [title, setTitle] = useState(initial.title);
  const [resourceUrl, setResourceUrl] = useState(initial.resourceUrl);
  const [contentBody, setContentBody] = useState(initial.contentBody);
  const [pickedAssetId, setPickedAssetId] = useState("");
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const initialFieldsRef = useRef<string | null>(null);
  const isEdit = Boolean(node);
  const noRoom = !isEdit && !hideWeeks && weeksMax != null && weeksMax < 1;

  const dirty =
    fieldsDirty ||
    kind !== initial.kind ||
    passRule !== initial.passRule ||
    title !== initial.title ||
    resourceUrl !== initial.resourceUrl ||
    contentBody !== initial.contentBody ||
    (!hideWeeks && weeks !== initial.weeks) ||
    pickedAssetId !== "";

  useEffect(() => {
    if (formRef.current) initialFieldsRef.current = serializeForm(formRef.current);
  }, []);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function recheckFields() {
    // Wait a frame so state-driven hidden inputs (phase, gate fields) are committed.
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form || initialFieldsRef.current == null) return;
      setFieldsDirty(serializeForm(form) !== initialFieldsRef.current);
    });
  }

  const fieldId = (name: string) =>
    idPrefix ? `${idPrefix}-${name}` : `node-${name}`;

  async function persist(): Promise<boolean> {
    const form = formRef.current;
    if (!form || pending) return false;
    if (noRoom) {
      toast.error("Já não há semanas livres no percurso");
      return false;
    }
    if (!form.reportValidity()) return false;
    const fd = new FormData(form);
    fd.set("kind", kind);
    fd.set("title", title);
    fd.set("resource_url", allowsContent(kind) ? resourceUrl : "");
    fd.set("content_body", allowsContent(kind) ? contentBody : "");
    setPending(true);
    try {
      const result = isEdit ? await updateNode(fd) : await createNode(fd);
      if (result && "ok" in result && !result.ok) {
        toast.error(result.error);
        return false;
      }
      toast.success(isEdit ? "Bloco atualizado" : "Bloco adicionado");
      onSuccess?.();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message || "Não foi possível guardar o bloco");
      return false;
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!saveHandleRef) return;
    saveHandleRef.current = persist;
    return () => {
      saveHandleRef.current = null;
    };
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void persist();
  }

  const inputClass = inline ? glassInputClass : undefined;
  const selectClass = inline
    ? glassSelectClass
    : "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={recheckFields}
      className={cn(inline ? "space-y-3" : "space-y-4", className)}
    >
      <input type="hidden" name="path_id" value={pathId} />
      {node ? <input type="hidden" name="id" value={node.id} /> : null}

      <section className="space-y-3">
      <FormSectionHeading title="Definições do nível" />

      <div className={cn("space-y-2", inline && "space-y-1.5")}>
        <Label htmlFor={fieldId("kind")}>Tipo</Label>
        <select
          id={fieldId("kind")}
          value={kind}
          onChange={(e) => {
            const next = e.target.value as NodeKind;
            setKind(next);
            setPickedAssetId("");
            setPassRule(defaultPassRule(next));
          }}
          className={selectClass}
        >
          <option value="practice">{nodeKindLabel.practice}</option>
          <option value="call">{nodeKindLabel.call}</option>
          <option value="milestone">{nodeKindLabel.milestone}</option>
          <option value="lesson">{nodeKindLabel.lesson}</option>
        </select>
        <p className="text-xs text-muted-foreground">{nodeKindHint[kind]}</p>
      </div>

      <NodeGateFields
        kind={kind}
        passRule={passRule}
        onPassRuleChange={setPassRule}
        checkInKind={node?.check_in_kind}
        passScore={node?.pass_score}
        inputClass={inputClass}
        selectClass={selectClass}
        idPrefix={idPrefix}
      />

      <PhaseFields
        kind={kind}
        phases={phases}
        nodeId={node?.id}
        initialPhaseKey={node?.phase_key}
        initialIsCheckpoint={Boolean(node?.is_phase_checkpoint)}
        selectClass={selectClass}
        inputClass={inputClass}
        idPrefix={idPrefix}
        inline={inline}
      />

      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
        <div className={cn("space-y-2", inline && "space-y-1.5")}>
          <Label htmlFor={fieldId("code")}>Código</Label>
          <Input
            id={fieldId("code")}
            name="node_code"
            defaultValue={node?.node_code ?? ""}
            placeholder="A1"
            className={inputClass}
          />
        </div>
        <div className={cn("min-w-0 space-y-2", inline && "space-y-1.5")}>
          <Label htmlFor={fieldId("title")}>Título</Label>
          <Input
            id={fieldId("title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus={!inline}
            className={inputClass}
          />
        </div>
      </div>

      <div className={cn("space-y-2", inline && "space-y-1.5")}>
        <Label htmlFor={fieldId("description")}>Objetivo do bloco</Label>
        <Textarea
          id={fieldId("description")}
          name="description"
          defaultValue={node?.description ?? ""}
          rows={3}
          className={inputClass}
        />
      </div>

      {hideWeeks ? null : (
        <div className={cn("space-y-2", inline && "space-y-1.5")}>
          <Label>Semanas deste nível</Label>
          {noRoom ? (
            <p className="rounded-lg border border-[var(--neuma-coral)]/30 bg-[var(--neuma-coral)]/10 px-3 py-2 text-sm text-foreground">
              Já não há semanas livres no percurso. Tira semanas a outro nível
              ou aumenta a duração do percurso para criar um novo.
            </p>
          ) : (
            <>
              <WeekStepper
                name="duration_weeks"
                label="Semanas deste nível"
                value={weeks}
                onChange={setWeeks}
                max={weeksCap}
                maxReachedHint="Sem semanas livres no percurso"
              />
              <p className="text-xs text-muted-foreground">
                {weeksMax != null
                  ? `Podes dar até ${weeksCap === 1 ? "1 semana" : `${weeksCap} semanas`} a este nível. `
                  : null}
                A semana de início e a data limite calculam-se sozinhas.
              </p>
            </>
          )}
        </div>
      )}

      {isEdit && (node?.week_number || node?.due_date) ? (
        <p className="text-xs text-muted-foreground">
          {node.week_number ? `Começa na semana ${node.week_number}` : null}
          {node.week_number && node.due_date ? " · " : null}
          {node.due_date ? `limite ${node.due_date}` : null}
        </p>
      ) : null}

      {isEdit ? (
        <div className={cn("space-y-2", inline && "space-y-1.5")}>
          <Label htmlFor={fieldId("status")}>Estado</Label>
          <select
            id={fieldId("status")}
            name="status"
            defaultValue={node?.status ?? "locked"}
            className={selectClass}
          >
            <option value="locked">Bloqueado</option>
            <option value="active">Ativo (aluno ve agora)</option>
            <option value="completed">Concluido</option>
          </select>
        </div>
      ) : null}
      </section>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <FormSectionHeading
          title="Conteúdo"
          hint={
            kind === "call"
              ? "Foco: o aluno agenda e entra no Google Meet. Material e texto são só apoio."
              : kind === "lesson"
                ? "Foco: vídeo em destaque. Escolhe uma aula da biblioteca."
                : kind === "practice"
                  ? "Só aparecem itens de Prática da biblioteca."
                  : "Material de apoio ao check-point (opcional)."
          }
        />

        <LibraryAssetPicker
          nodeKind={kind}
          categories={categories}
          topics={topics}
          assets={assets}
          value={pickedAssetId}
          onChange={(sel) => {
            if (!sel) {
              setPickedAssetId("");
              setResourceUrl("");
              return;
            }
            setPickedAssetId(sel.assetId);
            setResourceUrl(sel.url ?? "");
            if (sel.body) setContentBody(sel.body);
            if (!title.trim()) setTitle(sel.title);
          }}
        />

        {allowsContent(kind) && resourceUrl && !pickedAssetId ? (
          <p className="truncate text-xs text-muted-foreground">
            {kind === "call" || kind === "milestone"
              ? "Anexo de apoio: "
              : "Link: "}
            {resourceUrl}
          </p>
        ) : null}

        {allowsContent(kind) ? (
          <div className={cn("space-y-2", inline && "space-y-1.5")}>
            <Label htmlFor={fieldId("content")}>
              {kind === "call"
                ? "Texto de apoio à sessão"
                : kind === "milestone"
                  ? "Texto de apoio ao check-point"
                  : "Texto para o aluno"}
            </Label>
            <Textarea
              id={fieldId("content")}
              value={contentBody}
              onChange={(e) => setContentBody(e.target.value)}
              rows={4}
              placeholder={
                kind === "call"
                  ? "Notas para o aluno antes ou durante a call…"
                  : "Instruções, contexto ou exercícios deste nível…"
              }
              className={inputClass}
            />
          </div>
        ) : null}

        {(passRule === "quiz" || kind === "milestone") && isEdit && node ? (
          <div data-dirty-ignore>
            <NodeQuizEditor nodeId={node.id} passRule={passRule} />
          </div>
        ) : null}

        {passRule === "quiz" && !isEdit ? (
          <p className="text-xs text-muted-foreground">
            Depois de criar o nível, volta a editar para configurar o quiz.
          </p>
        ) : null}
      </section>

      {inline ? (
        <div className="pt-1">
          <Button
            type="submit"
            disabled={pending || noRoom}
            className="h-11 w-full gap-2 py-3 text-base"
          >
            {pending ? "A guardar..." : isEdit ? "Guardar" : "Criar nível"}
          </Button>
        </div>
      ) : (
        <DialogFooter>
          <Button type="submit" disabled={pending || noRoom} className="w-full sm:w-auto">
            {pending ? "A guardar..." : isEdit ? "Guardar" : "Criar nível"}
          </Button>
        </DialogFooter>
      )}
    </form>
  );
}

export function NodeDialog({
  pathId,
  node,
  categories = [],
  topics = [],
  assets = [],
  phases = [],
  weeksMax,
  defaultWeeks,
  open: openProp,
  onOpenChange,
}: {
  pathId: string;
  node?: NodeEditorData;
  categories?: PickerCategory[];
  topics?: PickerTopic[];
  assets?: PickerAsset[];
  phases?: PhaseOption[];
  weeksMax?: number;
  defaultWeeks?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const isEdit = Boolean(node);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
      }}
    >
      {isEdit ? (
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Editar bloco" />
          }
        >
          <Pencil className="size-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button
              size="sm"
              className="min-w-0 flex-1 gap-2 sm:flex-none"
            />
          }
        >
          <Plus className="size-4 shrink-0" />
          <span className="truncate">Criar novo nível</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          <DialogDescription>
            Cada tipo tem um foco diferente no percurso do aluno.
          </DialogDescription>
        </DialogHeader>
        <NodeEditorForm
          key={formKey}
          pathId={pathId}
          node={node}
          categories={categories}
          topics={topics}
          assets={assets}
          phases={phases}
          weeksMax={weeksMax}
          defaultWeeks={defaultWeeks}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
