export default function StudentNodeLoading() {
  return (
    <div
      className={
        "neuma-mobile-viewport neuma-mobile-scroll-fade relative flex w-full min-w-0 flex-col [justify-content:safe_center] overflow-y-auto pb-0 " +
        "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4"
      }
    >
      <div className="w-full min-w-0 max-w-full shrink-0 space-y-5 desktop:space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-8 w-3/4 max-w-sm rounded bg-white/10" />
          <div className="h-48 w-full rounded-2xl bg-white/[0.06]" />
          <div className="h-24 w-full rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
      <div
        aria-hidden
        className="h-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shrink-0 desktop:hidden"
      />
    </div>
  );
}
