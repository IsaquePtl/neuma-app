"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import {
  completeSignupProfile,
  finishSignupProfileExtras,
} from "@/lib/actions/auth";
import { uploadAvatar } from "@/lib/actions/profile";
import {
  clearSignupProfileDraft,
  readSignupProfileDraft,
} from "@/lib/auth/signup-profile";
import { prepareAvatarFile } from "@/lib/images/prepare-avatar";
import { cn } from "@/lib/utils";
import { profileInitials } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupProfileStep({
  displayName,
}: {
  displayName?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [skipPhoto, setSkipPhoto] = useState(false);
  const [bio, setBio] = useState("");
  const [skipBio, setSkipBio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSynced, setDraftSynced] = useState(false);

  // OAuth: aplica o rascunho de nome/idade/sexo guardado antes do redirect.
  useEffect(() => {
    if (draftSynced) return;
    const draft = readSignupProfileDraft();
    if (!draft) {
      setDraftSynced(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await completeSignupProfile(draft);
      if (cancelled) return;
      if (result.ok) clearSignupProfileDraft();
      setDraftSynced(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftSynced]);

  const initials = profileInitials(displayName, null);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarFile(file);
    setSkipPhoto(false);
    e.target.value = "";
  }

  function onSkipPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAvatarFile(null);
    setSkipPhoto(true);
  }

  function onSkipBio() {
    setBio("");
    setSkipBio(true);
  }

  function onFinish() {
    setError(null);
    startTransition(async () => {
      try {
        if (avatarFile && !skipPhoto) {
          const prepared = await prepareAvatarFile(avatarFile);
          const fd = new FormData();
          fd.set("avatar", prepared);
          await uploadAvatar(fd);
        }

        const trimmedBio = bio.trim();
        if (!skipBio && trimmedBio) {
          const result = await finishSignupProfileExtras({ bio: trimmedBio });
          if (!result.ok) {
            setError(result.error);
            return;
          }
        }

        router.replace("/home?welcome=1");
        router.refresh();
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        setError(
          /unexpected response|body exceeded|413/i.test(raw)
            ? "Não foi possível carregar a foto. Tenta outra imagem."
            : raw || "Não foi possível guardar o perfil.",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Podes saltar estes passos e completar depois nas definições.
      </p>

      {!skipPhoto ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="group relative"
            aria-label="Escolher fotografia de perfil"
          >
            <span
              className={cn(
                "relative grid size-[6.5rem] place-items-center overflow-hidden rounded-full",
                "bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)]",
                "ring-2 ring-white/10 transition-opacity group-hover:opacity-90",
              )}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold text-white">
                  {initials}
                </span>
              )}
            </span>
            <span className="absolute bottom-0.5 right-0.5 grid size-9 place-items-center rounded-full bg-background/90 text-foreground ring-1 ring-white/15 backdrop-blur-sm">
              <Camera className="size-4" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onPickPhoto}
          />
          <p className="text-xs text-muted-foreground">
            Toca para adicionar uma fotografia
          </p>
          <button
            type="button"
            onClick={onSkipPhoto}
            disabled={pending}
            className="text-xs text-muted-foreground/70 underline-offset-4 hover:text-muted-foreground hover:underline"
          >
            Saltar por agora
          </button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Foto saltada.{" "}
          <button
            type="button"
            onClick={() => setSkipPhoto(false)}
            className="underline-offset-4 hover:underline"
          >
            Adicionar
          </button>
        </p>
      )}

      {!skipBio ? (
        <div className="space-y-2">
          <Label htmlFor="signup_bio" className="text-base">
            Sobre ti
          </Label>
          <Input
            id="signup_bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            placeholder="Uma linha sobre ti…"
            disabled={pending}
            className="h-12 text-base"
          />
          <button
            type="button"
            onClick={onSkipBio}
            disabled={pending}
            className="text-xs text-muted-foreground/70 underline-offset-4 hover:text-muted-foreground hover:underline"
          >
            Saltar por agora
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Descrição saltada.{" "}
          <button
            type="button"
            onClick={() => setSkipBio(false)}
            className="underline-offset-4 hover:underline"
          >
            Escrever
          </button>
        </p>
      )}

      {error ? (
        <p className="text-base text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={onFinish}
        className="h-14 w-full bg-[var(--neuma-orange)] text-base font-semibold text-white hover:bg-[var(--neuma-orange)]/90"
      >
        {pending ? "A concluir…" : "Continuar"}
      </Button>
    </div>
  );
}
