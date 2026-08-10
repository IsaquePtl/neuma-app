"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { tallyEmbedUrl } from "@/components/tally-embed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CheckInTallyPanel({
  formId,
  nodeId,
  nodeTitle,
  studentId,
}: {
  formId: string;
  nodeId: string;
  nodeTitle: string;
  studentId: string;
}) {
  const [ready, setReady] = useState(false);
  const src = tallyEmbedUrl(formId, {
    student_id: studentId,
    node_id: nodeId,
    source: "neuma",
  });

  useEffect(() => {
    // Liberta o paint da shell antes de marcar o iframe como visível
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Geral
        </Link>
        <Button
          render={<Link href="/checkins" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
        >
          Histórico
        </Button>
      </div>

      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Check-in
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{nodeTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Preenche o formulário abaixo. Podes fechar e voltar quando quiseres.
        </p>
      </header>

      <Card className="neuma-accent-top overflow-hidden p-0">
        <div className="relative min-h-[70vh]">
          {!ready ? (
            <div className="absolute inset-0 animate-pulse bg-white/5" />
          ) : null}
          <iframe
            src={src}
            title={`Check-in · ${nodeTitle}`}
            loading="eager"
            className={cn(
              "block w-full border-0 bg-transparent transition-opacity duration-300",
              ready ? "opacity-100" : "opacity-0",
            )}
            style={{ minHeight: "70vh", height: "70vh" }}
            allow="camera; microphone; clipboard-write"
          />
        </div>
      </Card>
    </div>
  );
}
