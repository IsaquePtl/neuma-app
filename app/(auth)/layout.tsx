import { SplashScreen } from "@/components/splash-screen";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={
        "flex h-dvh max-h-dvh w-full flex-1 touch-manipulation items-center " +
        "justify-center overflow-hidden overscroll-none px-4 py-6 " +
        "pt-[max(1.5rem,env(safe-area-inset-top,0px))] " +
        "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
      }
    >
      <SplashScreen />
      {children}
    </div>
  );
}
