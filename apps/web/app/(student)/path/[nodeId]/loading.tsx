export default function StudentNodeLoading() {
  return (
    <div
      className={
        "neuma-mobile-viewport flex w-full min-w-0 flex-col overflow-y-auto overscroll-contain pb-5 " +
        "desktop:h-auto desktop:min-h-0 desktop:overflow-visible desktop:pb-4"
      }
    >
      <div className="my-auto w-full min-w-0 max-w-full space-y-5 pt-8 pb-2 desktop:my-0 desktop:space-y-6 desktop:py-0">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-8 w-3/4 max-w-sm rounded bg-white/10" />
          <div className="h-48 w-full rounded-2xl bg-white/[0.06]" />
          <div className="h-24 w-full rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
