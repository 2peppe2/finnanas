import { useRef, useState } from "react";

export function useSheetDrag(onDismiss: () => void) {
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragStartYRef = useRef<number | null>(null);

  function handleSheetPointerDown(event: React.PointerEvent<HTMLElement>) {
    sheetDragStartYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (sheetDragStartYRef.current === null) {
      return;
    }

    setSheetDragY(Math.max(0, event.clientY - sheetDragStartYRef.current));
  }

  function handleSheetPointerEnd(event: React.PointerEvent<HTMLElement>) {
    if (sheetDragStartYRef.current === null) {
      return;
    }

    const dragY = Math.max(0, event.clientY - sheetDragStartYRef.current);
    sheetDragStartYRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragY > 70) {
      onDismiss();
      return;
    }

    setSheetDragY(0);
  }

  return {
    handleSheetPointerDown,
    handleSheetPointerEnd,
    handleSheetPointerMove,
    setSheetDragY,
    sheetDragY,
  };
}
