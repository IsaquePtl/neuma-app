"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  updateProfile,
  uploadAvatar,
  requestEmailChange,
} from "@/lib/actions/profile";
import { logout } from "@/lib/actions/auth";
import { prepareAvatarFile } from "@/lib/images/prepare-avatar";
import {
  instagramProfileUrl,
  normalizeInstagramHandle,
  normalizeWhatsappNumber,
  whatsappChatUrl,
} from "@/lib/social-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { profileInitials } from "@/components/user-avatar";

export function SettingsView({
  name,
  email,
  role,
  avatarUrl,
  bio,
  instagram: initialInstagram,
  whatsapp: initialWhatsapp,
}: {
  name: string | null;
  email: string;
  role: "mentor" | "student";
  avatarUrl?: string | null;
  bio?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [avatarPending, startAvatarTransition] = useTransition();
  const [emailOpen, setEmailOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savedName, setSavedName] = useState(name ?? "");
  const [draftName, setDraftName] = useState(name ?? "");
  const [savedBio, setSavedBio] = useState(bio ?? "");
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [instagram, setInstagram] = useState(
    normalizeInstagramHandle(initialInstagram ?? ""),
  );
  const [whatsapp, setWhatsapp] = useState(
    normalizeWhatsappNumber(initialWhatsapp ?? ""),
  );
  const [savedInstagram, setSavedInstagram] = useState(
    normalizeInstagramHandle(initialInstagram ?? ""),
  );
  const [savedWhatsapp, setSavedWhatsapp] = useState(
    normalizeWhatsappNumber(initialWhatsapp ?? ""),
  );
  const [editingSocial, setEditingSocial] = useState<
    null | "instagram" | "whatsapp"
  >(null);
  const [editingBio, setEditingBio] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialInputRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const displayAvatar = previewUrl ?? avatarUrl;
  const displayName = savedName.trim() || null;
  const initials = profileInitials(displayName, email);
  const nameDirty = draftName.trim() !== savedName.trim();
  const bioDirty = draftBio.trim() !== savedBio.trim();
  const socialDirty =
    normalizeInstagramHandle(instagram) !== savedInstagram ||
    normalizeWhatsappNumber(whatsapp) !== savedWhatsapp;
  const dirty = nameDirty || bioDirty || socialDirty;

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

  useEffect(() => {
    if (editingSocial) socialInputRef.current?.focus();
  }, [editingSocial]);

  useEffect(() => {
    if (!editingBio) return;
    const el = bioRef.current;
    if (!el) return;
    el.focus();
    el.click();
  }, [editingBio]);

  function onSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setEditingSocial(null);

    const nextIg = normalizeInstagramHandle(instagram);
    const nextWa = normalizeWhatsappNumber(whatsapp);
    setInstagram(nextIg);
    setWhatsapp(nextWa);

    if (!dirty) return;

    const nextName = draftName.trim();
    const fd = new FormData();
    fd.set("full_name", nextName);
    fd.set("bio", draftBio);
    fd.set("instagram", nextIg);
    fd.set("whatsapp", nextWa);

    startTransition(async () => {
      try {
        await updateProfile(fd);
        setSavedName(nextName);
        setDraftName(nextName);
        setSavedBio(draftBio.trim());
        setDraftBio(draftBio.trim());
        setSavedInstagram(nextIg);
        setSavedWhatsapp(nextWa);
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
    startAvatarTransition(async () => {
      try {
        const prepared = await prepareAvatarFile(file);
        const fd = new FormData();
        fd.set("avatar", prepared);
        const url = await uploadAvatar(fd);
        URL.revokeObjectURL(local);
        setPreviewUrl(url);
        showStatus("Foto atualizada");
      } catch (err) {
        URL.revokeObjectURL(local);
        setPreviewUrl(null);
        const raw = err instanceof Error ? err.message : "";
        const friendly =
          /unexpected response|body exceeded|413/i.test(raw)
            ? "Não foi possível carregar a foto. Tenta outra imagem."
            : raw || "Não foi possível carregar a foto";
        toast.error(friendly);
      } finally {
        e.target.value = "";
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
        "neuma-mobile-viewport flex w-full flex-col justify-start gap-3 overflow-hidden overscroll-none pt-0.5 pb-1",
        "desktop:h-auto desktop:min-h-0 desktop:gap-8 desktop:overflow-visible desktop:pb-4",
      )}
    >
      <header className="shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl">
            Perfil
          </h1>
          <form action={logout} className="shrink-0">
            <Button
              type="submit"
              variant="ghost"
              className="h-11 gap-2.5 px-4 text-base text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-5" /> Terminar sessão
            </Button>
          </form>
        </div>
        <p className="text-sm text-muted-foreground">
          {role === "mentor" ? "A tua conta de mentor" : "A tua conta"}
        </p>
      </header>

      <div className="flex min-h-0 shrink flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={avatarPending}
          className="group relative"
          aria-label="Alterar fotografia de perfil"
        >
          <span
            className={cn(
              "relative grid size-[6.5rem] place-items-center overflow-hidden rounded-full",
              "bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)]",
              "ring-2 ring-white/10 transition-opacity group-hover:opacity-90",
            )}
          >
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayAvatar}
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
          {avatarPending ? "A carregar foto…" : "Toca para alterar a fotografia"}
        </p>

        <div className="w-full max-w-sm space-y-1.5 text-center">
          <p className="text-xl font-bold tracking-tight sm:text-2xl">
            {displayName ?? "Sem nome"}
          </p>
          {status ? (
            <p
              aria-live="polite"
              className="text-xs leading-tight text-emerald-400/90"
            >
              {status}
            </p>
          ) : null}

          <div className="flex w-full flex-col items-center">
            <textarea
              ref={bioRef}
              id="bio"
              name="bio"
              value={draftBio}
              onChange={(e) => setDraftBio(e.target.value)}
              onBlur={() => setEditingBio(false)}
              readOnly={!editingBio}
              placeholder="Uma linha sobre ti…"
              maxLength={280}
              rows={2}
              aria-label="Bio"
              className={cn(
                "mx-auto block h-[3.25rem] w-full max-w-sm resize-none overflow-hidden",
                "border-0 bg-transparent p-0 text-center text-[0.9375rem] leading-relaxed",
                "text-muted-foreground placeholder:text-muted-foreground/45",
                "outline-none focus:text-foreground focus-visible:ring-0",
                !editingBio && "cursor-default",
              )}
            />
            <button
              type="button"
              aria-label="Editar bio"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setEditingBio(true)}
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
                "text-muted-foreground/55 transition-colors",
                "hover:text-muted-foreground",
              )}
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-3 pt-5 desktop:pt-2">
        <div className="space-y-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome</Label>
            <Input
              id="full_name"
              name="full_name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              autoComplete="name"
              placeholder="O teu nome"
              className="h-11 text-base"
            />
          </div>

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
          <Input
            id="email-display"
            value={email}
            disabled
            readOnly
            className="h-11 text-base"
          />
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
                className="h-11 text-base"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-11 px-5 text-base"
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEmailOpen(false)}
                  className="h-11 px-5 text-base"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}

          <div className="flex flex-col gap-2 pt-0.5">
            <SocialRow
              kind="instagram"
              value={instagram}
              editing={editingSocial === "instagram"}
              inputRef={
                editingSocial === "instagram" ? socialInputRef : undefined
              }
              onEdit={() => setEditingSocial("instagram")}
              onChange={setInstagram}
              onDone={() => {
                setInstagram(normalizeInstagramHandle(instagram));
                setEditingSocial(null);
              }}
              icon={<InstagramMark className="size-5 shrink-0" />}
            />
            <SocialRow
              kind="whatsapp"
              value={whatsapp}
              editing={editingSocial === "whatsapp"}
              inputRef={
                editingSocial === "whatsapp" ? socialInputRef : undefined
              }
              onEdit={() => setEditingSocial("whatsapp")}
              onChange={setWhatsapp}
              onDone={() => {
                setWhatsapp(normalizeWhatsappNumber(whatsapp));
                setEditingSocial(null);
              }}
              icon={<WhatsAppMark className="size-5 shrink-0" />}
            />
          </div>
        </div>

        <form onSubmit={onSaveAll}>
          <Button
            type="submit"
            disabled={pending || !dirty}
            className="h-11 w-full text-base font-semibold sm:w-auto sm:min-w-40"
          >
            {pending ? "A guardar…" : "Guardar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SocialRow({
  kind,
  value,
  editing,
  inputRef,
  onEdit,
  onChange,
  onDone,
  icon,
}: {
  kind: "instagram" | "whatsapp";
  value: string;
  editing: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEdit: () => void;
  onChange: (value: string) => void;
  onDone: () => void;
  icon: React.ReactNode;
}) {
  const isIg = kind === "instagram";
  const href = isIg ? instagramProfileUrl(value) : whatsappChatUrl(value);
  const placeholder = isIg ? "isaque.portilho" : "351912345678";
  const emptyLabel = isIg ? "Instagram" : "WhatsApp";
  const display = value
    ? isIg
      ? `@${value}`
      : value
    : emptyLabel;

  const shellClass = cn(
    "inline-flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5",
    "border border-white/10 bg-white/[0.04] text-sm font-medium text-foreground/90",
    "transition-colors",
    href && !editing && "hover:bg-white/[0.07]",
  );

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Editar ${emptyLabel}`}
        onClick={onEdit}
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-xl",
          "border border-white/10 bg-white/[0.04] text-muted-foreground",
          "transition-colors hover:bg-white/[0.07] hover:text-foreground",
        )}
      >
        <Pencil className="size-4" />
      </button>

      {editing ? (
        <div className={shellClass}>
          {icon}
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onDone}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                onDone();
              }
            }}
            inputMode={isIg ? "text" : "tel"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            aria-label={emptyLabel}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={shellClass}
          aria-label={`Abrir ${emptyLabel}`}
        >
          {icon}
          <span className="min-w-0 flex-1 truncate text-left">{display}</span>
        </a>
      ) : (
        <button type="button" onClick={onEdit} className={shellClass}>
          {icon}
          <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
            {display}
          </span>
        </button>
      )}
    </div>
  );
}

function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="url(#ig-grad)"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)" strokeWidth="1.75" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="url(#ig-grad)" />
      <defs>
        <linearGradient id="ig-grad" x1="4" y1="20" x2="20" y2="4">
          <stop stopColor="#f58529" />
          <stop offset="0.45" stopColor="#dd2a7b" />
          <stop offset="1" stopColor="#8134af" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="#25D366">
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.82c0 1.96.57 3.8 1.56 5.36L2 22l5.02-1.63a9.9 9.9 0 0 0 5.02 1.35h.01c5.46 0 9.89-4.4 9.89-9.82S17.5 2 12.04 2Zm5.76 13.99c-.24.68-1.4 1.24-1.93 1.32-.5.07-1.13.1-1.82-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.55-1.17-2.96 0-1.4.74-2.09 1-2.37.26-.28.57-.35.76-.35h.55c.17 0 .4-.07.63.48.24.57.81 1.98.88 2.12.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.3.37-.42.5-.14.14-.28.29-.12.56.16.28.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.21 1.36.28.14.44.12.6-.07.17-.19.7-.81.89-1.09.19-.28.38-.23.63-.14.26.1 1.63.77 1.91.91.28.14.47.21.54.33.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}
