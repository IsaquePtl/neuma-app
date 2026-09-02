import { FinanceSectionHeader } from "@/components/finance-section-header";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <FinanceSectionHeader />
      {children}
    </div>
  );
}
