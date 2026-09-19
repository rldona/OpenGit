import { useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useDragStore, type DragPayload } from "../stores/drag";

const THRESHOLD = 5;

/** `data-drop` id of the element under the given viewport point. */
function dropTargetAt(clientX: number, clientY: number): string | null {
  const element = document.elementFromPoint?.(clientX, clientY);
  const drop = element?.closest?.("[data-drop]") as HTMLElement | null;
  return drop?.dataset.drop ?? null;
}

/**
 * Custom pointer-based drag (OG-060). Native HTML5 drag & drop is unreliable
 * inside the WebView, so the gesture is rebuilt with pointer events: the drag
 * starts after a small threshold, the target is found by hit-testing
 * `[data-drop]`, and Escape cancels it.
 */
export function useDragSource(onDrop: (payload: DragPayload, target: string | null) => void) {
  const setDrag = useDragStore((state) => state.setDrag);
  const setOver = useDragStore((state) => state.setOver);
  const clear = useDragStore((state) => state.clear);

  const start = useCallback(
    (event: ReactPointerEvent, payload: DragPayload) => {
      if (event.button !== 0) {
        return;
      }
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;

      const onMove = (move: PointerEvent) => {
        if (!dragging) {
          if (Math.hypot(move.clientX - startX, move.clientY - startY) < THRESHOLD) {
            return;
          }
          dragging = true;
          setDrag(payload, null);
        }
        setOver(dropTargetAt(move.clientX, move.clientY));
      };

      const finish = (up: PointerEvent | null) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        if (!dragging) {
          return;
        }
        const target = up ? dropTargetAt(up.clientX, up.clientY) : null;
        clear();
        if (up) {
          onDrop(payload, target);
        }
      };

      const onUp = (up: PointerEvent) => finish(up);
      const onCancel = () => finish(null);
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
    },
    [onDrop, setDrag, setOver, clear],
  );

  return { start };
}
