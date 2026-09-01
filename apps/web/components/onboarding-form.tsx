"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getOnboardingSubmissionStatus,
  submitOnboarding,
} from "@/lib/actions/onboarding";
import {
  ONBOARDING_FIELDS,
  ONBOARDING_WIZARD_STEP_COUNT,
  ONBOARDING_WIZARD_STEPS,
  resolveOnboardingLabel,
  type OnboardingFieldDef,
  type OnboardingMcOption,
  type OnboardingStepDef,
} from "@/lib/onboarding/questions";
import { cn } from "@/lib/utils";

const SIGNUP_HREF = "/login/signup";

/** Scroll shell — steps are vertically centered; overflow scrolls when content is tall. */
const ONBOARDING_SCROLL =
  "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 " +
  "pb-[max(1rem,env(safe-area-inset-bottom,0px))] min-h-full";

const ONBOARDING_CENTER_BLOCK =
  "my-auto py-[max(1rem,env(safe-area-inset-top,0px))]";

const INPUT_CLASS =
  "h-12 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-base text-white placeholder:text-white/50 focus-visible:border-white/20 focus-visible:ring-0";

const TEXTAREA_CLASS =
  "min-h-[8rem] resize-none rounded-2xl border-white/10 bg-white/[0.04] px-4 py-3 text-base leading-relaxed text-white placeholder:text-white/50 focus-visible:border-white/20 focus-visible:ring-0";

const QUESTION_CLASS =
  "whitespace-pre-line text-lg font-semibold leading-snug sm:text-xl";

const INTRO_EMPHASIS_CLASS = "font-semibold text-white";

function OnboardingIntroBody() {
  return (
    <div className="space-y-3 text-base leading-relaxed text-white/90">
      <p>
        Olá! Sou o{" "}
        <strong className={INTRO_EMPHASIS_CLASS}>Isaque Portilho</strong>, músico,
        produtor musical e fundador da Neuma. Se tens o objetivo de{" "}
        <strong className={INTRO_EMPHASIS_CLASS}>evoluir na música</strong> e
        sonhas em descobrir o teu talento, este acompanhamento 1:1 é perfeito
        para ti. A Neuma 1:1 não é apenas uma mentoria; é um percurso
        totalmente{" "}
        <strong className={INTRO_EMPHASIS_CLASS}>personalizado</strong>, direto
        e com uma ordem sequencial{" "}
        <strong className={INTRO_EMPHASIS_CLASS}>inteligente</strong>, pensada
        com um único propósito:{" "}
        <strong className={INTRO_EMPHASIS_CLASS}>levar-te</strong> ao{" "}
        <strong className={INTRO_EMPHASIS_CLASS}>nível que desejas</strong> na
        música.
      </p>
      <p>
        Se tens interesse em descobrir o teu{" "}
        <strong className={INTRO_EMPHASIS_CLASS}>percurso Neuma</strong>,
        preenche este formulário para eu analisar e avaliar se faz sentido
        avançarmos juntos.
      </p>
    </div>
  );
}

type FormValues = Record<string, string>;

type Phase = "form" | "thankYou";

function stepIndexForWizardStep(step: number) {
  return Math.min(Math.max(step, 1), ONBOARDING_WIZARD_STEP_COUNT);
}

function getStepDef(step: number): OnboardingStepDef {
  return ONBOARDING_WIZARD_STEPS[stepIndexForWizardStep(step) - 1];
}

function optionText(options: OnboardingMcOption[] | undefined, id: string) {
  return options?.find((option) => option.id === id)?.text ?? id;
}

function isOtherOption(
  options: OnboardingMcOption[] | undefined,
  id: string,
) {
  return Boolean(options?.find((option) => option.id === id)?.allowsOther);
}

