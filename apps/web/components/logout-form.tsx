"use client";

import type { ReactNode } from "react";

import { logout } from "@/lib/actions/auth";
import { clearCreatePathSession } from "@/lib/agent/create-path-session";

/**
 * Server-action logout that also clears client Multi-agent chat memory
 * (sessionStorage survives logout in the same tab).
 */
export function LogoutForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={logout}
      className={className}
      onSubmit={() => {
        clearCreatePathSession();
      }}
    >
      {children}
    </form>
  );
}
