import { ProposalInbox } from "@/components/proposal-inbox";
import { listPendingProposals } from "@/lib/actions/agent-proposals";
import { PageHero } from "@/components/page-hero";

export default async function AgentInboxPage() {
  const proposals = await listPendingProposals();

  return (
    <div className="space-y-8">
      <PageHero
        title="Inbox do Agent"
        subtitle="Propõe · tu validas. Aprovar aplica na BD; rejeitar descarta."
      />
      <ProposalInbox proposals={proposals} />
    </div>
  );
}
