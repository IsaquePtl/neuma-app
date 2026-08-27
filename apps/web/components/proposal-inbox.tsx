"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  approveProposal,
  rejectProposal,
} from "@/lib/actions/agent-proposals";
import { requestMentorBadgesRefresh } from "@/lib/mentor-badges-client";
import { Button } from "@/components/ui/button";

type Proposal = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  payload: unknown;
  created_at: string;
};

export function ProposalInbox({ proposals }: { proposals: Proposal[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (proposals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem propostas pendentes. O Agent cria-as quando monta percursos, eventos
        ou lacunas de biblioteca.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {proposals.map((p) => (
        <li key={p.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {p.kind}
              </p>
              <h3 className="font-medium">{p.title}</h3>
              {p.summary && (
                <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      const res = await approveProposal(p.id);
                      requestMentorBadgesRefresh();
                      toast.success("Proposta aplicada");
                      if (res.targetId && p.kind === "path_draft") {
                        router.push(`/studio/journeys/${res.targetId}`);
                      } else {
                        router.refresh();
                      }
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Falha ao aprovar",
                      );
                    }
                  })
                }
              >
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      await rejectProposal(p.id);
                      requestMentorBadgesRefresh();
                      toast.message("Proposta rejeitada");
                      router.refresh();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Falha ao rejeitar",
                      );
                    }
                  })
                }
              >
                Rejeitar
              </Button>
            </div>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
            {JSON.stringify(p.payload, null, 2)}
          </pre>
        </li>
      ))}
    </ul>
  );
}
