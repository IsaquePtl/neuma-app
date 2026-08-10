"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Upload, Link2 } from "lucide-react";
import { toast } from "sonner";

import { upsertLibraryAsset } from "@/lib/actions/library";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  LibraryAssetKind,
  LibraryAssetUsage,
} from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

export type LibraryAssetData = {
  id: string;
  title: string;
  summary: string | null;
  kind: LibraryAssetKind;
  usage: LibraryAssetUsage;
  topic_id: string | null;
  body: string | null;
  url: string | null;
  storage_path: string | null;
  tags: string[];
  duration_label: string | null;
};

type Category = { id: string; name: string };
type Topic = { id: string; category_id: string; name: string };

const KIND_OPTIONS: { value: LibraryAssetKind; label: string }[] = [
  { value: "video", label: "Vídeo" },
  { value: "text", label: "Texto" },
  { value: "image", label: "Imagem" },
  { value: "file", label: "Ficheiro" },
  { value: "link", label: "Link" },
];

export function LibraryAssetDialog({
  asset,
  triggerLabel,
  triggerVariant = "default",
  defaultUsage = "lesson",
  categories = [],
  topics = [],
}: {
  asset?: LibraryAssetData;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  defaultUsage?: LibraryAssetUsage;
  categories?: Category[];
  topics?: Topic[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<LibraryAssetKind>(asset?.kind ?? "video");
  const [usage, setUsage] = useState<LibraryAssetUsage>(
    asset?.usage ?? defaultUsage,
  );
  const initialTopic = topics.find((t) => t.id === asset?.topic_id);
  const [categoryId, setCategoryId] = useState(initialTopic?.category_id ?? "");
  const [topicId, setTopicId] = useState(asset?.topic_id ?? "");
  const [url, setUrl] = useState(asset?.url ?? "");
  const [storagePath, setStoragePath] = useState(asset?.storage_path ?? "");
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [uploading, setUploading] = useState(false);
  const isEdit = Boolean(asset);

  const topicsForCategory = useMemo(
    () => topics.filter((t) => t.category_id === categoryId),
    [topics, categoryId],
  );

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("library")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;

      const { data } = supabase.storage.from("library").getPublicUrl(path);
      setUrl(data.publicUrl);
      setStoragePath(path);
      setMode("link");
      toast.success("Ficheiro enviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("url", url);
    fd.set("storage_path", storagePath);
    fd.set("kind", kind);
    fd.set("usage", usage);
    fd.set("topic_id", usage === "lesson" ? topicId : "");
    startTransition(async () => {
      try {
        await upsertLibraryAsset(fd);
        toast.success(isEdit ? "Actualizado" : "Criado");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível guardar");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setKind(asset?.kind ?? "video");
          setUsage(asset?.usage ?? defaultUsage);
          const t = topics.find((x) => x.id === asset?.topic_id);
          setCategoryId(t?.category_id ?? "");
          setTopicId(asset?.topic_id ?? "");
          setUrl(asset?.url ?? "");
          setStoragePath(asset?.storage_path ?? "");
        }
      }}
    >
      {isEdit ? (
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Editar" />
          }
        >
          <Pencil className="size-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button
              variant={triggerVariant}
              size={triggerVariant === "outline" ? "default" : "sm"}
              className="gap-2"
            />
          }
        >
          <Plus className="size-4" /> {triggerLabel ?? "Novo item"}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar item" : "Novo item na biblioteca"}
          </DialogTitle>
          <DialogDescription>
            Aulas vão para a árvore Categoria → Tópico. Prática fica na secção
            prática.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {asset ? <input type="hidden" name="id" value={asset.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="asset-usage">Uso</Label>
            <select
              id="asset-usage"
              value={usage}
              onChange={(e) => {
                const next = e.target.value as LibraryAssetUsage;
                setUsage(next);
                if (next === "practice") {
                  setCategoryId("");
                  setTopicId("");
                }
              }}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="lesson">Aula</option>
              <option value="practice">Prática</option>
            </select>
          </div>

          {usage === "lesson" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="asset-cat">Categoria</Label>
                <select
                  id="asset-cat"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setTopicId("");
                  }}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">— escolher —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-topic">Tópico</Label>
                <select
                  id="asset-topic"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  required
                  disabled={!categoryId}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50"
                >
                  <option value="">— escolher —</option>
                  {topicsForCategory.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="asset-title">Título</Label>
            <Input
              id="asset-title"
              name="title"
              defaultValue={asset?.title ?? ""}
              required
              autoFocus
              placeholder="Ex: Acordes maiores — vídeo base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-kind">Formato</Label>
            <select
              id="asset-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as LibraryAssetKind)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-summary">Resumo</Label>
            <Textarea
              id="asset-summary"
              name="summary"
              defaultValue={asset?.summary ?? ""}
              rows={2}
            />
          </div>

          {kind === "text" ? (
            <div className="space-y-2">
              <Label htmlFor="asset-body">Conteúdo</Label>
              <Textarea
                id="asset-body"
                name="body"
                defaultValue={asset?.body ?? ""}
                rows={6}
              />
            </div>
          ) : (
            <>
              <input type="hidden" name="body" value={asset?.body ?? ""} />
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
                    <Label htmlFor="asset-url">URL</Label>
                    <Input
                      id="asset-url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="asset-file">Ficheiro</Label>
                    <input
                      id="asset-file"
                      type="file"
                      disabled={uploading}
                      accept={
                        kind === "video"
                          ? "video/*"
                          : kind === "image"
                            ? "image/*"
                            : undefined
                      }
                      onChange={(e) =>
                        onFile(e.currentTarget.files?.[0] ?? null)
                      }
                      className={cn(
                        "block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-foreground",
                      )}
                    />
                    {uploading ? (
                      <p className="text-xs text-muted-foreground">A enviar...</p>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="asset-tags">Tags</Label>
              <Input
                id="asset-tags"
                name="tags"
                defaultValue={(asset?.tags ?? []).join(", ")}
                placeholder="teoria, semana1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-duration">Duração</Label>
              <Input
                id="asset-duration"
                name="duration_label"
                defaultValue={asset?.duration_label ?? ""}
                placeholder="12 min"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || uploading}>
              {pending ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
