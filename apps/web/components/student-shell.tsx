import { formatDate } from "@/lib/labels";
import type { StudentCounts, StudentProfile } from "@/lib/students/queries";
import { PathStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import type { PathStatus } from "@/lib/types/database.types";

export function StudentShell({
  student,
  counts,
  pathTitle,
  pathStatus,
  children,
}: {
  student: StudentProfile;
  counts: StudentCounts;
  pathTitle?: string | null;
  pathStatus?: PathStatus | null;
  children?: React.ReactNode;
}) {
  const pct =
    counts.totalNodes > 0
      ? Math.round((counts.completedNodes / counts.totalNodes) * 100)
      : null;

  const stats = [
    {
      label: "Progresso",
      value: pct != null ? `${pct}%` : "—",
      accent: false,
    },
    {
      label: "Níveis",
      value:
        counts.totalNodes > 0
          ? `${counts.completedNodes}/${counts.totalNodes}`
          : "—",
      accent: false,
    },
    {
      label: "Por rever",
      value: String(counts.pendingCheckIns),
      accent: counts.pendingCheckIns > 0,
    },
    {
      label: "Onboarding",
      value: student.onboarding_completed ? "Feito" : "Pendente",
      accent: !student.onboarding_completed,
    },
  ];

  return (
    <div className="space-y-5 pb-2 sm:space-y-6">
      <header className="space-y-4">
        <div className="flex min-w-0 items-start gap-4">
          <UserAvatar
            name={student.full_name}
            email={student.email}
            avatarUrl={student.avatar_url}
            size="xl"
            rounded="2xl"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {student.full_name ?? student.email}
              </h1>
              {pathStatus ? <PathStatusBadge status={pathStatus} /> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {student.email}
            </p>
            <p className="text-xs text-muted-foreground">
              Desde {formatDate(student.created_at)}
              {pathTitle ? ` · ${pathTitle}` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p
                className={
                  s.accent
                    ? "mt-0.5 text-lg font-semibold tabular-nums text-[var(--neuma-coral)]"
                    : "mt-0.5 text-lg font-semibold tabular-nums"
                }
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {counts.totalNodes > 0 ? (
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[var(--neuma-coral)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}

        {counts.overdueNodes > 0 || counts.revisionCheckIns > 0 ? (
          <p className="text-xs text-[var(--neuma-coral)]">
            {[
              counts.revisionCheckIns > 0
                ? `${counts.revisionCheckIns} a aguardar revisão`
                : null,
              counts.overdueNodes > 0
                ? `${counts.overdueNodes} bloco(s) fora de prazo`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </header>

      {children}
    </div>
  );
}
