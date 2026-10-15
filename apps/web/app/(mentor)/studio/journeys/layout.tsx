import { JourneysSectionHeader } from "@/components/journeys-section-header";

export default function JourneysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="neuma-mobile-viewport neuma-mobile-scroll-fade relative flex w-full min-w-0 flex-col overflow-y-auto pb-0 desktop:h-auto desktop:min-h-0 desktop:overflow-visible desktop:pb-4">
      <div className="w-full shrink-0 space-y-6">
        <JourneysSectionHeader />
        {children}
      </div>
      <div
        aria-hidden
        className="h-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shrink-0 desktop:hidden"
      />
    </div>
  );
}
