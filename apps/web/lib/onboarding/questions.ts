export const ONBOARDING_FORM_ID = "44RJrA";
export const ONBOARDING_FORM_NAME = "Onboarding Neuma 1:1";
export const ONBOARDING_STUDENT_ID_KEY = "26a821c1-4484-43a9-9a17-c626d06bc5b5";

export type OnboardingFieldType =
  | "INPUT_TEXT"
  | "INPUT_NUMBER"
  | "INPUT_EMAIL"
  | "INPUT_PHONE_NUMBER"
  | "INPUT_LINK"
  | "TEXTAREA"
  | "MULTIPLE_CHOICE"
  | "LINEAR_SCALE"
  | "HIDDEN";

export type OnboardingMcOption = {
  id: string;
  text: string;
  allowsOther?: boolean;
};

export type OnboardingFieldDef = {
  tallyKey: string;
  label: string;
  type: OnboardingFieldType;
  required?: boolean;
  placeholder?: string;
  options?: OnboardingMcOption[];
  min?: number;
  max?: number;
  /** Replace `{nome}` in labels at render/submit time. */
  dynamicNome?: boolean;
};

export type OnboardingStepDef =
  | {
      id: "intro";
      kind: "intro";
    }
  | {
      id: string;
      kind: "fields";
      title?: string;
      fields: OnboardingFieldDef[];
    }
  | {
      id: "thank-you";
      kind: "thank-you";
    };

export const ONBOARDING_MUSIC_RELATION_OPTIONS: OnboardingMcOption[] = [
  { id: "zero", text: "Quero começar do zero" },
  { id: "stagnated", text: "Sei o básico, mas estou estagnado" },
  {
    id: "technique",
    text: "Toco regularmente, mas sinto que me faltam bases/técnica",
  },
  { id: "other", text: "Outro", allowsOther: true },
];

export const ONBOARDING_TIMELINE_OPTIONS: OnboardingMcOption[] = [
  { id: "short", text: "Curto prazo (1 mês)" },
  { id: "medium", text: "Médio prazo (3-6 meses)" },
  { id: "long", text: "Longo prazo (1 ano/+)" },
  {
    id: "unsure",
    text: "Ainda não sei, gostava de perceber melhor",
  },
];

export const ONBOARDING_INVESTMENT_OPTIONS: OnboardingMcOption[] = [
  { id: "up100", text: "Até 100€" },
  { id: "100-150", text: "100€ a 150€" },
  { id: "150-200", text: "150€ a 200€" },
  { id: "200-250", text: "200€ a 250€+" },
];

export const ONBOARDING_PRIORITY_OPTIONS: OnboardingMcOption[] = [
  { id: "top", text: "Super prioritário" },
  { id: "medium", text: "Prioridade média" },
  {
    id: "soon",
    text: "Algo que estou a considerar para breve",
  },
  { id: "curiosity", text: "Curiosidade, sem urgência" },
];

export const ONBOARDING_CONTACT_PREFERENCE_OPTIONS: OnboardingMcOption[] = [
  { id: "whatsapp", text: "Whatsapp" },
  { id: "instagram", text: "Instagram" },
];