function validateStep(
  step: number,
  values: FormValues,
  nome: string,
): string | null {
  const stepDef = getStepDef(step);
  if (stepDef.kind !== "fields") return null;

  for (const field of stepDef.fields) {
    const label = field.dynamicNome
      ? resolveOnboardingLabel(field.label, nome)
      : field.label;
    const raw = values[field.tallyKey]?.trim() ?? "";

    if (field.type === "MULTIPLE_CHOICE") {
      if (field.required && !raw) {
        return `Escolhe uma opção em «${label.split("\n")[0]}»`;
      }
      if (
        raw &&
        isOtherOption(field.options, raw) &&
        !values[`${field.tallyKey}__other`]?.trim()
      ) {
        return "Descreve a opção «Outro» antes de continuar";
      }
      continue;
    }

    if (field.type === "LINEAR_SCALE") {
      if (field.required && raw === "") {
        return `Escolhe um valor de ${field.min ?? 0} a ${field.max ?? 10}`;
      }
      continue;
    }

    if (field.type === "INPUT_NUMBER") {
      if (field.required && !raw) {
        return "Indica a tua idade";
      }
      const age = Number(raw);
      if (raw && (!Number.isFinite(age) || age < 1 || age > 120)) {
        return "Indica uma idade válida";
      }
      continue;
    }

    if (field.type === "INPUT_EMAIL") {
      if (field.required && !raw) return "Indica o teu email";
      if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return "Indica um email válido";
      }
      continue;
    }

    if (field.required && !raw) {
      return `Preenche «${label.split("\n")[0]}» antes de continuar`;
    }
  }

  return null;
}

