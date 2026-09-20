import { useCallback } from "react";
import { useCommitStore } from "../stores/commit";
import { useRefsStore } from "../stores/refs";
import { useUiStore } from "../stores/ui";
import type { MergeResult } from "../bridge/types";

/**
 * Fusiona una rama en la actual y deja la UI donde toca: recarga el estado de
 * operación (el banner de OG-019 se alimenta de él) y, si hay conflicto, abre
 * la vista de conflictos (OG-020).
 */
export function useMergeBranch(root: string | null) {
  const merge = useRefsStore((state) => state.merge);
  const setActiveView = useUiStore((state) => state.setActiveView);

  return useCallback(
    async (rev: string, noFf: boolean): Promise<MergeResult | null> => {
      if (!root) {
        return null;
      }
      const result = await merge(root, rev, noFf);
      if (result) {
        await useCommitStore.getState().load(root);
        if (result.conflicted) {
          setActiveView("conflict");
        }
      }
      return result;
    },
    [root, merge, setActiveView],
  );
}
