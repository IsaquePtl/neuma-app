"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Upload, X } from "lucide-react";
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
import { LibraryAssetItemCard } from "@/components/library-asset-picker";
import { Button } from "@/components/ui/button";
import {
  LIBRARY_FORMAT_LABEL,
  formatsForUsage,
  libraryAssetFormat,
  type LibraryAssetFormat,
} from "@/lib/library/asset-format";
import { libraryAssetUsageLabel } from "@/lib/labels";
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

const choiceClass =
  "h-10 min-w-0 flex-1 rounded-xl border px-2 text-sm whitespace-nowrap";
const choiceSelectedClass =
  "border-white/55 bg-white/20 font-medium text-foreground";
const choiceIdleClass =
  "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10";

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
  /** Plus only, on a larger button, below `sm`. Full label from `sm` up. */
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
  const [body, setBody] = useState(asset?.body ?? "");
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
  const attachedName =
    fileLabel || (storagePath ? mediaFileLabel(url, storagePath) : "");
  const attachedCardTitle = (asset?.title ?? "").trim() || attachedName;
  const attachedCardMeta = [
    libraryAssetUsageLabel[usage],
    [
      categories.find((c) => c.id === categoryId)?.name,
      topics.find((t) => t.id === topicId)?.name,
    ]
      .filter(Boolean)
      .join(" / "),
  ]
    .filter(Boolean)
    .join(" · ");
  const createTriggerSize =
    triggerSize ?? (triggerVariant === "outline" ? "default" : "sm");

  const topicsForCategory = useMemo(
    () => topics.filter((t) => t.category_id === categoryId),
    [topics, categoryId],
  );
  const format = libraryAssetFormat(kind);
  const formatChoices = formatsForUsage(usage);

  function chooseUsage(next: LibraryAssetUsage) {
    setUsage(next);
    if (!formatsForUsage(next).includes(libraryAssetFormat(kind))) {
      setKind("video");
    }
  }

  function chooseFormat(next: LibraryAssetFormat) {
    setKind(next);
    if (next !== "link") return;
    const previous = storagePathRef.current;
    storagePathRef.current = "";
    setStoragePath("");
    setFileLabel("");
    releaseIfUnsaved(previous);
  }

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
    setBody(nextAsset?.body ?? "");
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
    const uploadFormat = libraryAssetFormat(kind) === "file" ? "file" : "video";
    const looksLikeVideo =
      file.type.startsWith("video/") ||
      /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name);
    if (uploadFormat === "video" && file.type && !looksLikeVideo) {
      toast.error("Escolhe um ficheiro de vídeo (MP4, MOV, etc.).");
      return;
    }
    if (uploadFormat === "file" && looksLikeVideo) {
      toast.error("Um vídeo usa o formato Vídeo.");
      return;
    }
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
        format: uploadFormat,
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

  function clearFile() {
    const previous = storagePathRef.current;
    storagePathRef.current = "";
    setStoragePath("");
    setUrl("");
    setFileLabel("");
    releaseIfUnsaved(previous);
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
              aria-label={
                compactOnMobile ? "Adicionar item" : (triggerLabel ?? "Novo item")
              }
              className={cn(
                "gap-1.5",
                compactOnMobile &&
                  "size-10 rounded-xl bg-white/10 px-0 hover:bg-white/15 sm:h-7 sm:w-auto sm:rounded-[min(var(--radius-md),12px)] sm:bg-transparent sm:px-2.5 sm:hover:bg-muted",
              )}
            />
          }
        >
          <Plus
            className={cn(
              createTriggerSize === "sm" ? "size-3.5" : "size-4",
              compactOnMobile && "size-5 sm:size-3.5",
            )}
          />
          {compactOnMobile ? (
            <span className="hidden sm:inline">
              {triggerLabel ?? "Novo item"}
            </span>
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

          <div className="space-y-2">
            <Label id="asset-usage-label">Tipo</Label>
            <div
              role="radiogroup"
              aria-labelledby="asset-usage-label"
              className="flex gap-2"
            >
              {(
                [
                  ["lesson", "Aula"],
                  ["practice", "Prática"],
                ] as const
              ).map(([value, label]) => {
                const selected = usage === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseUsage(value)}
                    className={cn(
                      choiceClass,
                      selected ? choiceSelectedClass : choiceIdleClass,
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label id="asset-format-label">Formato</Label>
            <div
              role="radiogroup"
              aria-labelledby="asset-format-label"
              className="flex gap-2"
            >
              {formatChoices.map((value) => {
                const selected = format === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseFormat(value)}
                    className={cn(
                      choiceClass,
                      selected ? choiceSelectedClass : choiceIdleClass,
                    )}
                  >
                    {LIBRARY_FORMAT_LABEL[value]}
                  </button>
                );
              })}
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

          <div className="space-y-1.5">
            <Label htmlFor="asset-body">Texto</Label>
            <Textarea
              id="asset-body"
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>

          {format === "link" ? (
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
                  <Label htmlFor={attachedName ? undefined : "asset-file"}>
                    {format === "video" ? "Vídeo" : "Ficheiro"}
                  </Label>
                  <input
                    ref={fileRef}
                    id="asset-file"
                    type="file"
                    className="sr-only"
                    disabled={uploading}
                    accept={format === "video" ? "video/*" : undefined}
                    onChange={(e) => {
                      void onFile(e.currentTarget.files?.[0] ?? null);
                      e.currentTarget.value = "";
                    }}
                  />
                  {attachedName ? (
                    <LibraryAssetItemCard
                      kind={kind}
                      title={attachedCardTitle}
                      meta={attachedCardMeta}
                    >
                      <button
                        type="button"
                        aria-label="Remover ficheiro"
                        disabled={uploading}
                        onClick={clearFile}
                        className="grid size-11 shrink-0 self-start place-items-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground disabled:opacity-50"
                      >
                        <X className="size-4" />
                      </button>
                    </LibraryAssetItemCard>
                  ) : (
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
                        : format === "video"
                          ? "Escolher vídeo"
                          : "Escolher ficheiro"}
                    </Button>
                  )}
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
                  <p className="text-xs text-muted-foreground">
                    Até {MAX_LIBRARY_FILE_MB} MB
                  </p>
                </div>
              )}
              {format === "video" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={coverUrl ? undefined : "asset-cover"}>
                    Capa do vídeo
                  </Label>
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
                  {coverUrl ? (
                    <div
                      tabIndex={0}
                      className="group relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <img
                        src={coverUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                      <div
                        className={cn(
                          "absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity",
                          "pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100",
                          "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                          coverUploading && "pointer-events-auto opacity-100",
                        )}
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          disabled={coverUploading}
                          onClick={() => coverRef.current?.click()}
                        >
                          {coverUploading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Upload className="size-3.5" />
                          )}
                          {coverUploading ? "A enviar capa…" : "Trocar capa"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={coverUploading}
                          onClick={() => void clearCover()}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-center gap-1.5"
                      disabled={coverUploading}
                      onClick={() => coverRef.current?.click()}
                    >
                      {coverUploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      {coverUploading ? "A enviar capa…" : "Adicionar capa"}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG ou WebP. Até 8 MB. Aparece antes de dar play.
                  </p>
                </div>
              ) : null}

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
