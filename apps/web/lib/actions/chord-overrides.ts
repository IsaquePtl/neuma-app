"use server";

import { revalidatePath } from "next/cache";

import type {
  ChordInstrument,
  ChordOverridePayload,
  ChordVoicingOverrideRow,
} from "@/lib/music/chord-overrides";
import { createClient } from "@/lib/supabase/server";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  return { supabase, user };
}

async function requireMentor() {
  const { supabase, user } = await requireAuth();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissao");
  return { supabase, user };
}

function rowFromDb(row: {
  instrument: string;
  chord_key: string;
  voicing_id: string;
  payload: unknown;
}): ChordVoicingOverrideRow | null {
  if (row.instrument !== "piano" && row.instrument !== "guitar") return null;
  return {
    instrument: row.instrument,
    chord_key: row.chord_key,
    voicing_id: row.voicing_id,
    payload: row.payload as ChordOverridePayload,
  };
}

export async function getChordVoicingOverrides(): Promise<ChordVoicingOverrideRow[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("chord_voicing_overrides")
    .select("instrument, chord_key, voicing_id, payload");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map(rowFromDb)
    .filter(Boolean) as ChordVoicingOverrideRow[];
}

export type ChordOverrideUpsert = {
  instrument: ChordInstrument;
  chordKey: string;
  voicingId?: string;
  payload: ChordOverridePayload;
};

export async function saveChordVoicingOverrides(
  entries: ChordOverrideUpsert[],
) {
  const { supabase, user } = await requireMentor();
  const now = new Date().toISOString();

  for (const entry of entries) {
    const { error } = await supabase.from("chord_voicing_overrides").upsert(
      {
        instrument: entry.instrument,
        chord_key: entry.chordKey,
        voicing_id: entry.voicingId ?? "",
        payload: entry.payload,
        updated_by: user.id,
        updated_at: now,
      },
      { onConflict: "instrument,chord_key,voicing_id" },
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/tools");
  revalidatePath("/studio/tools");
}
