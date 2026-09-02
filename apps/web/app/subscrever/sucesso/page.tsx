import { redirect } from "next/navigation";

import { CheckoutSuccessClient } from "@/components/checkout-success-client";
import { getSessionUser } from "@/lib/auth/session";

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  return (
    <main className="neuma-app-bg flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <CheckoutSuccessClient sessionId={params.session_id ?? null} />
    </main>
  );
}
