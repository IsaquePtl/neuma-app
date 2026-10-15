import { LevelCountdown } from "@/components/level-countdown";
import { nodeKindLabel, phaseKeyLabel } from "@/lib/labels";
import { levelAvailableLabel } from "@/lib/nodes/level-open";
import type { StudentNode } from "@/lib/students/queries";

/** Level page before its Monday: title and description, no lesson content. */
export function LevelWaitingView({
  node,
  levelNumber,
  opensOn,
}: {
  node: Pick<
    StudentNode,
    | "title"
    | "description"
    | "kind"
    | "phase_key"
    | "week_number"
    | "preview_text"
    | "poster_url"
  >;
  levelNumber: number;
  opensOn: string;
}) {
  const preview = node.preview_text?.trim() || null;
  const cover = node.poster_url?.trim() || null;

  return (
    <div className="w-full max-w-full space-y-6">
      <header className="min-w-0 shrink-0">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className="student-path-marker neuma-gradient relative mt-0.5 grid size-14 shrink-0 place-items-center rounded-full text-base font-semibold tabular-nums text-white shadow-[0_0_28px_-4px_color-mix(in_oklch,var(--neuma-coral)_55%,transparent)]"
            aria-hidden
          >
            {levelNumber}
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-medium uppercase leading-none tracking-[0.2em] text-muted-foreground">
              {node.phase_key ? (
                <>
                  {phaseKeyLabel(node.phase_key)}
                  <span aria-hidden className="mx-2 text-white/25">
                    ·
                  </span>
                </>
              ) : null}
              {nodeKindLabel[node.kind]}
              {node.week_number ? (
                <>
                  <span aria-hidden className="mx-2 text-white/25">
                    ·
                  </span>
                  Sem. {node.week_number}
                </>
              ) : null}
            </p>
            <h1 className="break-words font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {node.title}
            </h1>
            {node.description ? (
              <p className="mt-1.5 break-words pr-6 text-sm leading-relaxed text-foreground sm:pr-10">
                {node.description}
              </p>
            ) : null}
            <p className="mt-1.5 text-left text-sm font-medium leading-snug text-[color-mix(in_oklch,var(--neuma-coral)_62%,white)]">
              {levelAvailableLabel(opensOn)}
            </p>
          </div>
        </div>
      </header>

      {preview || cover ? (
        <article className="w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_0_oklch(1_0_0/8%)]">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="aspect-video w-full bg-black/40 object-cover"
            />
          ) : null}
          {preview ? (
            <p className="whitespace-pre-wrap px-5 py-5 text-center text-[15px] leading-relaxed text-foreground sm:px-6">
              {preview}
            </p>
          ) : null}
        </article>
      ) : null}

      <LevelCountdown opensOn={opensOn} variant="stage" />
    </div>
  );
}
