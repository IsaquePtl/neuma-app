import { notFound } from "next/navigation";

import { ClaimPathForm } from "@/components/claim-path-form";
import { JourneyPathAdminView } from "@/components/journey-path-admin-view";
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
      ) : null}

      <JourneyPathAdminView
        pathId={path.id}
        displayName={displayName}
        student={student}
        path={path}
        nodes={data.nodes}
        checkIns={data.checkIns}
        levelFeedbacks={data.levelFeedbacks}
      />
    </div>
  );
}