function McCards({
  field,
  nome,
  value,
  otherValue,
  onSelect,
  onOtherChange,
}: {
  field: OnboardingFieldDef;
  nome: string;
  value: string;
  otherValue: string;
  onSelect: (optionId: string) => void;
  onOtherChange: (text: string) => void;
}) {
  const label = field.dynamicNome
    ? resolveOnboardingLabel(field.label, nome)
    : field.label;

  return (
    <div className="space-y-3">
      <h2 className={QUESTION_CLASS}>{label}</h2>
      <div className="grid gap-2">
        {(field.options ?? []).map((option, index) => {
          const selected = value === option.id;
          return (
            <div key={option.id} className="space-y-2">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 transition-all",
                  selected
                    ? "border-white/22 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.06]",
                )}
              >
                <input
                  type="radio"
                  name={field.tallyKey}
                  value={option.id}
                  checked={selected}
                  onChange={() => onSelect(option.id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
                    selected
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/70",
                  )}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 pt-0.5 text-sm font-medium leading-snug sm:text-base">
                  {option.text}
                </span>
              </label>
              {option.allowsOther && selected ? (
                <Input
                  value={otherValue}
                  onChange={(e) => onOtherChange(e.target.value)}
                  autoFocus
                  placeholder="Descreve a tua relação com a música…"
                  className={INPUT_CLASS}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LinearScaleField({
  field,
  value,
  onChange,
}: {
  field: OnboardingFieldDef;
  value: string;
  onChange: (next: string) => void;
}) {
  const min = field.min ?? 0;
  const max = field.max ?? 10;
  const numbers = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  );

  return (
    <div className="space-y-3">
      <h2 className={QUESTION_CLASS}>{field.label}</h2>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {numbers.map((num) => {
          const selected = value === String(num);
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(String(num))}
              className={cn(
                "grid h-12 place-items-center rounded-2xl border text-base font-semibold tabular-nums transition-all",
                selected
                  ? "border-white/22 bg-white/[0.12] text-white"
                  : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/18 hover:bg-white/[0.06]",
              )}
            >
              {num}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-sm text-white/70">
        <span>{min} — Iniciante</span>
        <span>{max} — Avançado</span>
      </div>
    </div>
  );
}

function FieldBlock({
  field,
  nome,
  values,
  setValue,
  readOnlyEmail,
}: {
  field: OnboardingFieldDef;
  nome: string;
  values: FormValues;
  setValue: (key: string, value: string) => void;
  readOnlyEmail?: boolean;
}) {
  const label = field.dynamicNome
    ? resolveOnboardingLabel(field.label, nome)
    : field.label;
  const value = values[field.tallyKey] ?? "";
  const otherKey = `${field.tallyKey}__other`;

  if (field.type === "MULTIPLE_CHOICE") {
    return (
      <McCards
        field={field}
        nome={nome}
        value={value}
        otherValue={values[otherKey] ?? ""}
        onSelect={(optionId) => setValue(field.tallyKey, optionId)}
        onOtherChange={(text) => setValue(otherKey, text)}
      />
    );
  }

  if (field.type === "LINEAR_SCALE") {
    return (
      <LinearScaleField
        field={field}
        value={value}
        onChange={(next) => setValue(field.tallyKey, next)}
      />
    );
  }

  if (field.type === "TEXTAREA") {
    return (
      <div className="space-y-3">
        <h2 className={QUESTION_CLASS}>{label}</h2>
        <Textarea
          value={value}
          onChange={(e) => setValue(field.tallyKey, e.target.value)}
          rows={5}
          autoFocus
          placeholder="Escreve aqui…"
          className={TEXTAREA_CLASS}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className={QUESTION_CLASS}>{label}</h2>
      <Input
        type={
          field.type === "INPUT_NUMBER"
            ? "number"
            : field.type === "INPUT_EMAIL"
              ? "email"
              : field.type === "INPUT_PHONE_NUMBER"
                ? "tel"
                : "text"
        }
        value={value}
        onChange={(e) => setValue(field.tallyKey, e.target.value)}
        readOnly={readOnlyEmail}
        autoFocus={!readOnlyEmail}
        min={field.type === "INPUT_NUMBER" ? field.min : undefined}
        max={field.type === "INPUT_NUMBER" ? field.max : undefined}
        placeholder={field.placeholder}
        className={cn(INPUT_CLASS, readOnlyEmail && "opacity-70")}
      />
    </div>
  );
}

export function OnboardingForm({
  studentId,
  initialName = "",
  initialEmail = "",
  alreadySubmitted = false,
  backHref = "/home",
  backLabel = "Ir para a app",
}: {
  studentId?: string | null;
  initialName?: string;
  initialEmail?: string;
  alreadySubmitted?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const isLoggedIn = Boolean(studentId);
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>(
    alreadySubmitted ? "thankYou" : "form",
  );
  const [returningSubmitted, setReturningSubmitted] =
    useState(alreadySubmitted);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<FormValues>(() => ({
    [ONBOARDING_FIELDS.name.tallyKey]: initialName,
    [ONBOARDING_FIELDS.email.tallyKey]: initialEmail,
  }));

  const nome = values[ONBOARDING_FIELDS.name.tallyKey]?.trim() ?? "";
  const stepDef = getStepDef(step);
  const isLastStep = step === ONBOARDING_WIZARD_STEP_COUNT;

  useEffect(() => {
    if (!isLoggedIn || alreadySubmitted) return;
    let cancelled = false;
    void getOnboardingSubmissionStatus().then((submitted) => {
      if (cancelled || !submitted) return;
      setReturningSubmitted(true);
      setPhase("thankYou");
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, alreadySubmitted]);

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1));
  }

  function goNext() {
    const error = validateStep(step, values, nome);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((current) => Math.min(ONBOARDING_WIZARD_STEP_COUNT, current + 1));
  }

  function buildSubmissionPayload() {
    const payloadValues: FormValues = { ...values };

    for (const field of Object.values(ONBOARDING_FIELDS)) {
      if (field.type !== "MULTIPLE_CHOICE") continue;
      const selected = payloadValues[field.tallyKey];
      if (!selected) continue;
      if (isOtherOption(field.options, selected)) {
        payloadValues[field.tallyKey] =
          payloadValues[`${field.tallyKey}__other`]?.trim() ?? "";
      } else {
        payloadValues[field.tallyKey] = optionText(field.options, selected);
      }
    }

    if (studentId) {
      payloadValues[ONBOARDING_FIELDS.studentId.tallyKey] = studentId;
    }

    return payloadValues;
  }

  function handleSend() {
    const error = validateStep(step, values, nome);
    if (error) {
      toast.error(error);
      return;
    }

    const submissionValues = buildSubmissionPayload();

    startTransition(async () => {
      try {
        const result = await submitOnboarding(submissionValues);
        if (!result.ok) {
          toast.error(result.error ?? "Não foi possível enviar");
          return;
        }
        if (result.alreadySubmitted) {
          setReturningSubmitted(true);
          setPhase("thankYou");
          return;
        }
        if (isLoggedIn) {
          setPhase("thankYou");
          router.refresh();
          return;
        }
        router.replace(SIGNUP_HREF);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível enviar",
        );
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  const canAdvance =
    stepDef.kind === "intro" ||
    validateStep(step, values, nome) === null;

  const formRef = useRef<HTMLFormElement>(null);
  const keyboardStateRef = useRef({
    canAdvance,
    isLastStep,
    pending,
    goNext,
    handleSend,
  });

  useEffect(() => {
    keyboardStateRef.current = {
      canAdvance,
      isLastStep,
      pending,
      goNext,
      handleSend,
    };
  }, [canAdvance, isLastStep, pending, goNext, handleSend]);

  useEffect(() => {
    if (phase !== "form") return;

    function shouldHandleEnterTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;

      if (formRef.current?.contains(target)) {
        if (target instanceof HTMLButtonElement) return false;
        if (target instanceof HTMLAnchorElement) return false;
        return true;
      }

      return (
        target === document.body || target === document.documentElement
      );
    }

    function onDocumentKeyDown(e: KeyboardEvent) {
      const { canAdvance, isLastStep, pending, goNext, handleSend } =
        keyboardStateRef.current;

      if (e.key !== "Enter" || pending) return;
      if (!shouldHandleEnterTarget(e.target)) return;

      const target = e.target;
      if (target instanceof HTMLTextAreaElement && e.shiftKey) return;

      e.preventDefault();
      if (!canAdvance) return;

      if (isLastStep) {
        handleSend();
      } else {
        goNext();
      }
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [phase]);

  if (phase === "thankYou") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 text-center text-white">
        <CheckCircle2 className="size-14 text-white" />
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {returningSubmitted
              ? "Já preencheste o onboarding"
              : `Obrigado, ${nome || "amigo"}!`}
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-white/80">
            {returningSubmitted
              ? "Tudo recebido. Vou analisar o teu perfil para estruturar como vamos aplicar este 1:1 à tua realidade."
              : "Tudo recebido. Falo contigo em breve!"}
          </p>
        </div>
        {isLoggedIn ? (
          <Link
            href={backHref}
            className="mt-2 rounded-xl bg-white/10 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-white/15"
          >
            {backLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-white">
      <Link
        href={isLoggedIn ? backHref : SIGNUP_HREF}
        className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-20 text-base text-white/70 underline-offset-4 hover:text-white hover:underline"
      >
        {isLoggedIn ? backLabel : "Criar conta"}
      </Link>

      <div className={ONBOARDING_SCROLL}>
        <div
          className={cn(
            "mx-auto flex w-full max-w-md flex-col",
            ONBOARDING_CENTER_BLOCK,
          )}
        >
          <Image
            src="/brand/mark-white.png"
            alt="Neuma"
            width={80}
            height={80}
            priority
            className="mb-4 h-16 w-16 shrink-0 self-start desktop:mb-5 desktop:h-20 desktop:w-20"
          />

          <p className="mb-4 text-sm text-white/70">
            {step} de {ONBOARDING_WIZARD_STEP_COUNT}
          </p>

          <form
            ref={formRef}
            onSubmit={onSubmit}
            className="flex flex-col gap-6"
          >
          {stepDef.kind === "intro" ? (
            <section className="space-y-4">
              <p className="font-heading text-xl font-semibold text-white/80 sm:text-2xl">
                Onboarding Neuma 1:1
              </p>
              <OnboardingIntroBody />
            </section>
          ) : null}

          {stepDef.kind === "fields" ? (
            <section className="space-y-5">
              {step > 1 ? (
                <div className="flex h-8 shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Anterior"
                    disabled={pending}
                    onClick={goBack}
                    className="text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeft className="size-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex h-8 shrink-0 items-center" />
              )}

              {stepDef.fields.map((field) => (
                <FieldBlock
                  key={field.tallyKey}
                  field={field}
                  nome={nome}
                  values={values}
                  setValue={setValue}
                  readOnlyEmail={
                    isLoggedIn &&
                    field.tallyKey === ONBOARDING_FIELDS.email.tallyKey
                  }
                />
              ))}
            </section>
          ) : null}

          <div className="flex shrink-0 flex-col gap-2">
            {!isLastStep ? (
              <Button
                type="button"
                size="lg"
                variant="secondary"
                disabled={!canAdvance}
                onClick={goNext}
                className={cn(
                  "h-12 w-full gap-2 rounded-2xl border text-base font-medium shadow-none",
                  canAdvance
                    ? "border-white/22 bg-white/18 text-white hover:bg-white/[0.24] hover:text-white"
                    : "border-white/8 bg-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/50",
                )}
              >
                {stepDef.kind === "intro" ? "Começar" : "Seguinte"}
                <ArrowRight className="size-5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={!canAdvance || pending}
                onClick={handleSend}
                className="h-14 w-full gap-2 rounded-2xl text-lg font-semibold"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    A enviar…
                  </>
                ) : (
                  "Enviar"
                )}
              </Button>
            )}
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}
