import Link from "next/link";
import { CalendarCheck, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormRenderer } from "@/components/form-renderer";
import { CalEmbed } from "@/components/calcom-embed";
import { submitFormResponse } from "@/lib/actions/forms";
import { completeOnboarding } from "@/lib/actions/onboarding";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  const supabase = await createClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, title, description")
    .eq("is_onboarding", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: questions } = form
    ? await supabase
        .from("form_questions")
        .select("id, label, help_text, type, options, required, order_index")
        .eq("form_id", form.id)
        .order("order_index", { ascending: true })
    : { data: null };

  const showCall = step === "call" || !form;

  if (showCall) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Vamos falar.
          </h1>
          <p className="text-muted-foreground">
            Agenda a tua primeira call. E aqui que desenhamos, juntos, o teu
            percurso.
          </p>
        </div>

        <CalEmbed />

        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-0.5 size-5 text-[var(--neuma-coral)]" />
            <div>
              <p className="font-medium">Ja agendaste?</p>
              <p className="text-sm text-muted-foreground">
                Entra na Neuma. O teu percurso aparece assim que o preparar.
              </p>
            </div>
          </div>
          <form action={completeOnboarding}>
            <Button type="submit" className="gap-2">
              Entrar na Neuma <ArrowRight className="size-4" />
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Bem-vindo a Neuma</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {form?.title ?? "Diagnostico inicial"}
        </h1>
        {form?.description ? (
          <p className="text-muted-foreground">{form.description}</p>
        ) : (
          <p className="text-muted-foreground">
            Conta-me um pouco sobre ti para prepararmos a primeira call.
          </p>
        )}
      </div>

      <Card className="p-6">
        <form action={submitFormResponse} className="space-y-6">
          <input type="hidden" name="form_id" value={form!.id} />
          <input
            type="hidden"
            name="redirect_to"
            value="/onboarding?step=call"
          />
          <FormRenderer questions={questions ?? []} />
          <Button type="submit" className="gap-2">
            Continuar <ArrowRight className="size-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
