"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Upload, Link2 } from "lucide-react";
import { toast } from "sonner";

import {
  releaseUnsavedLibraryUpload,
  replaceLibraryAssetCover,
  replaceLibraryAssetMedia,
  upsertLibraryAsset,
} from "@/lib/actions/library";
import {
  cancelMultipartUpload,
  getLibraryAssetUploadUrl,
  getLibraryCoverUploadUrl,
} from "@/lib/actions/r2-uploads";
import {
  uploadToR2Presigned,
  uploadViaPresignedPut,
} from "@/lib/uploads/presigned-client";
import {
  MAX_LIBRARY_FILE_BYTES,
  MAX_LIBRARY_FILE_MB,
  libraryFileTooLargeMessage,
} from "@/lib/uploads/video-limits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  cover_url?: string | null;
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

/** Basename from a storage key or public URL (e.g. `video.mov`). */
function mediaFileLabel(url: string | null | undefined, storagePath: string | null | undefined) {
  const raw = (storagePath || url || "").trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) {
      const path = new URL(raw).pathname;
      return decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
    }
  } catch {
    /* ignore malformed URL */
  }
  return raw.split("/").filter(Boolean).pop() ?? "";
}

function initialMode(asset?: LibraryAssetData): "link" | "upload" {
  return asset?.storage_path ? "upload" : "link";
}

