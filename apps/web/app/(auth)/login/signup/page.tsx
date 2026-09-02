import { SignupPageClient } from "@/components/signup-page-client";
import { isBillingEnabled } from "@/lib/billing/access";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; oauth?: string }>;
}) {
  const { error, oauth } = await searchParams;
  return (
    <SignupPageClient
      error={error}
      oauthFromLogin={oauth === "1"}
      billingEnabled={isBillingEnabled()}
    />
  );
}
