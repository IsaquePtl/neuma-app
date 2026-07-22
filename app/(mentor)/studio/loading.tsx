export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-24 rounded bg-white/10" />
      <div className="h-9 w-64 rounded bg-white/10" />
      <div className="h-4 w-80 max-w-full rounded bg-white/5" />
      <div className="grid gap-3 pt-4">
        <div className="h-24 rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
