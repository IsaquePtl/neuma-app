import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormQuestionType, Json } from "@/lib/types/database.types";

type Question = {
  id: string;
  label: string;
  help_text: string | null;
  type: FormQuestionType;
  options: Json | null;
  required: boolean;
};

export function FormRenderer({ questions }: { questions: Question[] }) {
  return (
    <div className="space-y-6">
      {questions.map((q) => {
        const name = `q_${q.id}`;
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        return (
          <div key={q.id} className="space-y-2">
            <Label htmlFor={name}>
              {q.label}
              {q.required ? (
                <span className="ml-1 text-[var(--neuma-coral)]">*</span>
              ) : null}
            </Label>
            {q.help_text ? (
              <p className="text-xs text-muted-foreground">{q.help_text}</p>
            ) : null}

            {q.type === "short_text" ? (
              <Input id={name} name={name} required={q.required} />
            ) : null}

            {q.type === "long_text" ? (
              <Textarea id={name} name={name} rows={3} required={q.required} />
            ) : null}

            {q.type === "single_choice" ? (
              <div className="space-y-2">
                {options.map((opt) => (
                  <label key={opt} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name={name}
                      value={opt}
                      required={q.required}
                      className="size-4 accent-[var(--neuma-coral)]"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : null}

            {q.type === "multi_choice" ? (
              <div className="space-y-2">
                {options.map((opt) => (
                  <label key={opt} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name={name}
                      value={opt}
                      className="size-4 accent-[var(--neuma-coral)]"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : null}

            {q.type === "scale" ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-2 text-sm has-[:checked]:border-transparent has-[:checked]:bg-primary/15 has-[:checked]:text-primary"
                  >
                    <input
                      type="radio"
                      name={name}
                      value={String(n)}
                      required={q.required}
                      className="sr-only"
                    />
                    {n}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
