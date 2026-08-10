export function ToolTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
      <h2 className="text-base font-medium tracking-tight text-muted-foreground">
        {children}
      </h2>
    </div>
  );
}
