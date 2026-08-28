import { SignupPageClient } from "@/components/signup-page-client";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <SignupPageClient error={error} />;
}
