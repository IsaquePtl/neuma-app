import { SplashScreen } from "@/components/splash-screen";
import { AuthViewport } from "@/components/auth-viewport";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SplashScreen />
      <AuthViewport>{children}</AuthViewport>
    </>
  );
}
