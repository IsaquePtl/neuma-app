"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  EXTENSION_DEGREES,
  NOTE_NAMES,
  chordSymbol,
  type ChordQuality,
  type ChordSpec,
  type ExtensionDegree,
  type NoteName,
  type SusKind,
} from "@/lib/music/chords";
import {
  applyAdd,
  applyChordPatch,
  applyQuality,
  applySus,
  getChordOptionAvailability,
  seventhChipLabel,
  seventhCycleHint,
  toggleExtension,
} from "@/lib/music/chord-validator";

const QUALITIES: { id: ChordQuality; label: string }[] = [
  { id: "major", label: "Maior" },
  { id: "minor", label: "Menor" },
  { id: "dim", label: "Dim" },
  { id: "aug", label: "Aum" },
];

/** Sus On → default sus4; Off → no suspension. */
const DEFAULT_SUS: SusKind = "sus4";

const SUS_OPTIONS: { id: Exclude<SusKind, "none">; label: string }[] = [
  { id: "sus2", label: "2" },
  { id: "sus4", label: "4" },
];

function Chip({
  active,
  onClick,
  children,
  className,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors",
        disabled
          ? "cursor-not-allowed bg-muted/50 text-muted-foreground/40"
          : active
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Compact pill for sus2 / sus4 — not the full-width root chips. */
function SusPill({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums transition-colors",
        disabled
          ? "cursor-not-allowed bg-muted/50 text-muted-foreground/40"
          : active
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  label,
  children,
  trailing,
  gridClassName,
}: {
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  gridClassName?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {trailing}
      </div>
      <div className={cn("grid gap-1.5", gridClassName)}>{children}</div>
    </div>
  );
}

function LabeledSwitch({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium text-foreground",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      )}
    >
      <span>{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}

export function ChordBuilderControls({
  value,
  onChange,
  showSymbol = true,
}: {
  value: ChordSpec;
  onChange: (next: ChordSpec) => void;
  /** Quando false, o bloco “Acorde / símbolo” (abaixo de Extensões) fica a cargo do parent. */
  showSymbol?: boolean;
}) {
  const availability = getChordOptionAvailability(value);

  function commit(next: ChordSpec) {
    onChange(next);
  }

  const susOn = value.sus !== "none";

  return (
    <div className="space-y-5">
      <Section label="Tríades" gridClassName="grid-cols-6">
        {NOTE_NAMES.map((note) => (
          <Chip
            key={note}
            active={value.root === note}
            onClick={() =>
              commit(applyChordPatch(value, { root: note as NoteName }))
            }
          >
            {note}
          </Chip>
        ))}
      </Section>

      <Section label="Qualidade" gridClassName="grid-cols-4">
        {QUALITIES.map((q) => {
          const enabled = availability.quality[q.id];
          return (
            <Chip
              key={q.id}
              active={value.quality === q.id && value.sus === "none"}
              disabled={!enabled}
              title={
                !enabled
                  ? "Sus activo — desliga Sus para Maior/Menor"
                  : undefined
              }
              onClick={() => commit(applyQuality(value, q.id))}
            >
              {q.label}
            </Chip>
          );
        })}
      </Section>

      <Section
        label="Extensões"
        gridClassName="grid-cols-4"
        trailing={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <LabeledSwitch
              label="Add"
              checked={value.add}
              disabled={!availability.add}
              onCheckedChange={(checked) => commit(applyAdd(value, checked))}
            />
            <div className="inline-flex items-center gap-1.5">
              <LabeledSwitch
                label="Sus"
                checked={susOn}
                disabled={!availability.sus}
                onCheckedChange={(checked) =>
                  commit(applySus(value, checked ? DEFAULT_SUS : "none"))
                }
              />
              {susOn
                ? SUS_OPTIONS.map((opt) => (
                    <SusPill
                      key={opt.id}
                      active={value.sus === opt.id}
                      disabled={!availability.susKind[opt.id]}
                      onClick={() => commit(applySus(value, opt.id))}
                    >
                      {opt.label}
                    </SusPill>
                  ))
                : null}
            </div>
          </div>
        }
      >
        {EXTENSION_DEGREES.map((deg) => {
          const is7 = deg === 7;
          const active = value.extensions.includes(deg);
          const enabled = availability.extensions[deg];
          return (
            <Chip
              key={deg}
              active={active}
              disabled={!enabled}
              onClick={() => commit(toggleExtension(value, deg as ExtensionDegree))}
              className="tabular-nums"
              title={
                !enabled
                  ? is7
                    ? "Add activo — desliga Add para usar 7ª"
                    : deg === 5
                      ? "5ª já definida por Dim/Aum"
                      : undefined
                  : is7
                    ? seventhCycleHint(value)
                    : undefined
              }
            >
              {is7 && active ? seventhChipLabel(value) : deg}
            </Chip>
          );
        })}
      </Section>

      {showSymbol ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Acorde
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {chordSymbol(value)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
