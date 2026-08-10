import { cn } from "@/lib/utils";

export function tallyEmbedUrl(
  formId: string,
  params?: Record<string, string | null | undefined>,
) {
  const url = new URL(`https://tally.so/embed/${formId}`);
  url.searchParams.set("alignLeft", "1");
  url.searchParams.set("hideTitle", "1");
  url.searchParams.set("transparentBackground", "1");
  url.searchParams.set("dynamicHeight", "1");

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export function TallyEmbed({
  formId,
  title,
  className,
  height = 760,
  params,
}: {
  formId: string;
  title: string;
  className?: string;
  height?: number;
  params?: Record<string, string | null | undefined>;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-white/10 bg-black/20",
        className,
      )}
    >
      <iframe
        src={tallyEmbedUrl(formId, params)}
        loading="lazy"
        width="100%"
        height={height}
        frameBorder="0"
        marginHeight={0}
        marginWidth={0}
        title={title}
        className="block w-full"
      />
    </div>
  );
}
