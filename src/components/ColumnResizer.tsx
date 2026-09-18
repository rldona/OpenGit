import { COLUMN_MAX, COLUMN_MIN, widthAfterDrag, type ColumnName } from "../lib/columns";
import { clampSize } from "../lib/layout";

const KEYBOARD_STEP = 8;
const KEYBOARD_STEP_LARGE = 32;

type Props = {
  column: ColumnName;
  label: string;
  width: number;
  onResize: (width: number) => void;
};

/**
 * Tirador entre dos columnas de la tabla de commits. Va en el borde izquierdo
 * de la columna fija que redimensiona.
 */
export function ColumnResizer({ column, label, width, onResize }: Props) {
  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (move: PointerEvent) =>
      onResize(widthAfterDrag(startWidth, move.clientX - startX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    let change = 0;
    if (event.key === "ArrowLeft") change = step;
    else if (event.key === "ArrowRight") change = -step;
    if (change === 0) {
      return;
    }
    event.preventDefault();
    onResize(clampSize(width + change, COLUMN_MIN, COLUMN_MAX));
  };

  return (
    <div
      className="column-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={Math.round(width)}
      aria-valuemin={COLUMN_MIN}
      aria-valuemax={COLUMN_MAX}
      data-column={column}
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={onKeyDown}
    />
  );
}
