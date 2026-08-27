import { Metronome } from "@/components/metronome";
import { HarmonicField } from "@/components/harmonic-field";
import { PianoChordBuilder } from "@/components/piano-chord-builder";
import { GuitarChordBuilder } from "@/components/guitar-chord-builder";

export default function StudentToolsPage() {
  return (
    <div className="grid w-full grid-cols-1 gap-6 min-[1360px]:grid-cols-2 min-[1360px]:items-stretch">
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <Metronome />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <HarmonicField />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <PianoChordBuilder />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <GuitarChordBuilder />
      </div>
    </div>
  );
}
