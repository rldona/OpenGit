import { create } from "zustand";

/** Payload of a pointer drag (OG-060). */
export type DragPayload =
  | { kind: "branch"; rev: string }
  | { kind: "file"; path: string; origPath: string | null; staged: boolean }
  | { kind: "tab"; path: string };

// Tab drop ids are namespaced `tab:<path>`; other drag kinds use flat ids.
type DragState = {
  drag: DragPayload | null;
  /** `data-drop` id of the element under the pointer. */
  over: string | null;
  setDrag: (drag: DragPayload, over: string | null) => void;
  setOver: (over: string | null) => void;
  clear: () => void;
};

/** Global drag state so drop targets can highlight themselves. */
export const useDragStore = create<DragState>((set) => ({
  drag: null,
  over: null,
  setDrag: (drag, over) => set({ drag, over }),
  setOver: (over) => set({ over }),
  clear: () => set({ drag: null, over: null }),
}));
