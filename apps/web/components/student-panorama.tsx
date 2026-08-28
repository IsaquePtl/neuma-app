"use client";

import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  ExternalLink,
  Inbox,
  Layers,
  Route,
  StickyNote,
} from "lucide-react";

import { StudentNotesField } from "@/components/student-notes-field";
import {
  ApplyTemplateDialog,
  type ReadyTemplate,
} from "@/components/apply-template-dialog";
import { PathForm } from "@/components/path-form";
import { PathStatusBadge, NodeStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";
import type {
  StudentCheckIn,
  StudentFormBlock,
  StudentNode,
  StudentPath,
  StudentProfile,
} from "@/lib/students/queries";
import type { LucideIcon } from "lucide-react";

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-white/8 pb-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold leading-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function StudentPanorama({
  student,
  path,
  nodes,
  checkIns,
  formBlocks,
  pendingCount,
  readyTemplates = [],
}: {
  student: StudentProfile;
  path: StudentPath | null;
  nodes: StudentNode[];
  checkIns: StudentCheckIn[];
  formBlocks: StudentFormBlock[];
  pendingCount: number;
  readyTemplates?: ReadyTemplate[];
  libraryCategories?: unknown[];
  libraryTopics?: unknown[];
  libraryAssets?: unknown[];
}) {
  const pending = checkIns.filter((c) => c.status === "pending");
  const onboardingBlocks = formBlocks.filter((b) => b.is_onboarding);
  const current =
    nodes.find((n) => n.status === "active") ??
    nodes.filter((n) => n.status === "completed").at(-1) ??
    null;
  const done = nodes.filter((n) => n.status === "completed").length;

  return (
    <div className="grid gap-4 sm:gap-5">
      {/* Notas */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={StickyNote}
          title="Notas"
          subtitle="Prompt / contexto para o agent montar o percurso"
        />
        <StudentNotesField
          studentId={student.id}
          initialNotes={student.internal_notes}
          rows={6}
          placeholder="Notas / prompt para o agent montar o percurso…"
        />
        <p className="text-xs text-muted-foreground">
          Depois do onboarding confirmado, escreve aqui o que o agent precisa
          para desenhar o percurso.
        </p>
      </Card>

      {/* Progresso níveis */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={Layers}
          title="Progresso níveis"
          subtitle={
            path
              ? `${done}/${nodes.length} concluídos`
              : "Sem percurso activo"
          }
        />
        {!path || nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            O progresso aparece quando o percurso tiver níveis.
          </p>
        ) : (
          <ul className="space-y-2">
            {nodes.slice(0, 8).map((n, i) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/8"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {i + 1}. {n.title}
                  </p>
                </div>
                <NodeStatusBadge status={n.status} />
              </li>
            ))}
            {nodes.length > 8 ? (
              <p className="text-xs text-muted-foreground">
                +{nodes.length - 8} níveis
              </p>
            ) : null}
          </ul>
        )}
      </Card>

      {/* Por rever */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={Inbox}
          title="Por rever"
          subtitle={
            pendingCount > 0
              ? `${pendingCount} check-in(s) pendente(s)`
              : "Nada por rever"
          }
        />
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem check-ins à espera de avaliação.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/8"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.node_title ?? "Check-in"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {checkInKindLabel[c.kind]} · {formatDateTime(c.created_at)}
                  </p>
                </div>
                <Button
                  render={
                    <Link
                      href={`/studio/checkins/${c.id}?from=student&student=${student.id}`}
                    />
                  }
                  nativeButton={false}
                  size="sm"
                  className="shrink-0"
                >
                  Avaliar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Onboarding */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={ClipboardList}
          title="Onboarding"
          subtitle={
            student.onboarding_completed
              ? "Confirmado no perfil"
              : onboardingBlocks.length > 0
                ? "Respostas ligadas — confirma se ainda não o fizeste"
                : "Ainda sem onboarding vinculado"
          }
        />
        {onboardingBlocks.length === 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Quando houver uma submissão Tally ligada a este aluno, aparece aqui.</p>
            <Link
              href="/studio/journeys/onboardings"
              className="text-[var(--neuma-coral)] underline-offset-4 hover:underline"
            >
              Abrir Onboardings
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {onboardingBlocks.map((block) => (
              <Link
                key={block.id}
                href={`/studio/intake/${block.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/8 transition-colors hover:bg-white/[0.05]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {block.form_title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(block.created_at)}
                  </p>
                </div>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Percurso — zona única (detalhe no próximo passo) */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={Route}
          title="Percurso"
          subtitle="Zona do percurso deste aluno"
        />

        {!path ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-white/[0.03] p-6 text-center ring-1 ring-white/8">
            <p className="text-sm text-muted-foreground">
              Ainda não há percurso. Aplica um template ou cria um plano vazio.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ApplyTemplateDialog
                studentId={student.id}
                templates={readyTemplates}
              />
              <PathForm studentId={student.id} triggerClassName="gap-2" />
            </div>
          </div>
        ) : (
          <Link
            href={`/studio/journeys/${path.id}`}
            aria-label={`Abrir percurso ${path.title}`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-base font-semibold">{path.title}</h3>
                <PathStatusBadge status={path.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {done}/{nodes.length} níveis
                {current ? ` · actual: ${current.title}` : ""}
              </p>
            </div>
            <ArrowRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </Link>
        )}
      </Card>
    </div>
  );
}
