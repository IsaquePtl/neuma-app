"use client";

import { createContext, useContext } from "react";

export type UnsavedEdits = {
  /** Persists every pending edit; resolves false when validation or the request fails. */
  save: () => Promise<boolean>;
};

export type JourneyEditDirtyContextValue = {
  /** Composer reports local edits that are not persisted yet (null when clean). */
  reportUnsaved: (edits: UnsavedEdits | null) => void;
  /** Called after an explicit save so a new draft stops prompting keep/discard. */
  acknowledgeSaved: () => void;
};

const noop: JourneyEditDirtyContextValue = {
  reportUnsaved: () => {},
  acknowledgeSaved: () => {},
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
  return useContext(JourneyEditDirtyContext) ?? noop;
}
