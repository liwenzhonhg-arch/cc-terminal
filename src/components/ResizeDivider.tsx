import { useRef, useCallback, useEffect } from "react";

type Props = {
  direction?: "horizontal" | "vertical";
  onResize: (delta: number) => void;
};

export function ResizeDivider({ direction = "vertical", onResize }: Props) {
  const startRef = useRef(0);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const cleanupRef = useRef<(() => void) | null>(null);

  const isVertical = direction === "vertical";

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startRef.current = isVertical ? e.clientX : e.clientY;

      const cursorClass = isVertical ? "cursor-col-resize" : "cursor-row-resize";
      document.body.classList.add("select-none", cursorClass);

      const handleMouseMove = (ev: MouseEvent) => {
        const current = isVertical ? ev.clientX : ev.clientY;
        const delta = current - startRef.current;
        if (delta !== 0) {
          startRef.current = current;
          onResizeRef.current(delta);
        }
      };

      const teardown = () => {
        document.body.classList.remove("select-none", cursorClass);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        cleanupRef.current = null;
      };

      const handleMouseUp = () => teardown();

      cleanupRef.current = teardown;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [isVertical],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`group shrink-0 flex items-center justify-center transition-colors ${
        isVertical
          ? "w-1.5 cursor-col-resize"
          : "h-1.5 cursor-row-resize"
      }`}
    >
      <div
        className={`bg-border/30 group-hover:bg-border/60 transition-colors ${
          isVertical ? "w-px h-full" : "h-px w-full"
        }`}
      />
    </div>
  );
}
