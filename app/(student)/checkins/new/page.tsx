import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitCheckIn } from "@/lib/actions/checkins";

export default async function NewCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}) {
  const { node: nodeId } = await searchParams;
  if (!nodeId) redirect("/path");

  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("id, title, description")
    .eq("id", nodeId)
    .single();

  if (!node) redirect("/path");

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
        <h1 className="text-2xl font-semibold tracking-tight">{node.title}</h1>
      </div>

      <Card className="neuma-accent-top p-6">
        <form action={submitCheckIn} className="space-y-5">
          <input type="hidden" name="node_id" value={node.id} />

          <div className="space-y-2">
            <Label>Tipo de check-in</Label>
            <Select name="kind" defaultValue="video">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="text">So texto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="video_url">Link do video</Label>
            <Input
              id="video_url"
              name="video_url"
              type="url"
              placeholder="https://youtube.com/... ou drive, loom..."
            />
            <p className="text-xs text-muted-foreground">
              Grava e coloca como nao listado. Cola o link aqui.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas para o mentor</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={5}
              placeholder="O que praticaste, duvidas, o que sentiste dificil..."
            />
          </div>

          <Button type="submit">Submeter check-in</Button>
        </form>
      </Card>
    </div>
  );
}
