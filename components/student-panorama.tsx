"use client";

import Link from "next/link";
import {
  ClipboardList,
  ExternalLink,
  Inbox,
  Route,
  StickyNote,
} from "lucide-react";

import { StudentProfileEditor } from "@/components/student-profile-editor";
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
  const current =
    nodes.find((n) => n.status === "active") ??
    nodes.filter((n) => n.status === "completed").at(-1) ??
    null;
  const done = nodes.filter((n) => n.status === "completed").length;

  return (
    <div className="grid gap-4 sm:gap-5 desktop:grid-cols-2 desktop:items-stretch">
      {/* Percurso */}
      <Card className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={Route}
          title="Percurso"
          subtitle="Resumo — detalhe em Percursos"
        />

        <div className="flex flex-1 flex-col gap-4">
          {!path ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-white/[0.03] p-6 text-center ring-1 ring-white/8">
              <p className="text-sm text-muted-foreground">
                Ainda não há percurso. Aplica um template ou cria um plano
                vazio.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ApplyTemplateDialog
                  studentId={student.id}
                  templates={readyTemplates}
                />
                <PathForm studentId={student.id} triggerClassName="gap-2" />
              </div>
              {readyTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem templates.{" "}
                  <Link
                    href="/studio/paths#templates"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Criar na Biblioteca
                  </Link>
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-base font-semibold sm:text-lg">
                    {path.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {done}/{nodes.length} níveis
                  </p>
                </div>
                <PathStatusBadge status={path.status} />
              </div>

              {current ? (
                <div className="rounded-xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Nível atual
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <p className="font-medium">{current.title}</p>
                    <NodeStatusBadge status={current.status} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem níveis ainda.</p>
              )}

              <div className="mt-auto pt-1">
                <Button
                  render={<Link href={`/studio/journeys/${path.id}`} />}
                  nativeButton={false}
                  className="w-full gap-1.5"
                >
                  Abrir percurso <ExternalLink className="size-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Check-ins */}
      <Card className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={Inbox}
          title="Check-ins"
          subtitle={
            pendingCount > 0
              ? `${pendingCount} por rever · ${checkIns.length} no total`
              : `${checkIns.length} no total`
          }
        />

        <div className="flex flex-1 flex-col gap-2">
          {pending.length > 0 ? (
            <>
              {pending.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/8"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.node_title ?? "Bloco"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {checkInKindLabel[c.kind]} ·{" "}
                      {formatDateTime(c.created_at)}
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
              <Link
                href="/studio/journeys/checkins"
                className="mt-auto pt-2 text-xs text-[var(--neuma-coral)] underline-offset-4 hover:underline"
              >
                Ver todos em Percursos
              </Link>
            </>
          ) : checkIns.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl bg-white/[0.03] p-6 text-center text-sm text-muted-foreground ring-1 ring-white/8">
              Ainda sem check-ins deste aluno.
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl bg-white/[0.03] p-4 text-sm text-muted-foreground ring-1 ring-white/8">
              <p>Sem check-ins pendentes.</p>
              <Link
                href="/studio/journeys/checkins"
                className="text-[var(--neuma-coral)] underline-offset-4 hover:underline"
              >
                Ver todos em Percursos
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Forms */}
      <Card className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={ClipboardList}
          title="Forms e diagnóstico"
          subtitle={
            formBlocks.length > 0
              ? `${formBlocks.length} resposta(s)`
              : "Sem respostas ainda"
          }
        />

        <div className="flex flex-1 flex-col gap-2">
          {formBlocks.length === 0 ? (
            <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl bg-white/[0.03] p-4 text-sm text-muted-foreground ring-1 ring-white/8">
              <p>Onboardings e forms ligados a este aluno aparecem aqui.</p>
              <Link
                href="/studio/journeys/onboardings"
                className="text-[var(--neuma-coral)] underline-offset-4 hover:underline"
              >
                Abrir Onboardings
              </Link>
            </div>
          ) : (
            <>
              {formBlocks.slice(0, 3).map((block) => (
                <div
                  key={block.id}
                  className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/8"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {block.form_title}
                      </p>
                      {block.is_onboarding ? (
                        <p className="text-xs text-[var(--neuma-coral)]">
                          Onboarding
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(block.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              {formBlocks.length > 3 ? (
                <p className="text-xs text-muted-foreground">
                  +{formBlocks.length - 3} mais
                </p>
              ) : null}
            </>
          )}
        </div>
      </Card>

      {/* Perfil */}
      <Card className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <PanelHeader
          icon={StickyNote}
          title="Perfil"
          subtitle="Nome e onboarding"
        />
        <div className="min-w-0 flex-1">
          <StudentProfileEditor student={student} embedded />
        </div>
      </Card>
    </div>
  );
}
