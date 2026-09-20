import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type MenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
};

const MENU_WIDTH = 220;

export function ContextMenu({ x, y, items, onClose }: MenuState & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const left = Math.max(4, Math.min(x, window.innerWidth - MENU_WIDTH - 4));
  const top = Math.max(4, Math.min(y, window.innerHeight - items.length * 28 - 12));

  return createPortal(
    <div ref={ref} className="context-menu" role="menu" style={{ left, top }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`context-menu-item${item.danger ? " danger" : ""}`}
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
