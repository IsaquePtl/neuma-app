"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { GuitarChordBuilder } from "@/components/guitar-chord-builder";
import { PianoChordBuilder } from "@/components/piano-chord-builder";
import { Button } from "@/components/ui/button";
import {
  buildOverrideMap,
  guitarOverrideKey,
  pianoOverrideKey,
  type ChordOverrideMap,
  type ChordOverridePayload,
  type ChordVoicingOverrideRow,
} from "@/lib/music/chord-overrides";
import { saveChordVoicingOverrides } from "@/lib/actions/chord-overrides";

type AdminChordBuildersProps = {
  initialOverrides: ChordVoicingOverrideRow[];
};

function parseOverrideKey(key: string) {
  const [instrument, chordKey, voicingId = ""] = key.split("::");
  if (instrument !== "piano" && instrument !== "guitar") return null;
  return { instrument, chordKey, voicingId };
}

export function AdminChordBuilders({ initialOverrides }: AdminChordBuildersProps) {
  const baseOverrides = useMemo(
    () => buildOverrideMap(initialOverrides),
    [initialOverrides],
  );

  const [savedOverrides, setSavedOverrides] = useState<ChordOverrideMap>(
    () => new Map(baseOverrides),
  );
  const [pendingOverrides, setPendingOverrides] = useState<ChordOverrideMap>(
    () => new Map(),
  );
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeOverrides = useMemo(() => {
    const merged = new Map(savedOverrides);
    for (const [key, payload] of pendingOverrides) merged.set(key, payload);
    return merged;
  }, [savedOverrides, pendingOverrides]);

  const hasUnsavedChanges = dirtyKeys.size > 0;

  const handleOverrideChange = useCallback(
    (key: string, payload: ChordOverridePayload) => {
      setPendingOverrides((prev) => {
        const next = new Map(prev);
        next.set(key, payload);
        return next;
      });
      setDirtyKeys((prev) => new Set(prev).add(key));
      setSaveError(null);
    },
    [],
  );

  function handleSave() {
    const entries = [...dirtyKeys]
      .map((key) => {
        const parsed = parseOverrideKey(key);
        const payload = pendingOverrides.get(key);
        if (!parsed || !payload) return null;
        return {
          instrument: parsed.instrument as "piano" | "guitar",
          chordKey: parsed.chordKey,
          voicingId: parsed.voicingId,
          payload,
        };
      })
      .filter(Boolean);

    startTransition(async () => {
      try {
        await saveChordVoicingOverrides(
          entries as Parameters<typeof saveChordVoicingOverrides>[0],
        );
        setSavedOverrides((prev) => {
          const next = new Map(prev);
          for (const key of dirtyKeys) {
            const payload = pendingOverrides.get(key);
            if (payload) next.set(key, payload);
          }
          return next;
        });
        setPendingOverrides(new Map());
        setDirtyKeys(new Set());
        setSaveError(null);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Erro ao guardar");
      }
    });
  }

  return (
    <>
      {hasUnsavedChanges ? (
        <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-foreground">
            Tens alterações por guardar nos acordes ({dirtyKeys.size}{" "}
            {dirtyKeys.size === 1 ? "voicing" : "voicings"}).
          </p>
          <div className="flex items-center gap-2">
            {saveError ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  A guardar…
                </>
              ) : (
                "Guardar alterações"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <PianoChordBuilder
          editMode
          overrides={activeOverrides}
          onOverrideChange={(spec, payload) =>
            handleOverrideChange(pianoOverrideKey(spec), payload)
          }
        />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <GuitarChordBuilder
          editMode
          overrides={activeOverrides}
          onOverrideChange={(spec, voicingId, payload) =>
            handleOverrideChange(guitarOverrideKey(spec, voicingId), payload)
          }
        />
      </div>
    </>
  );
}
