import { useEffect, useState, type ReactNode } from "react";
import { clampSize, loadSize, saveSize } from "../lib/layout";

type Props = {
  children: [ReactNode, ReactNode];
  direction: "horizontal" | "vertical";
  /** Panel with a fixed size: the first or the last one. */
  side: "start" | "end";
  storageKey: string;
  defaultSize: number;
  min?: number;
  max?: number;
  collapsed?: boolean;
  className?: string;
  label?: string;
};

const KEYBOARD_STEP = 10;
const KEYBOARD_STEP_LARGE = 40;

export function SplitPane({
  children,
  direction,
  side,
  storageKey,
  defaultSize,
  min = 80,
  max = 600,
  collapsed = false,
  className = "",
  label = "Resize",
}: Props) {
  const [size, setSize] = useState(() => loadSize(storageKey, defaultSize, min, max));

  useEffect(() => {
    saveSize(storageKey, size);
  }, [storageKey, size]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    let change = 0;
    if (direction === "horizontal") {
      if (event.key === "ArrowLeft") change = -step;
      else if (event.key === "ArrowRight") change = step;
    } else {
      if (event.key === "ArrowUp") change = -step;
      else if (event.key === "ArrowDown") change = step;
    }
    if (change === 0) {
      return;
    }
    event.preventDefault();
    setSize((current) => clampSize(current + (side === "end" ? -change : change), min, max));
  };

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    const startPosition = direction === "horizontal" ? event.clientX : event.clientY;
    const startSize = size;
    const onMove = (move: PointerEvent) => {
      const delta = (direction === "horizontal" ? move.clientX : move.clientY) - startPosition;
      setSize(clampSize(side === "end" ? startSize - delta : startSize + delta, min, max));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const fixedStyle = direction === "horizontal" ? { width: size } : { height: size };
  const classes = ["split-pane", direction, className].filter(Boolean).join(" ");

  if (collapsed) {
    return <div className={classes}>{side === "start" ? children[1] : children[0]}</div>;
  }

  const separator = (
    <div
      className="split-separator"
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={Math.round(size)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={onKeyDown}
    />
  );

  return (
    <div className={classes}>
      {side === "start" ? (
        <>
          <div className="split-fixed" style={fixedStyle}>
            {children[0]}
          </div>
          {separator}
          <div className="split-flex">{children[1]}</div>
        </>
      ) : (
        <>
          <div className="split-flex">{children[0]}</div>
          {separator}
          <div className="split-fixed" style={fixedStyle}>
            {children[1]}
          </div>
        </>
      )}
    </div>
  );
}
