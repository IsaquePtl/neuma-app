"use client";

import { ClaimPathForm } from "@/components/claim-path-form";
import { JourneyPathComposer } from "@/components/journey-path-composer";
import { JourneyPathEditGuard } from "@/components/journey-path-edit-guard";
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
      <div className="min-w-0 space-y-6">
        {!student ? (
          <ClaimPathForm
            pathId={path.id}
            placeholderName={placeholderName}
            claimEmail={claimEmail}
            students={allStudents}
          />
        ) : null}

        <JourneyPathComposer
          studentId={student?.id ?? ""}
          studentName={displayName}
          student={student}
          path={path}
          nodes={data.nodes}
          libraryCategories={data.libraryCategories}
          libraryTopics={data.libraryTopics}
          libraryAssets={data.libraryAssets}
          autoFocusTitle={isNewDraft}
        />
      </div>
    </JourneyPathEditGuard>
  );
}
