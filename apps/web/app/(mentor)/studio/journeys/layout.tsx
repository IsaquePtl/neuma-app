import { JourneysSectionHeader } from "@/components/journeys-section-header";

export default function JourneysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="neuma-mobile-scroll-fade relative w-full min-w-0">
      <div className="w-full shrink-0 space-y-6">
        <JourneysSectionHeader />
        {children}
      </div>
      <div
        aria-hidden
        className="h-[calc(7rem+env(safe-area-inset-bottom,0px))] desktop:hidden"
      />
    </div>
  );
}
