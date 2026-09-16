"use client";

import { useCallback, useRef } from "react";

/** How narrow and how wide a rail may be dragged, as a share of the viewport. */
const MIN_SHARE = 0.14;
const MAX_SHARE = 0.4;
/** Arrow-key step, in pixels. */
const KEY_STEP = 16;

type PaneResizerProps = {
  /** The custom property this handle drives, read by the pane it sits beside. */
  variable: "--define-width" | "--rail-width";
  /**
   * Which viewport edge the pane is anchored to. The left rail grows as the
   * pointer moves right; the right rail grows as it moves left.
   */
  edge: "left" | "right";
  label: string;
};

/**
 * Drag handle between two panes. Widths live as custom properties on the root
 * element rather than in React state, so dragging repaints CSS without
 * rerendering the results list underneath.
 */
export function PaneResizer({ variable, edge, label }: PaneResizerProps) {
  const handleRef = useRef<HTMLDivElement>(null);

  const widthFor = useCallback(
    (clientX: number) => (edge === "left" ? clientX : window.innerWidth - clientX),
    [edge],
  );

  const apply = useCallback(
    (width: number) => {
      const min = window.innerWidth * MIN_SHARE;
      const max = window.innerWidth * MAX_SHARE;
      const clamped = Math.min(max, Math.max(min, width));
      document.documentElement.style.setProperty(variable, `${Math.round(clamped)}px`);
    },
    [variable],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      // Capture keeps the drag alive over the panes; never let a browser that
      // refuses it stop the listeners below from being attached.
      handleRef.current?.setPointerCapture(event.pointerId);
    } catch {
      /* no capture available — the window listeners still carry the drag */
    }
    document.body.classList.add("is-resizing-panes");

    const onMove = (move: PointerEvent) => apply(widthFor(move.clientX));
    const onUp = () => {
      document.body.classList.remove("is-resizing-panes");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const pane = handleRef.current?.parentElement?.querySelector<HTMLElement>(
      edge === "left" ? ".pane-left" : ".select-rail",
    );
    const current = pane?.getBoundingClientRect().width ?? 0;
    // Left arrow always shrinks the left rail and grows the right one.
    const towardsStart = event.key === "ArrowLeft";
    const grows = edge === "left" ? !towardsStart : towardsStart;
    apply(current + (grows ? KEY_STEP : -KEY_STEP));
  };

  return (
    <div
      ref={handleRef}
      className="pane-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => document.documentElement.style.removeProperty(variable)}
    />
  );
}
