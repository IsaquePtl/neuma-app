"use client";

import { usePathname } from "next/navigation";

import { JourneysTabs } from "@/components/journeys-tabs";
import { isJourneyPathDetailPage } from "@/lib/journey-path/routes";

export function JourneysSectionHeader() {
  const pathname = usePathname();

  if (isJourneyPathDetailPage(pathname)) return null;

  return (
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
  );
}
