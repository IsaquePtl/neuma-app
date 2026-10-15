import { IntentLink } from "@/components/intent-link";
import {
  PathTemplateRowActions,
  type PathTemplateRow,
} from "@/components/path-template-row-actions";
import type { StudentOption } from "@/components/tally-submission-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { pathTemplateStatusLabel } from "@/lib/labels";
import type { PathTemplateStatus } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

export type PathTemplateListItem = PathTemplateRow & {
  status: PathTemplateStatus;
  nodeCount: number;
};

const statusStyles: Record<PathTemplateStatus, string> = {
  draft: "border-border text-muted-foreground",
  ready: "border-transparent bg-emerald-500/15 text-emerald-400",
  archived: "border-border text-muted-foreground",
};

export function PathTemplateList({
  templates,
  students,
}: {
  templates: PathTemplateListItem[];
  students: StudentOption[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="divide-y divide-white/[0.03]">
        {templates.map((template) => {
          const meta = [
            template.duration_label,
            `${template.nodeCount} níveis`,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={template.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]"
            >
              <IntentLink
                href={`/studio/library?compose=${template.id}`}
                className="min-w-0 flex-1 transition-colors hover:text-foreground/90"
              >
                <p className="truncate font-medium leading-snug">
                  {template.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(statusStyles[template.status])}
                  >
                    {pathTemplateStatusLabel[template.status]}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{meta}</p>
                </div>
              </IntentLink>
              <PathTemplateRowActions
                template={template}
                students={students}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
