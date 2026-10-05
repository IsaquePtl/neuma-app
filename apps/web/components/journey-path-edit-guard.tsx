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
import {
  JourneyEditDirtyProvider,
  type UnsavedEdits,
} from "@/lib/journey-path/edit-dirty-context";
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
  const [baseline] = useState<PathSnapshot>(() =>
    buildPathSnapshot(path, nodes, studentId),
  );
  const [draftAcknowledged, setDraftAcknowledged] = useState(false);
  const effectiveIsNewDraft = isNewDraft && !draftAcknowledged;

  const unsavedRef = useRef<UnsavedEdits | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const currentSnapshot = useMemo(
    () => buildPathSnapshot(path, nodes, studentId),
    [path, nodes, studentId],
  );

  const draftNeedsDecision =
    effectiveIsNewDraft &&
    shouldConfirmLeave(baseline, currentSnapshot, true);
  const confirmLeave = hasUnsaved || draftNeedsDecision;

  const stateRef = useRef({ confirmLeave });
  useEffect(() => {
    stateRef.current = { confirmLeave };
  }, [confirmLeave]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null);
  const [dialogMode, setDialogMode] = useState<"unsaved" | "draft">("draft");
  const [pending, startTransition] = useTransition();

  const hasChanges = !snapshotsEqual(baseline, currentSnapshot);
  const isEmptyDraft = isEmptyDraftSnapshot(currentSnapshot);

  const readShouldConfirmLeave = useCallback(
    () => stateRef.current.confirmLeave,
    [],
  );

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
        setDialogMode(unsavedRef.current ? "unsaved" : "draft");
        setPendingLeave({ href, resolve });
        setDialogOpen(true);
      }),
    [],
  );

  const reportUnsaved = useCallback((edits: UnsavedEdits | null) => {
    unsavedRef.current = edits;
    setHasUnsaved(Boolean(edits));
  }, []);

  const acknowledgeSaved = useCallback(() => {
    if (!isNewDraft || draftAcknowledged) return;
    setDraftAcknowledged(true);
    router.replace(`/studio/journeys/${path.id}/edit`);
  }, [draftAcknowledged, isNewDraft, path.id, router]);

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

  function onSaveAndLeave() {
    const edits = unsavedRef.current;
    if (!edits) {
      navigateAway();
      return;
    }
    startTransition(async () => {
      const ok = await edits.save();
      if (ok) navigateAway();
      else finishLeave(false);
    });
  }

  function onDiscard() {
    if (!pendingLeave) return;

    if (dialogMode === "unsaved" || path.status !== "draft") {
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

  const unsavedMode = dialogMode === "unsaved";
  const title = unsavedMode ? "Alterações por guardar" : "Guardar rascunho?";
  const description = unsavedMode
    ? "Tens alterações que ainda não foram guardadas. Queres guardá-las antes de sair?"
    : isEmptyDraft && !hasChanges
      ? "Este rascunho já existe. Queres mantê-lo ou descartá-lo?"
      : "Queres manter este rascunho ou descartá-lo?";

  const dirtyValue = useMemo(
    () => ({ reportUnsaved, acknowledgeSaved }),
    [acknowledgeSaved, reportUnsaved],
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
            <DialogTitle>{title}</DialogTitle>
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
              {unsavedMode
                ? "Sair sem guardar"
                : pending
                  ? "A descartar…"
                  : "Descartar"}
            </Button>
            <Button type="button" disabled={pending} onClick={onSaveAndLeave}>
              {unsavedMode ? (pending ? "A guardar…" : "Guardar e sair") : "Manter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </JourneyEditDirtyProvider>
  );
}
