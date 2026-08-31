import { JourneysSectionHeader } from "@/components/journeys-section-header";

export default function JourneysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <JourneysSectionHeader />
      {children}
    </div>
  );
}
