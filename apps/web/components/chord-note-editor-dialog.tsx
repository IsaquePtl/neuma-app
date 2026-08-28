"use client";

import { useEffect, useState } from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHORD_TONE_ROLE_LABELS,
  CHORD_TONE_ROLES,
} from "@/lib/music/chord-overrides";
import type { ChordToneRole } from "@/lib/music/chords";
import { NOTE_NAMES } from "@/lib/music/chords";

type PianoEditorState = {
  kind: "piano";
  midi: number;
  active: boolean;
  role: ChordToneRole;
};

type GuitarEditorState = {
  kind: "guitar";
  stringIdx: number;
  state: "muted" | "open" | "fretted";
  fret: number;
};

export type ChordNoteEditorState = PianoEditorState | GuitarEditorState;

type ChordNoteEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ChordNoteEditorState | null;
  onConfirm: (state: ChordNoteEditorState) => void;
};

function midiLabel(midi: number) {
  const pc = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

export function ChordNoteEditorDialog({
  open,
  onOpenChange,
  state,
  onConfirm,
}: ChordNoteEditorDialogProps) {
  const [draft, setDraft] = useState<ChordNoteEditorState | null>(state);

  useEffect(() => {
    if (open) setDraft(state);
  }, [open, state]);

  if (!draft) return null;

  function handleConfirm() {
    if (!draft) return;
    onConfirm(draft);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {draft.kind === "piano" ? "Editar nota · Piano" : "Editar corda · Guitarra"}
          </DialogTitle>
          <DialogDescription>
            {draft.kind === "piano"
              ? `Tecla ${midiLabel(draft.midi)} — escolhe o formato da nota no acorde.`
              : "Define se a corda fica abafada, solta ou dedilhada."}
          </DialogDescription>
        </DialogHeader>

        {draft.kind === "piano" ? (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
                className="size-4 rounded border"
              />
              Nota activa no voicing
            </label>

            {draft.active ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Formato
                </p>
                <Select
                  value={draft.role}
                  onValueChange={(value) =>
                    setDraft({ ...draft, role: value as ChordToneRole })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHORD_TONE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {CHORD_TONE_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Estado
              </p>
              <Select
                value={draft.state}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    state: value as GuitarEditorState["state"],
                    fret: value === "fretted" ? Math.max(1, draft.fret) : draft.fret,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muted">× Abafada</SelectItem>
                  <SelectItem value="open">○ Solta</SelectItem>
                  <SelectItem value="fretted">● Dedilhada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.state === "fretted" ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Casa (fret)
                </p>
                <input
                  type="number"
                  min={1}
                  max={17}
                  value={draft.fret}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      fret: Math.max(1, Math.min(17, Number(e.target.value) || 1)),
                    })
                  }
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                />
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
