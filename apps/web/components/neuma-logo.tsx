import Image from "next/image";

export function NeumaLogo({
  size = 28,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <Image
        src="/brand/mark-white.png"
        alt="Neuma"
        width={size}
        height={size}
        priority
        className="shrink-0"
        style={{ width: size, height: size, maxWidth: size, maxHeight: size }}
      />
      {withWordmark ? (
        <span className="text-xl font-bold tracking-tight">Neuma</span>
      ) : null}
    </div>
  );
}
