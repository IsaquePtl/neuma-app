import {
  instagramProfileUrl,
  whatsappChatUrl,
} from "@/lib/social-links";
import { cn } from "@/lib/utils";

export type TallyAnswerView = {
  key?: string | null;
  label?: string | null;
  type?: string | null;
  value?: unknown;
  options?: Array<{ id?: string; text?: string }> | null;
};

type FileEntry = {
  id?: string;
  name?: string;
  url?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionText(
  optionId: string,
  options?: Array<{ id?: string; text?: string }> | null,
) {
  return options?.find((option) => option.id === optionId)?.text ?? optionId;
}

function fileEntries(value: unknown): FileEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is FileEntry => {
    return isRecord(entry) && typeof entry.url === "string" && Boolean(entry.url);
  });
}

export function formatTallyAnswerText(
  answer: TallyAnswerView,
): string {
  const { value, type, options } = answer;

  if (value == null || value === "") return "—";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (type === "FILE_UPLOAD" || fileEntries(value).length > 0) {
      const files = fileEntries(value);
      if (files.length === 0) return "—";
      return files.map((file) => file.name || "Ficheiro").join(", ");
    }

    if (
      type === "MULTIPLE_CHOICE" ||
      type === "MULTI_SELECT" ||
      type === "CHECKBOXES" ||
      type === "DROPDOWN"
    ) {
      return value
        .map((entry) =>
          typeof entry === "string" ? optionText(entry, options) : String(entry),
        )
        .join(", ");
    }

    return value
      .map((entry) => {
        if (typeof entry === "string") return optionText(entry, options) || entry;
        if (isRecord(entry) && typeof entry.text === "string") return entry.text;
        if (isRecord(entry) && typeof entry.url === "string") {
          return entry.name ? String(entry.name) : "Ficheiro";
        }
        return String(entry);
      })
      .join(", ");
  }

  if (isRecord(value) && typeof value.text === "string") return value.text;
  return JSON.stringify(value);
}

export function TallyAnswerList({
  answers,
  className,
  compact = false,
}: {
  answers: TallyAnswerView[];
  className?: string;
  compact?: boolean;
}) {
  if (!answers.length) {
    return (
      <p className="text-sm text-muted-foreground">Sem respostas neste envio.</p>
    );
  }

  return (
    <div
      className={cn(
        "grid min-w-0 gap-2",
        !compact && "sm:grid-cols-2",
        className,
      )}
    >
      {answers.map((answer, index) => {
        const files = fileEntries(answer.value);
        const text = formatTallyAnswerText(answer);

        return (
          <div
            key={`${answer.key ?? "answer"}-${index}`}
            className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {answer.label ?? answer.key ?? "Campo"}
            </p>

            {files.length > 0 ? (
              <div className="mt-2 min-w-0 space-y-1.5">
                {files.map((file, fileIndex) => (
                  <a
                    key={`${file.url}-${fileIndex}`}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 truncate text-sm text-[var(--neuma-coral)] hover:underline"
                  >
                    {file.name || "Abrir ficheiro"}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-1 break-words whitespace-pre-wrap text-sm">
                {text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Prefer answers with options; fallback to payload.fields when older rows miss options. */
export function resolveTallyAnswers(
  answers: unknown,
  payload: unknown,
): TallyAnswerView[] {
  const fromAnswers = Array.isArray(answers)
    ? (answers as TallyAnswerView[])
    : [];

  const hasOptions = fromAnswers.some(
    (answer) => Array.isArray(answer.options) && answer.options.length > 0,
  );
  if (hasOptions) return fromAnswers;

  if (isRecord(payload)) {
    const data = payload.data;
    if (isRecord(data) && Array.isArray(data.fields) && data.fields.length > 0) {
      return data.fields.map((field) => {
        const record = isRecord(field) ? field : {};
        return {
          key: typeof record.key === "string" ? record.key : null,
          label: typeof record.label === "string" ? record.label : null,
          type: typeof record.type === "string" ? record.type : null,
          value: record.value,
          options: Array.isArray(record.options)
            ? (record.options as Array<{ id?: string; text?: string }>)
            : null,
        };
      });
    }
  }

  return fromAnswers;
}

function tallyAnswerText(answer?: TallyAnswerView | null) {
  if (!answer) return null;
  const text = formatTallyAnswerText(answer);
  return text === "—" ? null : text;
}

function findTallyAnswer(
  answers: TallyAnswerView[],
  predicate: (answer: TallyAnswerView) => boolean,
) {
  return answers.find(predicate);
}

/** Contact fields from onboarding Tally answers (label/type heuristics). */
export function extractTallyContactInfo(answers: TallyAnswerView[]) {
  const ageAnswer =
    findTallyAnswer(answers, (answer) => /idade/i.test(answer.label ?? "")) ??
    findTallyAnswer(
      answers,
      (answer) =>
        answer.type === "INPUT_NUMBER" && /idade/i.test(answer.label ?? ""),
    );

  const whatsappAnswer =
    findTallyAnswer(answers, (answer) => /whatsapp/i.test(answer.label ?? "")) ??
    findTallyAnswer(answers, (answer) => answer.type === "INPUT_PHONE_NUMBER");

  const instagramAnswer =
    findTallyAnswer(answers, (answer) => /instagram/i.test(answer.label ?? "")) ??
    findTallyAnswer(
      answers,
      (answer) =>
        answer.type === "INPUT_LINK" &&
        /instagram/i.test(tallyAnswerText(answer) ?? ""),
    );

  const age = tallyAnswerText(ageAnswer);
  const whatsapp = tallyAnswerText(whatsappAnswer);
  const instagram = tallyAnswerText(instagramAnswer);

  return {
    age,
    whatsapp,
    instagram,
    whatsappUrl: whatsapp ? whatsappChatUrl(whatsapp) : null,
    instagramUrl: instagram ? instagramProfileUrl(instagram) : null,
  };
}
