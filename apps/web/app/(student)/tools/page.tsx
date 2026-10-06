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
    <div className="neuma-mobile-viewport neuma-mobile-scroll-fade relative flex w-full min-w-0 flex-col [justify-content:safe_center] overflow-y-auto pb-0 desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4">
      <div className="grid w-full shrink-0 grid-cols-1 gap-6 min-[1360px]:grid-cols-2 min-[1360px]:items-stretch">
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
      <div
        aria-hidden
        className="h-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shrink-0 desktop:hidden"
      />
    </div>
  );
}
