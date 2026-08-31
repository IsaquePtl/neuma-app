"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { JourneyEditDirtyProvider } from "@/lib/journey-path/edit-dirty-context";
import { registerJourneyEditGuard } from "@/lib/journey-path/edit-guard-store";
import {
  buildPathSnapshot,
  isEmptyDraftSnapshot,
  shouldConfirmLeave,
  snapshotsEqual,
  type PathSnapshot,
} from "@/lib/journey-path/path-snapshot";
import { deletePath } from "@/lib/actions/paths";
import type { StudentNode, StudentPath } from "@/lib/students/queries";

type PendingLeave = {
  href: string;
  resolve: (proceed: boolean) => void;
};

export function JourneyPathEditGuard({
  path,
  nodes,
  studentId,
  isNewDraft,
  children,
}: {
  path: StudentPath;
  nodes: StudentNode[];
  studentId: string | null;
  isNewDraft: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<PathSnapshot>(() =>
    buildPathSnapshot(path, nodes, studentId),
  );
  const [draftAcknowledged, setDraftAcknowledged] = useState(false);
  const effectiveIsNewDraft = isNewDraft && !draftAcknowledged;

  const stateRef = useRef({
    path,
    nodes,
    studentId,
    isNewDraft: effectiveIsNewDraft,
    baseline,
  });

  useEffect(() => {
    stateRef.current = {
      path,
      nodes,
      studentId,
      isNewDraft: effectiveIsNewDraft,
      baseline,
    };
  }, [path, nodes, studentId, effectiveIsNewDraft, baseline]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null);
  const [pending, startTransition] = useTransition();

  const currentSnapshot = useMemo(
    () => buildPathSnapshot(path, nodes, studentId),
    [path, nodes, studentId],
  );

  const confirmLeave = useMemo(
    () => shouldConfirmLeave(baseline, currentSnapshot, effectiveIsNewDraft),
    [baseline, currentSnapshot, effectiveIsNewDraft],
  );

  const hasChanges = !snapshotsEqual(baseline, currentSnapshot);
  const isEmptyDraft = isEmptyDraftSnapshot(currentSnapshot);
  const isDirty = confirmLeave;

  const readShouldConfirmLeave = useCallback(() => {
    const { path, nodes, studentId, isNewDraft, baseline } = stateRef.current;
    return shouldConfirmLeave(
      baseline,
      buildPathSnapshot(path, nodes, studentId),
      isNewDraft,
    );
  }, []);

  const finishLeave = useCallback((proceed: boolean) => {
    setPendingLeave((current) => {
      current?.resolve(proceed);
      return null;
    });
    setDialogOpen(false);
  }, []);

  const promptLeave = useCallback(
    (href: string) =>
      new Promise<boolean>((resolve) => {
        setPendingLeave({ href, resolve });
        setDialogOpen(true);
      }),
    [],
  );

  const acknowledgeSave = useCallback(() => {
    const { path: p, nodes: n, studentId: sid, baseline: base } =
      stateRef.current;
    const next = buildPathSnapshot(p, n, sid);
    const changed = !snapshotsEqual(base, next);
    setBaseline(next);
    setDraftAcknowledged(true);
    toast.success(
      isEmptyDraftSnapshot(next) && !changed
        ? "Percurso guardado"
        : "Alterações guardadas",
    );
    if (isNewDraft) {
      router.replace(`/studio/journeys/${path.id}/edit`);
    }
  }, [isNewDraft, path.id, router]);

  useEffect(() => {
    registerJourneyEditGuard({
      shouldConfirmLeave: readShouldConfirmLeave,
      promptLeave,
    });
    return () => registerJourneyEditGuard(null);
  }, [promptLeave, readShouldConfirmLeave]);

  useEffect(() => {
    if (!confirmLeave) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [confirmLeave]);

  useEffect(() => {
    const url = window.location.href;
    history.pushState({ journeyEditGuard: true }, "", url);

    const onPopState = () => {
      if (!readShouldConfirmLeave()) {
        router.back();
        return;
      }

      history.pushState({ journeyEditGuard: true }, "", url);
      void promptLeave("/studio/journeys").then((proceed) => {
        if (proceed) router.push("/studio/journeys");
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [promptLeave, readShouldConfirmLeave, router]);

  function navigateAway() {
    if (!pendingLeave) return;
    const href = pendingLeave.href;
    finishLeave(true);
    router.push(href);
  }

  function onSave() {
    // Changes are already persisted via per-level / path actions — keep and leave.
    navigateAway();
  }

  function onDiscard() {
    if (!pendingLeave) return;

    if (path.status !== "draft") {
      navigateAway();
      return;
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", path.id);
        if (studentId) fd.set("student_id", studentId);
        await deletePath(fd);
        finishLeave(true);
        router.push(pendingLeave.href);
        toast.success("Rascunho descartado");
      } catch {
        toast.error("Não foi possível descartar o percurso");
        finishLeave(false);
      }
    });
  }

  function onCancel() {
    finishLeave(false);
  }

  const description =
    isEmptyDraft && !hasChanges
      ? "Este percurso ainda está vazio. Queres guardá-lo ou descartá-lo?"
      : "Tens alterações neste percurso. Queres guardá-las antes de sair?";

  const dirtyValue = useMemo(
    () => ({
      isDirty,
      save: acknowledgeSave,
      pending: false,
    }),
    [acknowledgeSave, isDirty],
  );

  return (
    <JourneyEditDirtyProvider value={dirtyValue}>
      {children}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !pending) onCancel();
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar alterações?</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={onDiscard}
            >
              {pending ? "A descartar…" : "Descartar"}
            </Button>
            <Button type="button" disabled={pending} onClick={onSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </JourneyEditDirtyProvider>
  );
}
