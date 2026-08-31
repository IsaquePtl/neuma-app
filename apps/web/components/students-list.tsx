"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { PathStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PathStatus } from "@/lib/types/database.types";

export type StudentListRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  path: { status: PathStatus; title: string } | null;
  pendingCount: number;
};

function studentMatchesSearch(student: StudentListRow, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (student.full_name?.toLowerCase().includes(q) ?? false) ||
    (student.email?.toLowerCase().includes(q) ?? false) ||
    (student.path?.title.toLowerCase().includes(q) ?? false)
  );
}

type Props = {
  students: StudentListRow[];
};

export function StudentsList({ students }: Props) {
  const [search, setSearch] = useState("");
  const searchQuery = search.trim();

  const visibleStudents = useMemo(
    () => students.filter((s) => studentMatchesSearch(s, searchQuery)),
    [students, searchQuery],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar alunos…"
          className="pl-9"
          aria-label="Pesquisar alunos"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_7rem_2rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
          <span>Aluno</span>
          <span>Percurso</span>
          <span>Estado</span>
          <span />
        </div>
        <div className="divide-y divide-white/5">
          {visibleStudents.map((s) => (
            <Link
              key={s.id}
              href={`/studio/students/${s.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] desktop:grid desktop:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_7rem_2rem]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  name={s.full_name}
                  email={s.email}
                  avatarUrl={s.avatar_url}
                  size="lg"
                  rounded="xl"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {s.full_name ?? s.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground desktop:hidden">
                    {s.path ? s.path.title : "Sem percurso"}
                    {s.pendingCount > 0
                      ? ` · ${s.pendingCount} por rever`
                      : !s.onboarding_completed
                        ? " · onboarding pendente"
                        : ""}
                  </p>
                  {s.pendingCount > 0 ? (
                    <p className="hidden text-xs text-[var(--neuma-coral)] desktop:block">
                      {s.pendingCount} por rever
                    </p>
                  ) : !s.onboarding_completed ? (
                    <p className="hidden text-xs text-muted-foreground desktop:block">
                      Onboarding pendente
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="hidden truncate text-sm text-muted-foreground desktop:block">
                {s.path ? s.path.title : "Sem percurso definido"}
              </p>
              <div className="hidden desktop:block">
                {s.path ? <PathStatusBadge status={s.path.status} /> : null}
              </div>
              <ArrowRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
            </Link>
          ))}
        </div>
      </Card>

      {searchQuery && visibleStudents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum aluno corresponde a «{searchQuery}».
        </p>
      ) : null}
    </div>
  );
}
