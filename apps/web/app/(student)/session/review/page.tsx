"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitStudentReview } from "@/lib/actions/student-reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const REVIEW_VIEWPORT =
  "neuma-mobile-viewport flex w-full flex-col justify-center gap-5 overflow-y-auto pb-8 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4";

const TOPICS = [
  { value: "app", label: "App" },
  { value: "geral", label: "Geral" },
] as const;

type Topic = (typeof TOPICS)[number]["value"];

export default function StudentReviewPage() {
  const [pending, startTransition] = useTransition();
  const [topic, setTopic] = useState<Topic>("app");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("topic", topic);
    startTransition(async () => {
      try {
        await submitStudentReview(fd);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível enviar",
        );
      }
    });
  }

  return (
    <div className={REVIEW_VIEWPORT}>
      <div className="w-full space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Feedback
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Deixar um feedback
          </h1>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sobre</p>
            <div className="grid grid-cols-2 gap-2.5">
              {TOPICS.map((item) => {
                const selected = topic === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTopic(item.value)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex h-12 items-center justify-center rounded-xl text-sm font-medium transition-colors",
                      "border border-white/10",
                      selected
                        ? "bg-white/[0.12] text-foreground"
                        : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="body"
              className="text-sm text-muted-foreground"
            >
              Feedback
            </label>
            <Textarea
              id="body"
              name="body"
              required
              rows={5}
              placeholder="Escreve aqui…"
              className="min-h-[8rem] resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full text-base font-semibold"
          >
            {pending ? "A enviar…" : "Enviar feedback"}
          </Button>
        </form>
      </div>
    </div>
  );
}
