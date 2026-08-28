import { AdminChordBuilders } from "@/components/admin-chord-builders";
import { HarmonicField } from "@/components/harmonic-field";
import { Metronome } from "@/components/metronome";
import { getChordVoicingOverrides } from "@/lib/actions/chord-overrides";

export default async function MentorToolsPage() {
  const initialOverrides = await getChordVoicingOverrides();

  return (
    <div className="grid w-full grid-cols-1 gap-6 min-[1360px]:grid-cols-2 min-[1360px]:items-stretch">
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <Metronome />
      </div>
      <div className="min-w-0 w-full min-[1360px]:flex min-[1360px]:h-full min-[1360px]:flex-col">
        <HarmonicField />
      </div>
      <AdminChordBuilders initialOverrides={initialOverrides} />
    </div>
  );
}
