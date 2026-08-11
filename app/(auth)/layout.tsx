import { SplashScreen } from "@/components/splash-screen";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-4 py-6">
      <SplashScreen />
      {children}
    </div>
  );
}
