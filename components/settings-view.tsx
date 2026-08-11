"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, LogOut } from "lucide-react";
import { toast } from "sonner";

import {
  updateProfile,
  uploadAvatar,
  requestEmailChange,
} from "@/lib/actions/profile";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { profileInitials } from "@/components/user-avatar";

export function SettingsView({
  name,
  email,
  role,
  avatarUrl,
  bio,
}: {
  name: string | null;
  email: string;
  role: "mentor" | "student";
  avatarUrl?: string | null;
  bio?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [avatarPending, startAvatarTransition] = useTransition();
  const [emailOpen, setEmailOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savedBio, setSavedBio] = useState(bio ?? "");
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayAvatar = previewUrl ?? avatarUrl;
  const initials = profileInitials(name, email);
  const bioDirty = draftBio.trim() !== savedBio.trim();

  function showStatus(message: string) {
    setStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 2800);
  }

  useEffect(() => {
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, []);

  function onSaveBio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!bioDirty) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProfile(fd);
        const next = draftBio.trim();
        setSavedBio(next);
        setDraftBio(next);
        showStatus("Perfil atualizado!");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível guardar",
        );
      }
    });
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const local = URL.createObjectURL(file);
    setPreviewUrl(local);
    const fd = new FormData();
    fd.set("avatar", file);
    startAvatarTransition(async () => {
      try {
        await uploadAvatar(fd);
        showStatus("Foto atualizada");
      } catch (err) {
        setPreviewUrl(null);
        toast.error(
          err instanceof Error ? err.message : "Não foi possível carregar a foto",
        );
      }
    });
  }

  function onChangeEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const msg = await requestEmailChange(fd);
        showStatus(msg);
        setEmailOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível alterar o email",
        );
      }
    });
  }

  return (
    <div
      className={cn(
        "neuma-mobile-viewport mx-auto flex w-full max-w-2xl flex-col justify-center gap-8 overflow-y-auto pb-5",
        "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4",
      )}
    >
      <header className="shrink-0 space-y-1.5">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-3xl">
          Perfil
        </h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          {role === "mentor" ? "A tua conta de mentor" : "A tua conta"}
        </p>
      </header>

      <div className="shrink-0 space-y-6">
      <div className="flex flex-col items-center gap-3.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={avatarPending}
          className="group relative"
          aria-label="Alterar fotografia de perfil"
        >
          <span
            className={cn(
              "relative grid size-32 place-items-center overflow-hidden rounded-full",
              "bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)]",
              "ring-2 ring-white/10 transition-opacity group-hover:opacity-90",
            )}
          >
            {displayAvatar ? (
              <Image
                src={displayAvatar}
                alt=""
                fill
                className="object-cover"
                sizes="128px"
                unoptimized
              />
            ) : (
              <span className="text-3xl font-semibold text-white">
                {initials}
              </span>
            )}
          </span>
          <span className="absolute bottom-0.5 right-0.5 grid size-10 place-items-center rounded-full bg-background/90 text-foreground ring-1 ring-white/15 backdrop-blur-sm">
            <Camera className="size-5" />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onPickPhoto}
        />
        <p className="text-sm text-muted-foreground">
          {avatarPending ? "A carregar foto…" : "Toca para alterar a fotografia"}
        </p>

        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight">
            {name ?? "Sem nome"}
          </p>
          {status ? (
            <p
              aria-live="polite"
              className="mt-1 text-xs leading-tight text-emerald-400/90"
            >
              {status}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="email-display">Email</Label>
            <button
              type="button"
              onClick={() => setEmailOpen((v) => !v)}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Alterar email
            </button>
          </div>
          <Input id="email-display" value={email} disabled readOnly className="h-11 text-base" />
          {emailOpen ? (
            <form
              onSubmit={onChangeEmail}
              className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <p className="text-xs text-muted-foreground">
                Enviamos um link de confirmação para o novo endereço.
              </p>
              <Input
                name="email"
                type="email"
                placeholder="novo@email.com"
                required
                autoComplete="email"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  Confirmar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEmailOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}
        </div>

        <form onSubmit={onSaveBio} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              rows={5}
              value={draftBio}
              onChange={(e) => setDraftBio(e.target.value)}
              placeholder="Uma linha sobre ti…"
              maxLength={280}
              className="min-h-[7.5rem] text-base"
            />
            <p className="text-[11px] text-muted-foreground">
              Máx. 280 caracteres
            </p>
          </div>
          <Button
            type="submit"
            disabled={pending || !bioDirty}
            className="w-full sm:w-auto"
          >
            {pending ? "A guardar…" : "Guardar"}
          </Button>
        </form>
      </div>
      </div>

      <div className="shrink-0 border-t border-white/10 pt-6">
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-4" /> Terminar sessão
          </Button>
        </form>
      </div>
    </div>
  );
}
