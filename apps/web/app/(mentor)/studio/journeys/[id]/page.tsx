import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { ClaimPathForm } from "@/components/claim-path-form";
import { JourneyPathAdminView } from "@/components/journey-path-admin-view";
import { UserAvatar } from "@/components/user-avatar";
import { loadJourneyPathPageData } from "@/lib/journey-path/load-journey-path";

export default async function JourneyAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadJourneyPathPageData(id);

  if (!data) notFound();

  const { path, student, placeholderName, claimEmail, allStudents, displayName } =
    data;

  return (
    <div className="space-y-6">
      {!student ? (
        <ClaimPathForm
          pathId={path.id}
          placeholderName={placeholderName}
          claimEmail={claimEmail}
          students={allStudents}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href={`/studio/students/${student.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition-colors hover:bg-white/10"
          >
            <UserAvatar
              name={student.full_name}
              email={student.email}
              avatarUrl={student.avatar_url}
              size="sm"
              rounded="xl"
            />
            <span className="font-medium">{displayName}</span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </Link>
        </div>
      )}

      <JourneyPathAdminView
        pathId={path.id}
        studentName={displayName}
        path={path}
        nodes={data.nodes}
        checkIns={data.checkIns}
        levelFeedbacks={data.levelFeedbacks}
      />
    </div>
  );
}
