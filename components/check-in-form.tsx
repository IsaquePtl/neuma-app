"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCheckIn } from "@/lib/actions/checkins";
import { VideoField } from "@/components/video-field";

export function CheckInForm({
  nodeId,
  nodeTitle,
}: {
  nodeId: string;
  nodeTitle: string;
}) {
  const [kind, setKind] = useState<"video" | "text">("video");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/path"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> O meu percurso
      </Link>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Check-in</p>
        <h1 className="text-2xl font-semibold tracking-tight">{nodeTitle}</h1>
      </div>

      <Card className="neuma-accent-top p-6">
        <form action={submitCheckIn} className="space-y-5">
          <input type="hidden" name="node_id" value={nodeId} />
          <input type="hidden" name="kind" value={kind} />

          <div className="space-y-2">
            <Label htmlFor="kind">Tipo de check-in</Label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as "video" | "text")}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="video">Video</option>
              <option value="text">So texto</option>
            </select>
          </div>

          {kind === "video" ? <VideoField required /> : null}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas para o mentor</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={5}
              required={kind === "text"}
              placeholder="O que praticaste, duvidas, o que sentiste dificil..."
            />
          </div>

          <Button type="submit">Submeter check-in</Button>
        </form>
      </Card>
    </div>
  );
}
