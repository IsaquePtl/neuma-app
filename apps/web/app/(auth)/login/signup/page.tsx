import { SignupPageClient } from "@/components/signup-page-client";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; oauth?: string }>;
}) {
  const { error, oauth } = await searchParams;
  return (
    <SignupPageClient error={error} oauthFromLogin={oauth === "1"} />
  );
}
