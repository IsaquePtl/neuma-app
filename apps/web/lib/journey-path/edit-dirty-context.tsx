"use client";

import { createContext, useContext } from "react";

export type JourneyEditDirtyContextValue = {
  /** True when leave-guard would prompt (session changes or unsaved new draft). */
  isDirty: boolean;
  /** Acknowledge persisted changes / keep draft — clears dirty without discarding. */
  save: () => void;
  pending: boolean;
};

const JourneyEditDirtyContext =
  createContext<JourneyEditDirtyContextValue | null>(null);

export function JourneyEditDirtyProvider({
  value,
  children,
}: {
  value: JourneyEditDirtyContextValue;
  children: React.ReactNode;
}) {
  return (
    <JourneyEditDirtyContext.Provider value={value}>
      {children}
    </JourneyEditDirtyContext.Provider>
  );
}

export function useJourneyEditDirty(): JourneyEditDirtyContextValue {
  const value = useContext(JourneyEditDirtyContext);
  if (!value) {
    return {
      isDirty: false,
      save: () => {},
      pending: false,
    };
  }
  return value;
}
