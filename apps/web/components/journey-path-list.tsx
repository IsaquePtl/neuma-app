"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { IntentLink } from "@/components/intent-link";
import { JourneyPathRowActions } from "@/components/journey-path-row-actions";
import type { StudentOption } from "@/components/tally-submission-row-actions";
import { PathStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import type { PathStatus } from "@/lib/types/database.types";

const journeyTableGridClass =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_2.5rem] desktop:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(14rem,auto)] gap-0";
const journeyColPercurso = "min-w-0 pr-3";
const journeyColAluno = "min-w-0 pl-3";
const journeyColActions = "pl-3";

export type JourneyPathListItem = {
  id: string;
  title: string;
  status: PathStatus;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  avatarUrl: string | null;
  placeholderName: string | null;
  done: number;
  total: number;
  /** Live snapshot for active paths. Drafts omit it. */
  snapshot: string | null;
};

function studentLabel(path: JourneyPathListItem) {
  return (
    path.studentName ??
    path.studentEmail ??
    (path.placeholderName ? `${path.placeholderName} (sem conta)` : "Sem aluno")
  );
}

function pathMatches(path: JourneyPathListItem, query: string) {
  if (!query) return true;
  const haystack = [
    path.title,
    path.studentName,
    path.placeholderName,
    path.studentEmail,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function PathRows({
  paths,
  students,
}: {
  paths: JourneyPathListItem[];
  students: StudentOption[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="divide-y divide-white/[0.03]">
        {paths.map((path) => {
          const cells = (
            <>
              <IntentLink
                prefetch
                href={`/studio/journeys/${path.id}`}
                className={`${journeyColPercurso} transition-colors hover:text-foreground/90`}
              >
                <p className="truncate font-medium leading-snug">{path.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <PathStatusBadge status={path.status} />
                  <p className="text-xs text-muted-foreground">
                    {path.done}/{path.total} níveis
                  </p>
                </div>
              </IntentLink>
              <div className={`flex items-center gap-2 ${journeyColAluno}`}>
                <UserAvatar
                  className="shrink-0"
                  name={path.studentName ?? path.placeholderName}
                  email={path.studentEmail}
                  avatarUrl={path.avatarUrl}
                  size="sm"
                  rounded="xl"
                />
                <p className="min-w-0 flex-1 truncate text-xs leading-tight text-muted-foreground desktop:text-sm">
                  {studentLabel(path)}
                </p>
              </div>
              <div className={journeyColActions}>
                <JourneyPathRowActions
                  path={{
                    id: path.id,
                    title: path.title,
                    student_id: path.studentId,
                  }}
                  students={students}
                />
              </div>
            </>
          );

          if (!path.snapshot) {
            return (
              <div
                key={path.id}
                className={`${journeyTableGridClass} items-center px-4 py-3 transition-colors hover:bg-white/[0.04]`}
              >
                {cells}
              </div>
            );
          }

          return (
            <div
              key={path.id}
              className="min-w-0 px-4 py-3 transition-colors hover:bg-white/[0.04]"
            >
              <div className={`${journeyTableGridClass} items-center`}>
                {cells}
              </div>
              <p className="mt-2.5 line-clamp-2 border-t border-white/[0.08] pt-2 text-xs leading-snug break-words text-muted-foreground">
                {path.snapshot}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function JourneyPathList({
  paths,
  students,
}: {
  paths: JourneyPathListItem[];
  students: StudentOption[];
}) {
  return <PathRows paths={paths} students={students} />;
}

export function LiveJourneyPaths({
  paths,
  students,
}: {
  paths: JourneyPathListItem[];
  students: StudentOption[];
}) {
  const [search, setSearch] = useState("");
  const trimmed = search.trim();
  const query = trimmed.toLowerCase();
  const visible = useMemo(
    () => (query ? paths.filter((path) => pathMatches(path, query)) : paths),
    [paths, query],
  );

  return (
    <section id="paths" className="min-w-0 scroll-mt-24 space-y-4">
      <div className="flex min-w-0 flex-col gap-2 desktop:flex-row desktop:items-center desktop:justify-between">
        <h2 className="shrink-0 text-lg font-semibold">
          Percursos{" "}
          <span className="font-normal text-muted-foreground">
            ({visible.length})
          </span>
        </h2>
        <div className="relative w-full min-w-0 desktop:w-72 desktop:shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Procurar percurso ou aluno"
            aria-label="Procurar percurso ou aluno"
            autoComplete="off"
            className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-black/20 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-white/20 focus-visible:ring-3 focus-visible:ring-white/10"
          />
        </div>
      </div>

      {paths.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Ainda não há percursos activos. Quando activares um rascunho, ele
          aparece aqui.
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum percurso corresponde a «{trimmed}».
        </Card>
      ) : (
        <PathRows paths={visible} students={students} />
      )}
    </section>
  );
}
