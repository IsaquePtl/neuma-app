"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { ClaimPathForm } from "@/components/claim-path-form";
import { JourneyPathComposer } from "@/components/journey-path-composer";
import { JourneyPathEditGuard } from "@/components/journey-path-edit-guard";
import { UserAvatar } from "@/components/user-avatar";
import type { JourneyPathPageData } from "@/lib/journey-path/load-journey-path";

export function JourneyPathEditView({
  data,
  isNewDraft,
}: {
  data: JourneyPathPageData;
  isNewDraft: boolean;
}) {
  const { path, student, placeholderName, claimEmail, allStudents, displayName } =
    data;

  return (
    <JourneyPathEditGuard
      path={path}
      nodes={data.nodes}
      studentId={student?.id ?? null}
      isNewDraft={isNewDraft}
    >
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

        <JourneyPathComposer
          studentId={student?.id ?? ""}
          studentName={displayName}
          path={path}
          nodes={data.nodes}
          libraryCategories={data.libraryCategories}
          libraryTopics={data.libraryTopics}
          libraryAssets={data.libraryAssets}
        />
      </div>
    </JourneyPathEditGuard>
  );
}
