// Beta "history forks" (ADR-086): the branch list the History panel shows, and
// the two things a row can do.
//
// WHY A STORE AND NOT PROPS. The list is engine state like `history`, and
// `history` reaches ReviewPanel as a prop from AppShell. AppShell sits exactly
// at its max-lines cap (eslint.config.mjs) and is being dismantled, so nothing
// new is threaded through it. `syncState` (useEngineCore) publishes the list
// here from the same atomic capture as `history`, so the two cannot disagree;
// `useHistory` registers the actions, because it owns the repaint ritual that
// every history move must run.
//
// With the Beta off the engine always reports no branches, `branches` stays the
// one shared empty array, and the panel renders nothing.
import { create } from "zustand";
import { parseBranches, type HistoryBranch } from "@/lib/historyForks";

export interface HistoryBranchActions {
  /** Travel to a branch's tip; the timeline being left becomes a branch. */
  restore: (id: number) => void | Promise<void>;
  /** Forget one branch. */
  forget: (id: number) => void | Promise<void>;
}

interface HistoryBranchState {
  branches: HistoryBranch[];
  actions: HistoryBranchActions | null;
  setBranches: (branches: HistoryBranch[]) => void;
  setActions: (actions: HistoryBranchActions | null) => void;
}

export const useHistoryBranchStore = create<HistoryBranchState>((set, get) => ({
  // The shared empty array `parseBranches` returns, so the first sync with
  // the Beta off is not a change either.
  branches: parseBranches(undefined),
  actions: null,
  setBranches: (branches) => {
    // Same array (the shared empty one, every sync with the Beta off) → no
    // update, so no subscriber re-renders on an ordinary edit.
    if (get().branches !== branches) set({ branches });
  },
  setActions: (actions) => set({ actions }),
}));
