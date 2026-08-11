/** Fundo edge-to-edge — ignora safe areas; pinta sob notch / Dynamic Island / home indicator. */
export function AppBackground() {
  return (
    <div
      aria-hidden
      className="neuma-bg pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen min-h-[100dvh]"
    />
  );
}
