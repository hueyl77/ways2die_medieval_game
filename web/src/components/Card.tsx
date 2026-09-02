import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { def, artUrl, CARD_BACK, cardTypeLabel } from '../lib/cards';

const TYPE_COLOR: Record<string, string> = { attack: '#93392B', heal: '#4A6B3F', protect: '#41607A', job: '#8F6A1C', signature: '#5B3E8A' };
const PREVIEW_W = 300;
const PREVIEW_H = PREVIEW_W * 4 / 3;

/** The printed card: art on top, parchment rules box below. Scales with `width`. */
export function CardArt({ cardKey, width, large = false }: { cardKey: string; width: number; large?: boolean }) {
  const d = def(cardKey);
  const [broken, setBroken] = useState(false);
  const f = width / 100; // 1 unit ≈ 1% of card width
  return (
    <div className="card-face relative rounded-md overflow-hidden bg-[#2A2E39] flex flex-col" style={{ width }}>
      <div className="relative" style={{ height: '58%' }}>
        {!broken ? <img src={artUrl(cardKey)} alt="" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          : <div className="absolute inset-0 grid place-items-center" style={{ background: TYPE_COLOR[d.type] }}><span className="text-3xl">🃏</span></div>}
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
      <div className="flex-1 min-h-0 flex flex-col bg-[#EDE6D3] text-[#262019]" style={{ padding: `${4 * f}px ${5 * f}px`, borderTop: `${1.5 * f}px solid ${TYPE_COLOR[d.type]}` }}>
        <div className="font-display font-semibold leading-tight truncate" style={{ fontSize: 9 * f }}>{d.name}</div>
        <div className="font-ui uppercase tracking-wider truncate" style={{ fontSize: 5.6 * f, color: TYPE_COLOR[d.type], marginBottom: 2 * f }}>{cardTypeLabel(cardKey)}</div>
        <div className="font-body leading-snug overflow-hidden" style={{ fontSize: (large ? 6.4 : 6.2) * f, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: large ? 8 : 4 }}>{d.text}</div>
        {d.flavor && <div className="font-body italic mt-auto overflow-hidden" style={{ fontSize: 5.4 * f, color: '#6C655A', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: large ? 3 : 1 }}>{d.flavor}</div>}
      </div>
    </div>
  );
}

/** Large hover/long-press preview rendered into document.body, positioned near the anchor. */
function CardPreview({ cardKey, anchor }: { cardKey: string; anchor: DOMRect }) {
  const vw = window.innerWidth; const vh = window.innerHeight;
  const above = anchor.top - 12 - PREVIEW_H >= 8;
  const top = above ? anchor.top - 12 - PREVIEW_H : Math.min(vh - PREVIEW_H - 8, anchor.bottom + 12);
  const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - PREVIEW_W / 2), vw - PREVIEW_W - 8);
  return createPortal(
    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15 }}
      className="fixed z-[100] pointer-events-none shadow-[0_18px_50px_rgba(0,0,0,.6)] rounded-md ring-2 ring-gold/70" style={{ top, left, width: PREVIEW_W }}>
      <CardArt cardKey={cardKey} width={PREVIEW_W} large />
    </motion.div>,
    document.body,
  );
}

export function useCardPreview() {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  const show = (el: HTMLElement, delay: number) => { clear(); timer.current = window.setTimeout(() => setAnchor(el.getBoundingClientRect()), delay); };
  const hide = () => { clear(); setAnchor(null); };
  useEffect(() => clear, []);
  return {
    anchor, hide,
    handlers: {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget, 180),
      onMouseLeave: hide,
      onTouchStart: (e: React.TouchEvent<HTMLElement>) => show(e.currentTarget, 450),
      onTouchEnd: hide, onTouchMove: hide, onTouchCancel: hide,
      onFocus: (e: React.FocusEvent<HTMLElement>) => show(e.currentTarget, 0),
      onBlur: hide,
    },
  };
}

export function CardFace({ cardKey, width = 96, selected = false, dimmed = false, voided = false, onClick, onPointerDown, tag, className = '', preview = true }:
  { cardKey: string; width?: number; selected?: boolean; dimmed?: boolean; voided?: boolean; onClick?: () => void; onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void; tag?: ReactNode; className?: string; preview?: boolean }) {
  const d = def(cardKey);
  const { anchor, hide, handlers } = useCardPreview();
  return (
    <>
      <motion.div
        layout whileHover={onClick ? { y: -6 } : undefined}
        onClick={() => { hide(); onClick?.(); }}
        onPointerDown={(e) => { hide(); onPointerDown?.(e); }}
        {...(preview ? handlers : {})}
        tabIndex={preview ? 0 : undefined}
        className={`relative select-none rounded-md shadow-card outline-none ${onPointerDown ? 'touch-none cursor-grab active:cursor-grabbing' : onClick ? 'cursor-pointer' : ''} ${selected ? 'ring-4 ring-gold' : ''} ${dimmed ? 'opacity-40' : ''} ${className}`}
        style={{ width }} aria-label={`${d.name}. ${d.text}`}
      >
        <CardArt cardKey={cardKey} width={width} />
        {voided && <div className="absolute inset-0 grid place-items-center bg-black/50 rounded-md"><span className="font-display text-blood text-3xl rotate-[-20deg]">VOID</span></div>}
        {tag && <div className="absolute top-1 left-1 bg-gold text-night font-ui text-[10px] font-bold px-1.5 rounded-sm">{tag}</div>}
      </motion.div>
      {preview && anchor && <CardPreview cardKey={cardKey} anchor={anchor} />}
    </>
  );
}

export function CardBack({ width = 60, className = '', count }: { width?: number; className?: string; count?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative card-face rounded-md overflow-hidden shadow-card bg-night-3 ${className}`} style={{ width }}>
      {!broken && <img src={CARD_BACK} alt="" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" draggable={false} />}
      {broken && <div className="absolute inset-0 grid place-items-center text-2xl">💀</div>}
      {count !== undefined && <div className="absolute -top-1 -right-1 bg-gold text-night font-ui text-xs font-bold rounded-full w-5 h-5 grid place-items-center">{count}</div>}
    </div>
  );
}
