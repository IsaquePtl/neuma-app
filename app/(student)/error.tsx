"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h2 className="text-xl font-semibold">Algo correu mal</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "Tenta novamente dentro de momentos."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-white/12 px-4 py-2 text-sm hover:bg-white/18"
      >
        Tentar outra vez
      </button>
    </div>
  );
}