export function LibraryAssetDialog({
  asset,
  triggerLabel,
  triggerVariant = "default",
  triggerSize,
  compactOnMobile = false,
  defaultUsage = "lesson",
  defaultCategoryId,
  defaultTopicId,
  categories = [],
  topics = [],
}: {
  asset?: LibraryAssetData;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerSize?: "default" | "sm";
  /** Short labelled create trigger below `sm`; full label from `sm` up. */
  compactOnMobile?: boolean;
  defaultUsage?: LibraryAssetUsage;
  defaultCategoryId?: string;
  defaultTopicId?: string;
  categories?: Category[];
  topics?: Topic[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<LibraryAssetKind>(asset?.kind ?? "video");
  const [usage, setUsage] = useState<LibraryAssetUsage>(
    asset?.usage ?? defaultUsage,
  );
  const initialTopic = topics.find(
    (t) => t.id === (asset?.topic_id ?? defaultTopicId),
  );
  const [categoryId, setCategoryId] = useState(
    initialTopic?.category_id ?? defaultCategoryId ?? "",
  );
  const [topicId, setTopicId] = useState(
    asset?.topic_id ?? defaultTopicId ?? "",
  );
  /** Real media URL persisted on save. */
  const [url, setUrl] = useState(asset?.url ?? "");
  const [storagePath, setStoragePath] = useState(asset?.storage_path ?? "");
  /** Visible label in upload mode (`filename.format`). */
  const [fileLabel, setFileLabel] = useState(() =>
    asset?.storage_path ? mediaFileLabel(asset.url, asset.storage_path) : "",
  );
  const [mode, setMode] = useState<"link" | "upload">(() => initialMode(asset));
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverUrl, setCoverUrl] = useState(asset?.cover_url ?? "");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverKeyRef = useRef("");
  const savedCoverKeyRef = useRef("");
  const savedKeyRef = useRef(asset?.storage_path ?? "");
  const storagePathRef = useRef(storagePath);
  const uploadRef = useRef<{ key: string; uploadId?: string } | null>(null);
  const cancelUploadRef = useRef(false);

  function releaseIfUnsaved(key: string) {
    if (!key || key === savedKeyRef.current) return;
    void releaseUnsavedLibraryUpload(key);
  }
  const isEdit = Boolean(asset);
  const createTriggerSize =
    triggerSize ?? (triggerVariant === "outline" ? "default" : "sm");

  const topicsForCategory = useMemo(
    () => topics.filter((t) => t.category_id === categoryId),
    [topics, categoryId],
  );

  function resetFormState(nextAsset?: LibraryAssetData) {
    setKind(nextAsset?.kind ?? "video");
    setUsage(nextAsset?.usage ?? defaultUsage);
    const t = topics.find(
      (x) => x.id === (nextAsset?.topic_id ?? defaultTopicId),
    );
    setCategoryId(t?.category_id ?? defaultCategoryId ?? "");
    setTopicId(nextAsset?.topic_id ?? defaultTopicId ?? "");
    setUrl(nextAsset?.url ?? "");
    const nextPath = nextAsset?.storage_path ?? "";
    storagePathRef.current = nextPath;
    setStoragePath(nextPath);
    setFileLabel(
      nextAsset?.storage_path
        ? mediaFileLabel(nextAsset.url, nextAsset.storage_path)
        : "",
    );
    setMode(initialMode(nextAsset));
    setCoverUrl(nextAsset?.cover_url ?? "");
    coverKeyRef.current = "";
    savedCoverKeyRef.current = "";
    setUploading(false);
    setCoverUploading(false);
    setUploadPercent(null);
  }

  function coverContentType(file: File): string | null {
    const type = (file.type || "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (type === "image/jpg" || type === "image/jpeg") return "image/jpeg";
    if (type === "image/png" || type === "image/webp") return type;
    const name = file.name.toLowerCase();
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    return null;
  }

  async function onCover(file: File | null) {
    if (!file) return;
    const contentType = coverContentType(file);
    if (!contentType) {
      toast.error("A capa tem de ser PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("A capa pode ter no máximo 8 MB.");
      return;
    }
    setCoverUploading(true);
    try {
      const presigned = await getLibraryCoverUploadUrl({
        filename: file.name,
        contentType,
        size: file.size,
      });
      if (!presigned.ok) {
        toast.error(presigned.error);
        return;
      }
      if (presigned.mode !== "put") {
        toast.error("Não foi possível enviar a capa.");
        return;
      }
      const publicUrl = await uploadViaPresignedPut(file, presigned);
      const previousUnsaved = coverKeyRef.current;
      coverKeyRef.current = presigned.key;
      if (asset?.id) {
        const saved = await replaceLibraryAssetCover({
          id: asset.id,
          coverUrl: publicUrl,
        });
        if (!saved.ok) {
          toast.error(saved.error);
          void releaseUnsavedLibraryUpload(presigned.key);
          coverKeyRef.current = previousUnsaved;
          return;
        }
        savedCoverKeyRef.current = presigned.key;
      }
      if (previousUnsaved && previousUnsaved !== savedCoverKeyRef.current) {
        void releaseUnsavedLibraryUpload(previousUnsaved);
      }
      setCoverUrl(publicUrl);
      toast.success(asset?.id ? "Capa guardada" : "Capa enviada — prime Guardar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload da capa");
    } finally {
      setCoverUploading(false);
    }
  }

  async function clearCover() {
    const unsaved = coverKeyRef.current;
    if (asset?.id && coverUrl) {
      const saved = await replaceLibraryAssetCover({ id: asset.id, coverUrl: "" });
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
    } else if (unsaved && unsaved !== savedCoverKeyRef.current) {
      void releaseUnsavedLibraryUpload(unsaved);
    }
    coverKeyRef.current = "";
    savedCoverKeyRef.current = "";
    setCoverUrl("");
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (file.size > MAX_LIBRARY_FILE_BYTES) {
      toast.error(libraryFileTooLargeMessage());
      return;
    }
    cancelUploadRef.current = false;
    setUploadPercent(null);
    setUploading(true);
    try {
      const presigned = await getLibraryAssetUploadUrl({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        categoryId,
      });
      if (!presigned.ok) {
        toast.error(presigned.error);
        return;
      }
      if (cancelUploadRef.current) {
        if (presigned.mode === "multipart") {
          void cancelMultipartUpload({
            key: presigned.key,
            uploadId: presigned.uploadId,
          });
        }
        return;
      }
      uploadRef.current = {
        key: presigned.key,
        uploadId: presigned.mode === "multipart" ? presigned.uploadId : undefined,
      };
      const publicUrl = await uploadToR2Presigned(file, presigned, {
        kind: "library",
        categoryId,
        onProgress: (ratio) => setUploadPercent(Math.round(ratio * 100)),
      });
      uploadRef.current = null;
      if (cancelUploadRef.current) {
        void releaseUnsavedLibraryUpload(presigned.key);
        return;
      }
      if (asset?.id) {
        const saved = await replaceLibraryAssetMedia({
          id: asset.id,
          url: publicUrl,
          storagePath: presigned.key,
        });
        if (!saved.ok) {
          toast.error(saved.error);
          void releaseUnsavedLibraryUpload(presigned.key);
          return;
        }
        savedKeyRef.current = presigned.key;
      }
      const replacedUnsaved = storagePathRef.current;
      storagePathRef.current = presigned.key;
      setUrl(publicUrl);
      setStoragePath(presigned.key);
      releaseIfUnsaved(replacedUnsaved);
      setFileLabel(file.name);
      setMode("upload");
      toast.success(
        asset?.id
          ? "Ficheiro guardado no item"
          : "Ficheiro enviado — prime Guardar para criar o item",
      );
    } catch (e) {
      if (!cancelUploadRef.current) {
        toast.error(e instanceof Error ? e.message : "Falha no upload");
      }
    } finally {
      uploadRef.current = null;
      setUploading(false);
      setUploadPercent(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("url", url);
    fd.set("storage_path", storagePath);
    fd.set("cover_url", coverUrl);
    fd.set("kind", kind);
    fd.set("usage", usage);
    fd.set("topic_id", topicId);
    startTransition(async () => {
      try {
        await upsertLibraryAsset(fd);
        savedKeyRef.current = storagePath;
        savedCoverKeyRef.current = coverKeyRef.current;
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
        if (!next) {
          cancelUploadRef.current = true;
          const active = uploadRef.current;
          if (active?.uploadId) {
            void cancelMultipartUpload({
              key: active.key,
              uploadId: active.uploadId,
            });
          }
          releaseIfUnsaved(storagePathRef.current);
          if (
            coverKeyRef.current &&
            coverKeyRef.current !== savedCoverKeyRef.current
          ) {
            void releaseUnsavedLibraryUpload(coverKeyRef.current);
          }
        }
        setOpen(next);
        if (next) {
          savedKeyRef.current = asset?.storage_path ?? "";
          resetFormState(asset);
        }
      }}
    >
      {isEdit ? (
        <DialogTrigger
          render={
            <Button
              variant={triggerLabel ? triggerVariant : "ghost"}
              size={triggerLabel ? "sm" : "icon"}
              aria-label={triggerLabel ?? "Editar"}
              className={triggerLabel ? "gap-1.5" : undefined}
            />
          }
        >
          {triggerLabel ? (
            <>
              <Pencil className="size-3.5" /> {triggerLabel}
            </>
          ) : (
            <Pencil className="size-4" />
          )}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button
              variant={triggerVariant}
              size={createTriggerSize}
              aria-label={triggerLabel ?? "Novo item"}
              className={cn(
                "gap-1.5",
                compactOnMobile &&
                  "h-7 shrink-0 px-2.5 sm:w-auto sm:px-2.5",
              )}
            />
          }
        >
          <Plus
            className={createTriggerSize === "sm" ? "size-3.5" : "size-4"}
          />
          {compactOnMobile ? (
            <>
              <span className="sm:hidden">Adicionar</span>
              <span className="hidden sm:inline">
                {triggerLabel ?? "Novo item"}
              </span>
            </>
          ) : (
            <span>{triggerLabel ?? "Novo item"}</span>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar item" : "Novo item na biblioteca"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {asset ? <input type="hidden" name="id" value={asset.id} /> : null}
          {/* Preserve optional DB fields not shown in the compact UI */}
          <input type="hidden" name="summary" value={asset?.summary ?? ""} />
          <input
            type="hidden"
            name="tags"
            value={(asset?.tags ?? []).join(", ")}
          />
          <input
            type="hidden"
            name="duration_label"
            value={asset?.duration_label ?? ""}
          />

          <div className="space-y-1.5">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-usage">Tipo de item</Label>
              <select
                id="asset-usage"
                value={usage}
                onChange={(e) => setUsage(e.target.value as LibraryAssetUsage)}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="lesson">Aula</option>
                <option value="practice">Prática</option>
              </select>
            </div>
            <div className="space-y-1.5">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
          </div>

          {kind === "text" ? (
            <div className="space-y-1.5">
              <Label htmlFor="asset-body">Conteúdo</Label>
              <Textarea
                id="asset-body"
                name="body"
                defaultValue={asset?.body ?? ""}
                rows={4}
              />
            </div>
          ) : (
            <>
              <input type="hidden" name="body" value={asset?.body ?? ""} />
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "link" ? "secondary" : "outline"}
                  className="w-full gap-1.5"
                  disabled={uploading}
                  onClick={() => setMode("link")}
                >
                  <Link2 className="size-3.5" /> Link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "upload" ? "secondary" : "outline"}
                  className="w-full gap-1.5"
                  disabled={uploading}
                  onClick={() => setMode("upload")}
                >
                  <Upload className="size-3.5" /> Upload
                </Button>
              </div>
              {mode === "link" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="asset-url">URL</Label>
                  <Input
                    id="asset-url"
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      // Manual link replaces any prior R2 object association.
                      const previous = storagePathRef.current;
                      storagePathRef.current = "";
                      setStoragePath("");
                      setFileLabel("");
                      releaseIfUnsaved(previous);
                    }}
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="asset-file">Ficheiro</Label>
                  <input
                    ref={fileRef}
                    id="asset-file"
                    type="file"
                    className="sr-only"
                    disabled={uploading}
                    accept={
                      kind === "video"
                        ? "video/*"
                        : kind === "image"
                          ? "image/*"
                          : undefined
                    }
                    onChange={(e) => {
                      void onFile(e.currentTarget.files?.[0] ?? null);
                      e.currentTarget.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-center gap-1.5"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {uploading
                      ? uploadPercent == null
                        ? "A preparar o envio…"
                        : `A enviar… ${uploadPercent}%`
                      : fileLabel
                        ? "Trocar ficheiro"
                        : "Escolher ficheiro"}
                  </Button>
                  {uploading && uploadPercent != null ? (
                    <div
                      className="h-1 overflow-hidden rounded-full bg-white/10"
                      role="progressbar"
                      aria-valuenow={uploadPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-[var(--neuma-coral)] transition-[width] duration-200"
                        style={{ width: `${uploadPercent}%` }}
                      />
                    </div>
                  ) : null}
                  {fileLabel && !uploading ? (
                    <Input
                      value={fileLabel}
                      readOnly
                      aria-label="Nome do ficheiro"
                      className="bg-muted/40"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Até {MAX_LIBRARY_FILE_MB} MB
                  </p>
                </div>
              )}
              {kind === "video" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="asset-cover">Capa do vídeo</Label>
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt=""
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                  ) : null}
                  <input
                    ref={coverRef}
                    id="asset-cover"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={coverUploading}
                    onChange={(e) => {
                      void onCover(e.currentTarget.files?.[0] ?? null);
                      e.currentTarget.value = "";
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 flex-1 gap-1.5"
                      disabled={coverUploading}
                      onClick={() => coverRef.current?.click()}
                    >
                      {coverUploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      {coverUploading
                        ? "A enviar capa…"
                        : coverUrl
                          ? "Trocar capa"
                          : "Adicionar capa"}
                    </Button>
                    {coverUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10"
                        disabled={coverUploading}
                        onClick={() => void clearCover()}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG ou WebP. Até 8 MB. Aparece antes de dar play.
                  </p>
                </div>
              ) : null}
            </>
          )}

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
