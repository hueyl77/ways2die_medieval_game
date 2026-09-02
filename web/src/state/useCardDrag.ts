import { useCallback, useEffect, useRef, useState } from 'react';

export interface DragState { cardId: string; x: number; y: number }

/** Pointer-based drag of a hand card onto a seat tile (`[data-seat]`). Works for mouse and touch; a press without movement stays a click. */
export function useCardDrag(onDrop: (cardId: string, seat: number | null) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverSeat, setHoverSeat] = useState<number | null>(null);
  const ref = useRef<{ cardId: string; startX: number; startY: number; active: boolean } | null>(null);
  const lastDrop = useRef(0);
  const onDropRef = useRef(onDrop); onDropRef.current = onDrop;

  const seatUnder = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-seat]') as HTMLElement | null;
    return el ? Number(el.dataset.seat) : null;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = ref.current; if (!d) return;
      if (!d.active) { if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return; d.active = true; }
      setDrag({ cardId: d.cardId, x: e.clientX, y: e.clientY });
      setHoverSeat(seatUnder(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const d = ref.current; if (!d) return;
      ref.current = null;
      if (d.active) { lastDrop.current = Date.now(); onDropRef.current(d.cardId, seatUnder(e.clientX, e.clientY)); }
      setDrag(null); setHoverSeat(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);

  const startDrag = useCallback((cardId: string, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ref.current = { cardId, startX: e.clientX, startY: e.clientY, active: false };
  }, []);
  const justDropped = useCallback(() => Date.now() - lastDrop.current < 200, []);
  return { drag, hoverSeat, startDrag, justDropped };
}
