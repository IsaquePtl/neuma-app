"use client";

import { useTransition } from "react";
import { Check, LogOut, Palette, User2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/actions/profile";
import { logout } from "@/lib/actions/auth";
import { ACCENTS, type AccentKey, useAccent } from "@/components/accent-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsView({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string;
  role: "mentor" | "student";
}) {
  const { accent, setAccent } = useAccent();
  const [pending, startTransition] = useTransition();

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateProfile(fd);
      toast.success("Perfil atualizado");
    });
  }

  const initials = (name ?? email).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Conta</p>
        <h1 className="text-3xl font-semibold tracking-tight">Definicoes</h1>
      </header>

      {/* Cartao de perfil */}
      <Card className="neuma-accent-top overflow-hidden p-0">
        <div className="relative flex items-center gap-4 p-6">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-40"
            style={{
              background:
                "radial-gradient(120% 100% at 0% 0%, color-mix(in oklch, var(--primary) 30%, transparent), transparent 60%)",
            }}
          />
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--neuma-coral)] to-[var(--neuma-blue)] text-xl font-semibold text-white">
            {initials}
          </span>
          <div>
            <p className="text-lg font-semibold">{name ?? "Sem nome"}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-xs">
              <BadgeCheck className="size-3.5 text-primary" />
              {role === "mentor" ? "Mentor" : "Aluno"}
            </span>
          </div>
        </div>
      </Card>

      {/* Editar perfil */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <User2 className="size-4" /> Perfil
        </h2>
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={name ?? ""}
              placeholder="O teu nome"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : "Guardar"}
          </Button>
        </form>
      </Card>

      {/* Personalizacao (accent) */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Palette className="size-4" /> Cor de destaque
        </h2>
        <p className="text-sm text-muted-foreground">
          Personaliza a tua Neuma. Fica guardado neste dispositivo.
        </p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
            const a = ACCENTS[key];
            const isActive = accent === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAccent(key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl p-1 transition-transform hover:scale-105",
                )}
                aria-label={a.label}
              >
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                    isActive ? "ring-white/80" : "ring-transparent",
                  )}
                  style={{ backgroundColor: a.hex }}
                >
                  {isActive ? (
                    <Check className="size-5 text-white" />
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{a.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Sair */}
      <form action={logout}>
        <Button
          type="submit"
          variant="destructive"
          className="w-full gap-2 sm:w-auto"
        >
          <LogOut className="size-4" /> Terminar sessao
        </Button>
      </form>
    </div>
  );
}
