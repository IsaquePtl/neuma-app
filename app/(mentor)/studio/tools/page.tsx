import { Metronome } from "@/components/metronome";

export default function MentorToolsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Ferramentas</p>
        <h1 className="text-3xl font-semibold tracking-tight">Metronomo</h1>
        <p className="text-muted-foreground">
          As mesmas ferramentas que os alunos usam, para preparares exercicios.
        </p>
      </header>
      <Metronome />
    </div>
  );
}
