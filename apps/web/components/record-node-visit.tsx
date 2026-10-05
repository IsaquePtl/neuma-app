"use client";

import { useEffect } from "react";

import { recordNodeVisit } from "@/lib/actions/node-visits";

export function RecordNodeVisit({ nodeId }: { nodeId: string }) {
  useEffect(() => {
    void recordNodeVisit(nodeId);
  }, [nodeId]);
  return null;
}