export const ONBOARDING_FIELDS = {
  name: {
    tallyKey: "a55288a3-5482-4472-8c28-471838e88515",
    label: "Qual o teu nome?",
    type: "INPUT_TEXT",
    required: true,
  },
  age: {
    tallyKey: "604ae37b-6b0b-4275-a333-fdb3bcdc9fba",
    label: "Qual a tua idade?",
    type: "INPUT_NUMBER",
    required: true,
    min: 1,
    max: 120,
  },
  musicRelation: {
    tallyKey: "86a6d9ff-7ad7-43d5-a54c-230f363141b8",
    label: "{nome}, como descreves a tua relação atual com a música?",
    type: "MULTIPLE_CHOICE",
    required: true,
    dynamicNome: true,
    options: ONBOARDING_MUSIC_RELATION_OPTIONS,
  },
  levelScale: {
    tallyKey: "799ab9bb-ae8a-434d-8fe4-1556e73302b9",
    label:
      "Numa escala de 0 a 10, como avalias o teu nível atual na música?",
    type: "LINEAR_SCALE",
    required: true,
    min: 0,
    max: 10,
  },
  levelWhy: {
    tallyKey: "e15a84b4-e646-48c6-b2c3-6375c55d5945",
    label: "Porquê?",
    type: "TEXTAREA",
    required: true,
  },
  challenge: {
    tallyKey: "932cf1d1-e975-45c8-b1e8-4621596d9cf2",
    label: "Qual é o teu maior desafio na música neste momento?",
    type: "TEXTAREA",
    required: true,
  },
  goals: {
    tallyKey: "3423c463-f3dc-4a83-9d06-e7f09d68c2f6",
    label: "Qual é o teu objetivo a curto e longo prazo?",
    type: "TEXTAREA",
    required: false,
  },
  goalsWhy: {
    tallyKey: "14b4343b-7566-48b9-a1bd-dc0a7e40fe12",
    label: "Porque é que tens esse objetivo?",
    type: "TEXTAREA",
    required: true,
  },
  experience: {
    tallyKey: "ea61e981-937a-4cb5-8ab6-33382413533f",
    label:
      "Fala-me da tua experiência na música.\nJá foste acompanhado antes?",
    type: "TEXTAREA",
    required: true,
  },
  expectations: {
    tallyKey: "3093280b-4bb0-4942-be84-bd44eafa31a0",
    label: "O que estás à espera de alcançar com a Neuma 1:1?",
    type: "TEXTAREA",
    required: true,
  },
  timeline: {
    tallyKey: "a2925c8b-0101-4154-9d47-c26d0f9e81d4",
    label:
      "Se fizer sentido avançarmos com este percurso,\ncomo vês a nossa timeline?",
    type: "MULTIPLE_CHOICE",
    required: true,
    options: ONBOARDING_TIMELINE_OPTIONS,
  },
  investment: {
    tallyKey: "5e0e45d4-4bd0-4a69-b4f1-7d76f2850aba",
    label:
      "Para alinharmos expectativas, que faixa de investimento mensal estarias disposto(a) a investir?",
    type: "MULTIPLE_CHOICE",
    required: true,
    options: ONBOARDING_INVESTMENT_OPTIONS,
  },
  priority: {
    tallyKey: "13ee43c4-64a3-4101-a6c2-2b1ef45c931e",
    label:
      "Neste momento da tua vida, onde encaixa o nosso trabalho nas tuas prioridades?",
    type: "MULTIPLE_CHOICE",
    required: true,
    options: ONBOARDING_PRIORITY_OPTIONS,
  },
  email: {
    tallyKey: "193ecba6-0e70-4b2e-a223-09530742d6e9",
    label: "Email",
    type: "INPUT_EMAIL",
    required: true,
  },
  whatsapp: {
    tallyKey: "11459f9d-76f4-4e5f-90f5-8cc711b751c7",
    label: "Whatsapp",
    type: "INPUT_PHONE_NUMBER",
    required: true,
    placeholder: "+351…",
  },
  instagram: {
    tallyKey: "14921da9-ff34-4e8f-9d8b-586b3b7f8e32",
    label: "Instagram",
    type: "INPUT_LINK",
    required: true,
    placeholder: "https://instagram.com/…",
  },
  contactPreference: {
    tallyKey: "6171a334-29d6-4c7d-ba02-338e2ec05379",
    label: "Como preferes ser contactado?",
    type: "MULTIPLE_CHOICE",
    required: true,
    options: ONBOARDING_CONTACT_PREFERENCE_OPTIONS,
  },
  studentId: {
    tallyKey: ONBOARDING_STUDENT_ID_KEY,
    label: "student_id",
    type: "HIDDEN",
    required: false,
  },
} as const satisfies Record<string, OnboardingFieldDef>;

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  { id: "intro", kind: "intro" },
  {
    id: "name",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.name],
  },
  {
    id: "age",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.age],
  },
  {
    id: "music-relation",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.musicRelation],
  },
  {
    id: "level",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.levelScale, ONBOARDING_FIELDS.levelWhy],
  },
  {
    id: "challenge",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.challenge],
  },
  {
    id: "goals",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.goals],
  },
  {
    id: "goals-why",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.goalsWhy],
  },
  {
    id: "experience",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.experience],
  },
  {
    id: "expectations",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.expectations],
  },
  {
    id: "timeline",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.timeline],
  },
  {
    id: "investment",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.investment],
  },
  {
    id: "priority",
    kind: "fields",
    fields: [ONBOARDING_FIELDS.priority],
  },
  {
    id: "contact",
    kind: "fields",
    fields: [
      ONBOARDING_FIELDS.email,
      ONBOARDING_FIELDS.whatsapp,
      ONBOARDING_FIELDS.instagram,
      ONBOARDING_FIELDS.contactPreference,
    ],
  },
  { id: "thank-you", kind: "thank-you" },
];

/** Interactive wizard steps (intro → contact). */
export const ONBOARDING_WIZARD_STEPS = ONBOARDING_STEPS.filter(
  (step) => step.kind !== "thank-you",
);

export const ONBOARDING_WIZARD_STEP_COUNT = ONBOARDING_WIZARD_STEPS.length;

export function resolveOnboardingLabel(
  label: string,
  nome: string,
): string {
  return label.replaceAll("{nome}", nome.trim() || "tu");
}

export function onboardingFieldByKey(tallyKey: string) {
  return Object.values(ONBOARDING_FIELDS).find(
    (field) => field.tallyKey === tallyKey,
  );
}

export function onboardingAnswerFields(): OnboardingFieldDef[] {
  return (Object.values(ONBOARDING_FIELDS) as OnboardingFieldDef[]).filter(
    (field) => field.type !== "HIDDEN",
  );
}
