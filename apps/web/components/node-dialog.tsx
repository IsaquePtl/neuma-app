"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Dumbbell, Flag, Pencil, Phone, Plus, Video } from "lucide-react";
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
import { nodeKindLabel } from "@/lib/labels";
import { NodeGateFields } from "@/components/node-gate-fields";
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
  preview_text?: string | null;
  pass_rule?: NodePassRule | null;
  pass_score?: number | null;
  check_in_kind?: string | null;
  phase_key?: string | null;
  node_code?: string | null;
  is_phase_checkpoint?: boolean | null;
};

function FormSection({
  title,
  panelId,
  className,
  children,
}: {
  title: string;
  panelId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={cn(className, open && "space-y-4")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left shadow-sm shadow-black/20 transition-colors hover:bg-white/10"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      <div id={panelId} hidden={!open} className="space-y-4">
        {children}
      </div>
    </section>
  );
}

function normalizeKind(kind: NodeKind): NodeKind {
  return kind === "resource" ? "lesson" : kind;
}

/** Same icons and tints as the path timeline labels. */
const KIND_CHOICES: {
  value: NodeKind;
  label: string;
  icon: typeof Dumbbell;
  selected: string;
}[] = [
  {
    value: "practice",
    label: nodeKindLabel.practice,
    icon: Dumbbell,
    selected:
      "border-transparent bg-[color-mix(in_srgb,var(--neuma-lime)_22%,transparent)] text-[color-mix(in_srgb,var(--neuma-lime)_38%,var(--neuma-cream))] ring-2 ring-[color-mix(in_srgb,var(--neuma-lime)_50%,var(--neuma-cream))]",
  },
  {
    value: "call",
    label: nodeKindLabel.call,
    icon: Phone,
    selected:
      "border-transparent bg-[color-mix(in_srgb,var(--neuma-coral)_18%,transparent)] text-[color-mix(in_srgb,var(--neuma-coral)_36%,var(--neuma-cream))] ring-2 ring-[color-mix(in_srgb,var(--neuma-coral)_45%,var(--neuma-cream))]",
  },
  {
    value: "milestone",
    label: nodeKindLabel.milestone,
    icon: Flag,
    selected:
      "border-transparent bg-[color-mix(in_srgb,var(--neuma-coral)_18%,transparent)] text-[color-mix(in_srgb,var(--neuma-coral)_36%,var(--neuma-cream))] ring-2 ring-[color-mix(in_srgb,var(--neuma-coral)_45%,var(--neuma-cream))]",
  },
  {
    value: "lesson",
    label: nodeKindLabel.lesson,
    icon: Video,
    selected:
      "border-transparent bg-[color-mix(in_srgb,var(--neuma-coral)_16%,transparent)] text-[var(--neuma-coral)] ring-2 ring-[color-mix(in_srgb,var(--neuma-coral)_55%,transparent)]",
  },
];

function allowsContent(kind: NodeKind) {
  return (
    kind === "lesson" ||
    kind === "practice" ||
    kind === "call" ||
    kind === "milestone"
  );
}

/** The level stores the asset URL, not its id. Match it back when reopening. */
function assetIdForResource(
  url: string | null | undefined,
  assets: PickerAsset[],
): string {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  return assets.find((asset) => asset.url?.trim() === trimmed)?.id ?? "";
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

const glassFieldClass =
  "rounded-xl border-white/10 bg-black/20 px-3 text-sm focus-visible:border-white/20 focus-visible:ring-white/10";
const glassInputClass = cn(glassFieldClass, "h-10");
const glassTextareaClass = cn(glassFieldClass, "min-h-24 py-2.5");

function LevelTextField({
  id,
  kind,
  value,
  onChange,
  itemText,
  hasItem,
  className,
}: {
  id: string;
  kind: NodeKind;
  value: string;
  onChange: (next: string) => void;
  itemText: string;
  hasItem: boolean;
  className?: string;
}) {
  const fallback = itemText.trim();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {kind === "call"
          ? "Texto de apoio à sessão"
          : kind === "milestone"
            ? "Texto de apoio ao check-point"
            : "Texto para o aluno"}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={
          !value.trim() && fallback
            ? fallback
            : kind === "call"
              ? "Notas para o aluno antes ou durante a call…"
              : "Instruções, contexto ou exercícios deste nível…"
        }
        className={className}
      />
      {hasItem ? (
        <Button
          type="button"
          variant="outline"
          className="h-8 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm dark:border-white/10 dark:bg-white/5"
          onClick={() => onChange(itemText)}
        >
          Usar texto do item
        </Button>
      ) : null}
    </div>
  );
}

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
  onDirtyChange,
  saveHandleRef,
  weeksMax,
  hideWeeks = false,
  defaultWeeks,
  onCancel,
  trackedWeeks,
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
  onDirtyChange?: (dirty: boolean) => void;
  saveHandleRef?: NodeEditorSaveHandle;
  /** Most weeks this level may take (its own + free); omit when the path has no calendar. */
  weeksMax?: number;
  /** The weeks are edited elsewhere (level card); the form leaves them untouched. */
  hideWeeks?: boolean;
  /** Suggested weeks for a new level (e.g. free block size from the calendar). */
  defaultWeeks?: number;
  /** Discard local edits and close. Only the inline level editor uses this. */
  onCancel?: () => void;
  /** Week stepper lives on the card. Compared with the stored duration. */
  trackedWeeks?: { current: number; saved: number };
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
      assetId: assetIdForResource(node?.resource_url, assets),
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
  const [status, setStatus] = useState<NodeStatus>(node?.status ?? "locked");
  const [pickedAssetId, setPickedAssetId] = useState(initial.assetId);
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
    (isEdit && status !== (node?.status ?? "locked")) ||
    (!hideWeeks && weeks !== initial.weeks) ||
    (trackedWeeks != null && trackedWeeks.current !== trackedWeeks.saved) ||
    pickedAssetId !== initial.assetId;

  useEffect(() => {
    if (formRef.current) initialFieldsRef.current = serializeForm(formRef.current);
  }, []);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function recheckFields() {
    // Wait a frame so state-driven hidden inputs (gate fields) are committed.
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
    if (
      trackedWeeks &&
      trackedWeeks.current !== trackedWeeks.saved
    ) {
      fd.set("duration_weeks", String(trackedWeeks.current));
    }
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
  const textareaClass = inline ? glassTextareaClass : undefined;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={recheckFields}
      className={cn(inline ? "space-y-6" : "space-y-4", className)}
    >
      <input type="hidden" name="path_id" value={pathId} />
      {node ? <input type="hidden" name="id" value={node.id} /> : null}

      <div className="space-y-2">
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

      <FormSection title="Definições do nível" panelId={fieldId("definitions")}>

      <div className="space-y-2">
        <Label id={fieldId("kind")}>Tipo</Label>
        <div
          role="radiogroup"
          aria-labelledby={fieldId("kind")}
          className="grid grid-cols-2 gap-2"
        >
          {KIND_CHOICES.map((choice) => {
            const selected = kind === choice.value;
            const Icon = choice.icon;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (choice.value === kind) return;
                  setKind(choice.value);
                  if (pickedAssetId) {
                    setPickedAssetId("");
                    setResourceUrl("");
                  }
                }}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium",
                  selected
                    ? choice.selected
                    : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {choice.label}
              </button>
            );
          })}
        </div>
      </div>

      <NodeGateFields
        kind={kind}
        passRule={passRule}
        onPassRuleChange={setPassRule}
        checkInKind={node?.check_in_kind}
        passScore={node?.pass_score}
        inputClass={inputClass}
        idPrefix={idPrefix}
      />

      <div className="space-y-2">
        <Label htmlFor={fieldId("preview")}>Texto de preview</Label>
        <Textarea
          id={fieldId("preview")}
          name="preview_text"
          defaultValue={node?.preview_text ?? ""}
          rows={3}
          className={textareaClass}
        />
      </div>

      {hideWeeks ? null : (
        <div className="space-y-2">
          <Label>Semanas deste nível</Label>
          {noRoom ? (
            <p className="rounded-xl border border-[var(--neuma-coral)]/30 bg-[var(--neuma-coral)]/10 px-3 py-2 text-sm text-foreground">
              Já não há semanas livres no percurso. Tira semanas a outro nível
              ou aumenta a duração do percurso para criar um novo.
            </p>
          ) : (
            <WeekStepper
              name="duration_weeks"
              label="Semanas deste nível"
              value={weeks}
              onChange={setWeeks}
              max={weeksCap}
              maxReachedHint="Sem semanas livres no percurso"
            />
          )}
        </div>
      )}

      {isEdit ? (
        <div className="space-y-2">
          <Label id={fieldId("status-label")}>Estado</Label>
          <input type="hidden" name="status" value={status} />
          <div
            role="radiogroup"
            aria-labelledby={fieldId("status-label")}
            className="flex gap-2"
          >
            {(
              [
                ["locked", "Bloqueado"],
                ["active", "Ativo"],
                ["completed", "Concluído"],
              ] as const
            ).map(([value, label]) => {
              const selected = status === value;
              const selectedClass =
                value === "locked"
                  ? "border-destructive/55 bg-destructive/20 font-medium text-foreground"
                  : value === "active"
                    ? "border-white/55 bg-white/20 font-medium text-foreground"
                    : "border-emerald-500/55 bg-emerald-500/20 font-medium text-foreground";
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "h-10 min-w-0 flex-1 rounded-xl border px-2 text-sm whitespace-nowrap",
                    selected
                      ? selectedClass
                      : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      </FormSection>

      <FormSection title="Conteúdo" panelId={fieldId("content-panel")}>

        <input type="hidden" name="library_asset_id" value={pickedAssetId} />

        <LibraryAssetPicker
          key={kind}
          nodeKind={kind}
          categories={categories}
          topics={topics}
          assets={assets}
          value={pickedAssetId}
          initialAssetId={initial.assetId}
          onChange={(sel) => {
            if (!sel) {
              setPickedAssetId("");
              setResourceUrl("");
              return;
            }
            setPickedAssetId(sel.assetId);
            setResourceUrl(sel.url ?? "");
            if (!title.trim()) setTitle(sel.title);
          }}
        />

        {allowsContent(kind) ? (
          <LevelTextField
            id={fieldId("content")}
            kind={kind}
            value={contentBody}
            onChange={setContentBody}
            itemText={
              assets.find((asset) => asset.id === pickedAssetId)?.body ?? ""
            }
            hasItem={Boolean(pickedAssetId)}
            className={textareaClass}
          />
        ) : null}

        {passRule === "quiz" && kind !== "call" && isEdit && node ? (
          <div data-dirty-ignore>
            <NodeQuizEditor nodeId={node.id} passRule={passRule} />
          </div>
        ) : null}

        {passRule === "quiz" && !isEdit ? (
          <p className="text-xs text-muted-foreground">
            Depois de criar o nível, volta a editar para configurar o quiz.
          </p>
        ) : null}
      </FormSection>

      {inline ? (
        <div className="flex gap-2 pt-1">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm dark:border-white/10 dark:bg-white/5"
              onClick={onCancel}
            >
              Cancelar
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={pending || noRoom || (isEdit && !dirty)}
            variant={isEdit && !dirty ? "outline" : "default"}
            className={cn(
              "h-11 flex-1 rounded-xl px-4 text-sm",
              isEdit &&
                !dirty &&
                "border-white/10 bg-white/5 text-muted-foreground dark:border-white/10 dark:bg-white/5",
            )}
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
  weeksMax,
  defaultWeeks,
  open: openProp,
  onOpenChange,
  triggerClassName,
  showTrigger = true,
}: {
  pathId: string;
  node?: NodeEditorData;
  categories?: PickerCategory[];
  topics?: PickerTopic[];
  assets?: PickerAsset[];
  weeksMax?: number;
  defaultWeeks?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  /** Calendar can open the dialog without a header button. */
  showTrigger?: boolean;
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
      {showTrigger && isEdit ? (
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Editar bloco" />
          }
        >
          <Pencil className="size-4" />
        </DialogTrigger>
      ) : null}
      {showTrigger && !isEdit ? (
        <DialogTrigger
          render={
            <Button
              size="sm"
              className={cn(
                "min-w-0 flex-1 gap-2 sm:flex-none",
                triggerClassName,
              )}
            />
          }
        >
          <Plus className="size-4 shrink-0" />
          <span className="truncate">Criar novo nível</span>
        </DialogTrigger>
      ) : null}
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
          weeksMax={weeksMax}
          defaultWeeks={defaultWeeks}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
