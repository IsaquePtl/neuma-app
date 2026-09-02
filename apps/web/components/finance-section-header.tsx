import { FinanceTabs } from "@/components/finance-tabs";

export function FinanceSectionHeader() {
  return (
    <header className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Finanças
        </h1>
        <p className="text-sm text-muted-foreground">
          Receita, subscrições e convites Neuma 1:1.
        </p>
      </div>
      <FinanceTabs />
    </header>
  );
}
