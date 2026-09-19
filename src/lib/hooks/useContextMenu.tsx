import { useState, type ReactNode } from "react";
import { ContextMenu, type ContextMenuItem } from "../../components/ContextMenu";

type OpenEvent = { clientX: number; clientY: number; preventDefault: () => void };

/** Context menu state: `open` at the event, `menu` rendered once. */
export function useContextMenu(): {
  open: (event: OpenEvent, items: ContextMenuItem[]) => void;
  close: () => void;
  menu: ReactNode;
} {
  const [state, setState] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const open = (event: OpenEvent, items: ContextMenuItem[]) => {
    event.preventDefault();
    setState({ x: event.clientX, y: event.clientY, items });
  };

  const close = () => setState(null);

  return {
    open,
    close,
    menu: state ? <ContextMenu {...state} onClose={close} /> : null,
  };
}
