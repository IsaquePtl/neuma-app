import { SignupPageClient } from "@/components/signup-page-client";
import { isBillingEnabled } from "@/lib/billing/access";
import { getSignupLeadByResumeToken } from "@/lib/actions/signup-leads";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; oauth?: string; resume?: string }>;
}) {
  const { error, oauth, resume } = await searchParams;
  const resumeLead = resume
    ? await getSignupLeadByResumeToken(resume)
    : null;

  return (
    <SignupPageClient
      error={
        error ??
        (resume && !resumeLead
          ? "Link de retoma inválido ou já utilizado. Recomeça o registo."
          : undefined)
      }
      oauthFromLogin={oauth === "1"}
      billingEnabled={isBillingEnabled()}
      resumeLead={
        resumeLead
          ? {
              email: resumeLead.email,
              firstName: resumeLead.firstName,
              lastName: resumeLead.lastName,
              age: resumeLead.age,
              gender: resumeLead.gender,
              resumeToken: resumeLead.resumeToken,
            }
          : null
      }
    />
  );
}
