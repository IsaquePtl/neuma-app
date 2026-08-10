import "server-only";

import crypto from "node:crypto";

import type { Json } from "@/lib/types/database.types";

type TallyField = {
  key?: string;
  label?: string;
  type?: string;
  value?: unknown;
  options?: Array<{ id?: string; text?: string }>;
};

type TallyPayload = {
  eventId?: string;
  eventType?: string;
  createdAt?: string;
  data?: {
    responseId?: string;
    submissionId?: string;
    respondentId?: string;
    formId?: string;
    formName?: string;
    createdAt?: string;
    fields?: TallyField[];
  };
};

export type TallyAnswer = {
  key: string | null;
  label: string | null;
  type: string | null;
  value: Json;
  options?: Array<{ id?: string; text?: string }> | null;
};

function toJson(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toJson(v)]),
    );
  }
  return String(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function fileUrl(field: TallyField) {
  if (!Array.isArray(field.value)) return null;
  for (const entry of field.value) {
    if (
      entry &&
      typeof entry === "object" &&
      "url" in entry &&
      typeof entry.url === "string" &&
      entry.url
    ) {
      return entry.url;
    }
  }
  return null;
}

function firstMatch(
  fields: TallyField[],
  predicate: (field: TallyField) => boolean,
) {
  return fields.find(predicate);
}

function fieldString(field?: TallyField | null) {
  if (!field) return "";
  if (typeof field.value === "string") return field.value.trim();
  if (typeof field.value === "number") return String(field.value);
  return "";
}

export function getTallyConfig() {
  const secrets = [
    process.env.TALLY_WEBHOOK_SECRET,
    process.env.TALLY_CHECKIN_WEBHOOK_SECRET,
    process.env.TALLY_ONBOARDING_WEBHOOK_SECRET,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return {
    webhookSecrets: [...new Set(secrets)],
    onboardingFormId: process.env.TALLY_ONBOARDING_FORM_ID || "44RJrA",
    checkinFormId: process.env.TALLY_CHECKIN_FORM_ID || "gDXd04",
  };
}

export function verifyTallySignature({
  rawBody,
  signature,
  secrets,
}: {
  rawBody: string;
  signature: string | null;
  secrets: string[];
}) {
  // Sem secret configurado: aceita (dev). Com secrets: pelo menos um tem de bater.
  if (secrets.length === 0) return true;
  if (!signature) return false;

  return secrets.some((secret) => {
    const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    const sig = Buffer.from(signature);
    const expected = Buffer.from(digest);
    return sig.length === expected.length && crypto.timingSafeEqual(sig, expected);
  });
}

export function parseTallyPayload(raw: string) {
  const payload = JSON.parse(raw) as TallyPayload;
  const fields = payload.data?.fields ?? [];
  const payloadJson = toJson(payload);
  const answers: TallyAnswer[] = fields.map((field) => ({
    key: field.key ?? null,
    label: field.label ?? null,
    type: field.type ?? null,
    value: toJson(field.value),
    options: field.options?.length
      ? field.options.map((option) => ({
          id: option.id,
          text: option.text,
        }))
      : null,
  }));

  const emailField =
    firstMatch(fields, (field) => field.type === "INPUT_EMAIL") ??
    firstMatch(fields, (field) => /email|e-mail/i.test(field.label ?? ""));

  const nameField =
    firstMatch(fields, (field) => /nome|name/i.test(field.label ?? "")) ??
    firstMatch(fields, (field) => field.type === "INPUT_TEXT");

  const notesField =
    firstMatch(
      fields,
      (field) =>
        /notas|mensagem|message|coment|dificuldade|check.?in|texto/i.test(
          field.label ?? "",
        ),
    ) ??
    firstMatch(
      fields,
      (field) => field.type === "TEXTAREA" || field.type === "INPUT_TEXTAREA",
    ) ??
    firstMatch(fields, (field) => field.type === "INPUT_TEXT");

  const studentIdField = firstMatch(
    fields,
    (field) =>
      /student_id/i.test(field.key ?? "") || /student_id/i.test(field.label ?? ""),
  );
  const nodeIdField = firstMatch(
    fields,
    (field) => /node_id/i.test(field.key ?? "") || /node_id/i.test(field.label ?? ""),
  );
  const fileField =
    firstMatch(fields, (field) => field.type === "FILE_UPLOAD") ??
    firstMatch(fields, (field) => Array.isArray(field.value) && fileUrl(field) !== null);

  const studentId = fieldString(studentIdField);
  const nodeId = fieldString(nodeIdField);

  return {
    payload: payloadJson,
    answers,
    eventId: payload.eventId ?? null,
    formId: payload.data?.formId ?? null,
    formName: payload.data?.formName ?? null,
    responseId: payload.data?.responseId ?? payload.data?.submissionId ?? null,
    submissionId: payload.data?.submissionId ?? null,
    createdAt: payload.data?.createdAt ?? payload.createdAt ?? null,
    respondentName: fieldString(nameField) || null,
    respondentEmail: fieldString(emailField) || null,
    notes: fieldString(notesField) || null,
    videoUrl: fileField ? fileUrl(fileField) : null,
    studentId: looksLikeUuid(studentId) ? studentId : null,
    nodeId: looksLikeUuid(nodeId) ? nodeId : null,
  };
}
