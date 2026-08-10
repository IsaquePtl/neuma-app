import { SplashScreen } from "@/components/splash-screen";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh max-h-dvh w-full items-center justify-center overflow-hidden px-4 py-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <SplashScreen />
      {children}
    </div>
  );
}
