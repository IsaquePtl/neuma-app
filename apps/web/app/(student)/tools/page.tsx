import { GuitarChordBuilder } from "@/components/guitar-chord-builder";
import { HarmonicField } from "@/components/harmonic-field";
import { Metronome } from "@/components/metronome";
import { PianoChordBuilder } from "@/components/piano-chord-builder";
import { buildOverrideMap } from "@/lib/music/chord-overrides";
import { getChordVoicingOverrides } from "@/lib/actions/chord-overrides";

export default async function StudentToolsPage() {
  const rows = await getChordVoicingOverrides();
  const overrides = buildOverrideMap(rows);

  return (
    <div className="grid w-full grid-cols-1 gap-6 min-[1360px]:grid-cols-2 min-[1360px]:items-stretch">
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <Metronome />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <HarmonicField />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <PianoChordBuilder overrides={overrides} />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <GuitarChordBuilder overrides={overrides} />
      </div>
    </div>
  );
}
