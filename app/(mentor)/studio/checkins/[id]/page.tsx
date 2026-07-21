import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video, ExternalLink } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckInStatusBadge } from "@/components/status-badges";
import { submitFeedback } from "@/lib/actions/feedbacks";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";

export default async function CheckinDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: checkIn } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, video_url, notes, ai_summary, created_at, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title, description)",
    )
    .eq("id", id)
    .single();

  if (!checkIn) notFound();

  const { data: feedback } = await supabase
    .from("feedbacks")
    .select("*")
    .eq("check_in_id", id)
    .maybeSingle();

  const student = Array.isArray(checkIn.student)
    ? checkIn.student[0]
    : checkIn.student;
  const node = Array.isArray(checkIn.node) ? checkIn.node[0] : checkIn.node;

  return (
    <div className="space-y-8">
      <Link
        href="/studio/checkins"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Check-ins
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {student?.full_name ?? student?.email}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {node?.title ?? "Bloco"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {checkInKindLabel[checkIn.kind]} - {formatDateTime(checkIn.created_at)}
          </p>
        </div>
        <CheckInStatusBadge status={checkIn.status} />
      </header>

      {/* Submissao do aluno */}
      <Card className="space-y-4 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Submissao do aluno
        </h2>
        {checkIn.video_url ? (
          <a
            href={checkIn.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-secondary"
          >
            <Video className="size-4" /> Abrir video
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Sem video.</p>
        )}
        {checkIn.notes ? (
          <p className="whitespace-pre-wrap text-sm">{checkIn.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem notas.</p>
        )}
        {checkIn.ai_summary ? (
          <div className="rounded-lg bg-secondary/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resumo IA
            </p>
            <p className="mt-1 text-sm">{checkIn.ai_summary}</p>
          </div>
        ) : null}
      </Card>

      {/* Feedback do mentor */}
      <Card className="neuma-accent-top space-y-4 p-6">
        <h2 className="text-lg font-semibold">O teu feedback</h2>
        <form action={submitFeedback} className="space-y-4">
          <input type="hidden" name="check_in_id" value={checkIn.id} />

          <div className="space-y-2">
            <Label htmlFor="video_url">Link do teu video de resposta</Label>
            <Input
              id="video_url"
              name="video_url"
              type="url"
              placeholder="https://loom.com/..."
              defaultValue={feedback?.video_url ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / avaliacao</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="O que correu bem, o que ajustar..."
              defaultValue={feedback?.notes ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_steps">Proximos passos</Label>
            <Textarea
              id="next_steps"
              name="next_steps"
              rows={3}
              placeholder="Indicacoes concretas para a proxima etapa..."
              defaultValue={feedback?.next_steps ?? ""}
            />
          </div>

          <label className="flex items-center gap-3 rounded-lg border p-4">
            <input
              type="checkbox"
              name="approved"
              defaultChecked={feedback?.approved ?? false}
              className="size-4 accent-[var(--neuma-coral)]"
            />
            <span className="text-sm">
              Aprovar e avancar o aluno para o bloco seguinte
            </span>
          </label>

          <Button type="submit">Enviar feedback</Button>
        </form>
      </Card>
    </div>
  );
}
