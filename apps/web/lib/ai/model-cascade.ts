import "server-only";

import { generateObject, type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import { xai } from "@ai-sdk/xai";
import type { z } from "zod";

export type CascadeAttempt = {
  id: string;
  label: string;
  ok: boolean;
  error?: string;
};

type CascadeResult<T> = {
  object: T;
  source: string;
  attempts: CascadeAttempt[];
};

type ModelSlot = {
  id: string;
  label: string;
  ready: () => boolean;
  model: () => LanguageModel;
};

/**
 * Free / credit cascade (custo ~0):
 * 1) Gemini (Google AI Studio free tier)
 * 2) Grok (xAI credits / free plan)
 * Quando um falha (quota/429/rede), tenta o seguinte.
 */
function buildSlots(): ModelSlot[] {
  const googleKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
  const xaiKey = Boolean(process.env.XAI_API_KEY?.trim());

  const slots: ModelSlot[] = [];

  if (googleKey) {
    for (const [id, label] of [
      ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"],
      ["gemini-2.0-flash-lite", "Gemini 2.0 Flash-Lite"],
      ["gemini-2.0-flash", "Gemini 2.0 Flash"],
      ["gemini-2.5-flash", "Gemini 2.5 Flash"],
    ] as const) {
      slots.push({
        id: `google:${id}`,
        label,
        ready: () => true,
        model: () => google(id),
      });
    }
  }

  if (xaiKey) {
    // Modelos mais baratos / rápidos primeiro
    for (const [id, label] of [
      ["grok-4-1-fast-non-reasoning", "Grok 4.1 Fast"],
      ["grok-4-fast-non-reasoning", "Grok 4 Fast"],
      ["grok-3-mini", "Grok 3 Mini"],
    ] as const) {
      slots.push({
        id: `xai:${id}`,
        label,
        ready: () => true,
        model: () => xai(id),
      });
    }
  }

  return slots;
}

function isRetryable(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("rate") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("unavailable") ||
    lower.includes("503") ||
    lower.includes("timeout") ||
    lower.includes("fetch failed") ||
    lower.includes("model") ||
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("insufficient") ||
    lower.includes("credit") ||
    lower.includes("billing")
  );
}

export async function generateObjectCascade<T extends z.ZodType>({
  schema,
  system,
  prompt,
}: {
  schema: T;
  system: string;
  prompt: string;
}): Promise<CascadeResult<z.infer<T>>> {
  const slots = buildSlots();
  const attempts: CascadeAttempt[] = [];

  if (slots.length === 0) {
    throw new Error("NO_FREE_MODELS");
  }

  let lastError: unknown;

  for (const slot of slots) {
    if (!slot.ready()) continue;
    try {
      const { object } = await generateObject({
        model: slot.model(),
        schema,
        system,
        prompt,
      });
      attempts.push({ id: slot.id, label: slot.label, ok: true });
      return {
        object: object as z.infer<T>,
        source: slot.label,
        attempts,
      };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({
        id: slot.id,
        label: slot.label,
        ok: false,
        error: message.slice(0, 180),
      });
      if (!isRetryable(err)) break;
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "todos os free tiers falharam";
  const error = new Error(`CASCADE_EXHAUSTED: ${detail}`) as Error & {
    attempts: CascadeAttempt[];
  };
  error.attempts = attempts;
  throw error;
}

export function hasAnyAiKey() {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.XAI_API_KEY?.trim(),
  );
}
