"use client";

import { useState } from "react";
import { Upload, Link2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VideoField({
  required,
}: {
  required?: boolean;
}) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("check-ins")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { data } = await supabase.storage
        .from("check-ins")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!data?.signedUrl) throw new Error("Nao foi possivel obter o URL");
      setUrl(data.signedUrl);
      setMode("link");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "link" ? "secondary" : "ghost"}
          className="gap-1.5"
          onClick={() => setMode("link")}
        >
          <Link2 className="size-3.5" /> Link
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "upload" ? "secondary" : "ghost"}
          className="gap-1.5"
          onClick={() => setMode("upload")}
        >
          <Upload className="size-3.5" /> Upload
        </Button>
      </div>

      {mode === "link" ? (
        <div className="space-y-2">
          <Label htmlFor="video_url">Link do video</Label>
          <Input
            id="video_url"
            name="video_url"
            type="url"
            required={required}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/... ou drive, loom..."
          />
          <p className="text-xs text-muted-foreground">
            Grava e cola o link, ou faz upload e usa o URL gerado.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="video_file">Ficheiro de video</Label>
          <input
            id="video_file"
            type="file"
            accept="video/*"
            disabled={uploading}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className={cn(
              "block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-foreground",
            )}
          />
          {uploading ? (
            <p className="text-xs text-muted-foreground">A enviar...</p>
          ) : null}
          {url ? (
            <>
              <input type="hidden" name="video_url" value={url} />
              <p className="truncate text-xs text-muted-foreground">Pronto: {url}</p>
            </>
          ) : required ? (
            <input type="hidden" name="video_url" value="" />
          ) : null}
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
