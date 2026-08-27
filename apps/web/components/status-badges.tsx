import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  checkInStatusLabel,
  nodeKindLabel,
  nodeStatusLabel,
  pathStatusLabel,
} from "@/lib/labels";
import type {
  CheckInStatus,
  NodeKind,
  NodeStatus,
  PathStatus,
} from "@/lib/types/database.types";

export function NodeStatusBadge({ status }: { status: NodeStatus }) {
  const styles: Record<NodeStatus, string> = {
    locked: "border-border text-muted-foreground",
    active: "border-transparent bg-primary/15 text-primary",
    completed: "border-transparent bg-emerald-500/15 text-emerald-400",
  };
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {nodeStatusLabel[status]}
    </Badge>
  );
}

export function NodeKindBadge({ kind }: { kind: NodeKind }) {
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      {nodeKindLabel[kind]}
    </Badge>
  );
}

export function PathStatusBadge({ status }: { status: PathStatus }) {
  const styles: Record<PathStatus, string> = {
    draft: "border-border text-muted-foreground",
    active: "border-transparent bg-primary/15 text-primary",
    completed: "border-transparent bg-emerald-500/15 text-emerald-400",
    paused: "border-transparent bg-amber-500/15 text-amber-400",
  };
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {pathStatusLabel[status]}
    </Badge>
  );
}

export function CheckInStatusBadge({ status }: { status: CheckInStatus }) {
  const styles: Record<CheckInStatus, string> = {
    pending: "border-transparent bg-amber-500/15 text-amber-400",
    approved: "border-transparent bg-emerald-500/15 text-emerald-400",
    needs_revision: "border-transparent bg-primary/15 text-primary",
  };
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {checkInStatusLabel[status]}
    </Badge>
  );
}
