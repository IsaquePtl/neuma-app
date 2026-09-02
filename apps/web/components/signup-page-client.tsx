"use client";

import Image from "next/image";
import { useState } from "react";

import { SignupWizard } from "@/components/signup-form";
import { Card } from "@/components/ui/card";
import type { SignupWizardStep } from "@/lib/auth/signup-wizard";
import { cn } from "@/lib/utils";

export function SignupPageClient({
  error,
  oauthFromLogin = false,
  billingEnabled = false,
}: {
  error?: string;
  oauthFromLogin?: boolean;
  /** Só com billing ligado o signup avança para o passo de plano. */
  billingEnabled?: boolean;
}) {
  const [step, setStep] = useState<SignupWizardStep>("identity");
  const instant = step !== "identity";

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center desktop:items-stretch",
        instant && "auth-flow-instant",
      )}
    >
      {step === "identity" ? (
        <Image
          src="/brand/mark-white.png"
          alt="Neuma"
          width={96}
          height={96}
          priority
          className="auth-mobile-mark mb-6 h-20 w-20 animate-float desktop:hidden"
        />
      ) : null}

      <Card
        className={cn(
          "w-full p-6 sm:p-8",
          instant ? "auth-enter-form--instant" : "auth-enter-form animate-fade-up",
        )}
      >
        <SignupWizard
          error={error}
          oauthFromLogin={oauthFromLogin}
          billingEnabled={billingEnabled}
          onStepChange={setStep}
        />
      </Card>
    </div>
  );
}
