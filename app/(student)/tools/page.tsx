import { Metronome } from "@/components/metronome";

export default function StudentToolsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Ferramentas</p>
        <h1 className="text-3xl font-semibold tracking-tight">Metronomo</h1>
        <p className="text-muted-foreground">
          Escolhe o compasso e o andamento (BPM) para praticares no tempo.
        </p>
      </header>
      <Metronome />
    </div>
  );
}
