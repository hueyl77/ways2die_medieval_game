import { useState } from 'react';
import { motion } from 'framer-motion';
import { def, artUrl, CARD_BACK, cardTypeLabel } from '../lib/cards';

const TYPE_COLOR: Record<string, string> = { attack: 'bg-blood-deep', heal: 'bg-heal-deep', protect: 'bg-moon-deep', job: 'bg-gold-deep', signature: 'bg-violet-800' };

export function CardFace({ cardKey, width = 96, selected = false, dimmed = false, voided = false, onClick, tag, className = '' }:
  { cardKey: string; width?: number; selected?: boolean; dimmed?: boolean; voided?: boolean; onClick?: () => void; tag?: string; className?: string }) {
  const d = def(cardKey);
  const [broken, setBroken] = useState(false);
  return (
    <motion.div
      layout whileHover={onClick ? { y: -6 } : undefined} onClick={onClick}
      className={`relative card-face rounded-md overflow-hidden shadow-card select-none ${onClick ? 'cursor-pointer' : ''} ${selected ? 'ring-4 ring-gold' : ''} ${dimmed ? 'opacity-40' : ''} ${className}`}
      style={{ width }} title={`${d.name} — ${d.text}`}
    >
      {!broken ? <img src={artUrl(cardKey)} alt={d.name} onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        : <div className={`absolute inset-0 ${TYPE_COLOR[d.type]} grid place-items-center text-center p-2 font-display text-parchment`}>{d.name}</div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-1.5 pt-4 pb-1">
        <div className="font-display text-parchment leading-tight truncate" style={{ fontSize: Math.max(10, width * 0.11) }}>{d.name}</div>
        <div className="font-ui text-gold uppercase tracking-wider truncate" style={{ fontSize: Math.max(8, width * 0.075) }}>{cardTypeLabel(cardKey)}</div>
      </div>
      {voided && <div className="absolute inset-0 grid place-items-center bg-black/50"><span className="font-display text-blood text-3xl rotate-[-20deg]">VOID</span></div>}
      {tag && <div className="absolute top-1 left-1 bg-gold text-night font-ui text-[10px] font-bold px-1.5 rounded-sm">{tag}</div>}
    </motion.div>
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

export function CardTooltip({ cardKey }: { cardKey: string }) {
  const d = def(cardKey);
  return (
    <div className="bg-night-2 border border-gold/40 rounded-md p-3 w-64 shadow-card">
      <div className="font-display text-gold">{d.name}</div>
      <div className="font-ui text-[11px] uppercase tracking-wider text-ink-2 mb-1">{cardTypeLabel(cardKey)}</div>
      <p className="text-sm">{d.text}</p>
      {d.flavor && <p className="text-xs italic text-ink-2 mt-1">{d.flavor}</p>}
    </div>
  );
}
