import { JourneysTabs } from "@/components/journeys-tabs";

export default function JourneysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Percursos
          </h1>
          <p className="text-sm text-muted-foreground">
            Templates, percursos dos alunos, check-ins e onboardings.
          </p>
        </div>
        <JourneysTabs />
      </header>
      {children}
    </div>
  );
}
