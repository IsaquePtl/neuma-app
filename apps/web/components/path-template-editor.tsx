"use client";

import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Trash2,
} from "lucide-react";

import { PathTemplateForm } from "@/components/path-template-form";
import { TemplateNodeDialog } from "@/components/template-node-dialog";
import { NodeKindBadge } from "@/components/status-badges";
import {
  deletePathTemplate,
  deleteTemplateNode,
  moveTemplateNode,
  setPathTemplateStatus,
} from "@/lib/actions/path-templates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  PickerAsset,
  PickerCategory,
  PickerTopic,
} from "@/components/library-asset-picker";
import type {
  NodeKind,
  PathTemplateStatus,
} from "@/lib/types/database.types";

type Template = {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_label: string | null;
  suggested_node_count: number | null;
  status: PathTemplateStatus;
};

type TemplateNode = {
  id: string;
  title: string;
  description: string | null;
  kind: NodeKind;
  week_number: number | null;
  duration_weeks: number | null;
  order_index: number;
  default_resource_url: string | null;
  library_asset_id: string | null;
  asset_title: string | null;
};

export function PathTemplateEditor({
  template,
  nodes,
  categories,
  topics,
  assets,
}: {
  template: Template;
  nodes: TemplateNode[];
  categories: PickerCategory[];
  topics: PickerTopic[];
  assets: PickerAsset[];
}) {
  return (
    <div className="space-y-4">
      <Card className="neuma-accent-top space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-semibold">{template.title}</h2>
            {template.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {template.description}
              </p>
            ) : null}
            {template.goal ? (
              <p className="text-sm text-muted-foreground">
                Objectivo: {template.goal}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {[template.duration_label, `${nodes.length} níveis`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <PathTemplateForm template={template} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
          {(
            [
              ["draft", "Rascunho"],
              ["ready", "Pronto"],
              ["archived", "Arquivar"],
            ] as const
          ).map(([status, label]) => (
            <form key={status} action={setPathTemplateStatus}>
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="status" value={status} />
              <Button
                type="submit"
                size="sm"
                variant={template.status === status ? "default" : "outline"}
                disabled={template.status === status}
              >
                {label}
              </Button>
            </form>
          ))}
          <form
            action={deletePathTemplate}
            className="ml-auto"
            onSubmit={(e) => {
              if (
                !confirm(
                  "Apagar este template? O template será arquivado e sai da lista.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={template.id} />
            <input type="hidden" name="redirect_to" value="/studio/library" />
            <Button type="submit" size="sm" variant="destructive">
              Apagar
            </Button>
          </form>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          Níveis{" "}
          <span className="text-muted-foreground">({nodes.length})</span>
        </h3>
        <TemplateNodeDialog
          templateId={template.id}
          categories={categories}
          topics={topics}
          assets={assets}
        />
      </div>

      {nodes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Ainda sem níveis. Adiciona o primeiro passo do currículo.
        </Card>
      ) : (
        <div className="space-y-2">
          {nodes.map((n, i) => (
            <Card key={n.id} className="flex items-start gap-3 p-4">
              <div className="flex flex-col gap-1 pt-0.5">
                <form action={moveTemplateNode}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="template_id" value={template.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    disabled={i === 0}
                    aria-label="Subir"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                </form>
                <form action={moveTemplateNode}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="template_id" value={template.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    disabled={i === nodes.length - 1}
                    aria-label="Descer"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </form>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    #{i + 1}
                    {n.week_number != null ? ` · Sem. ${n.week_number}` : ""}
                  </span>
                  <NodeKindBadge kind={n.kind} />
                </div>
                <p className="font-medium">{n.title}</p>
                {n.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {n.description}
                  </p>
                ) : null}
                {n.asset_title ? (
                  <p className="text-xs text-muted-foreground">
                    Biblioteca: {n.asset_title}
                  </p>
                ) : n.default_resource_url ? (
                  <a
                    href={n.default_resource_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    URL <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <TemplateNodeDialog
                  templateId={template.id}
                  node={n}
                  categories={categories}
                  topics={topics}
                  assets={assets}
                />
                <form
                  action={deleteTemplateNode}
                  onSubmit={(e) => {
                    if (!confirm("Eliminar este nível?")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="template_id" value={template.id} />
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
