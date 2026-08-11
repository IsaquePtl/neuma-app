import { Metronome } from "@/components/metronome";
import { HarmonicField } from "@/components/harmonic-field";

export default function MentorToolsPage() {
  return (
    <div className="w-full space-y-8">
      <Metronome />
      <HarmonicField />
    </div>
  );
}
