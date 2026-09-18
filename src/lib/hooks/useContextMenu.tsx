import { useState, type ReactNode } from "react";
import { ContextMenu, type ContextMenuItem } from "../../components/ContextMenu";

type OpenEvent = { clientX: number; clientY: number; preventDefault: () => void };

/** Estado del menú contextual: `open` en el evento, `menu` renderizado una vez. */
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
