import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function AppHeader({
  name,
  subtitle,
}: {
  name: string | null | undefined;
  subtitle: string;
}) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex flex-col">
        <span className="text-lg font-semibold tracking-tight">Neuma</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex items-center gap-3">
        {name ? (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {name}
          </span>
        ) : null}
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}
