import { Metronome } from "@/components/metronome";
import { HarmonicField } from "@/components/harmonic-field";
import { ToolTitle } from "@/components/tool-title";

export default function MentorToolsPage() {
  return (
    <div className="w-full space-y-8">
      <section className="w-full space-y-3">
        <ToolTitle>Metrónomo</ToolTitle>
        <Metronome />
      </section>

      <section className="w-full space-y-3">
        <ToolTitle>Campo Harmónico</ToolTitle>
        <HarmonicField />
      </section>
    </div>
  );
}
