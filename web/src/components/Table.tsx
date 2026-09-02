import { motion } from 'framer-motion';
import type { PlayerView, SeatView } from '../engine/types.ts';
import { TRADE_INFO } from '../lib/cards';
import { CardFace, CardBack } from './Card';
import { Crest } from './ui';

export function Table({ view, assignments, hauntTarget, onSeatClick, selectable, dropSeat = null }:
  { view: PlayerView; assignments: Record<number, string>; hauntTarget: number | null; onSeatClick: (seat: number) => void; selectable: boolean; dropSeat?: number | null }) {
  const n = view.seatCount;
  const myIndex = view.me.seat ?? 0;
  const keyOf = (id: string) => view.me.hand.find((c) => c.id === id)?.key ?? view.me.gravePool.find((c) => c.id === id)?.key;
  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-[12%] rounded-[50%] border border-night-3/60 bg-gradient-to-b from-night-2/60 to-night/40" />
      {view.seats.map((s) => {
        const angle = Math.PI / 2 + ((s.index - myIndex) * 2 * Math.PI) / n;
        const x = 50 + 42 * Math.cos(angle); const y = 47 + 36 * Math.sin(angle);
        const assigned = assignments[s.index];
        const isCrier = view.crierSeat === s.index;
        return (
          <motion.div key={s.index} layout className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <SeatTile seat={s} view={view} assignedKey={assigned ? keyOf(assigned) : undefined} isCrier={isCrier} hauntTarget={hauntTarget === s.index} dropTarget={dropSeat === s.index} onClick={selectable ? () => onSeatClick(s.index) : undefined} />
          </motion.div>
        );
      })}
    </div>
  );
}

function SeatTile({ seat, view, assignedKey, isCrier, hauntTarget, dropTarget, onClick }:
  { seat: SeatView; view: PlayerView; assignedKey?: string; isCrier: boolean; hauntTarget: boolean; dropTarget: boolean; onClick?: () => void }) {
  const dead = !seat.alive;
  const status = view.phase === 'gossip' ? (seat.ready ? 'ready' : '') : view.phase === 'placement' ? (seat.locked ? 'locked' : dead ? '' : 'placing') : view.phase === 'reveal' ? (seat.ack ? 'done' : 'watching') : '';
  return (
    <div onClick={onClick} data-seat={seat.index} className={`w-[132px] rounded-md border p-1.5 text-center transition ${onClick ? 'cursor-pointer hover:border-gold' : ''} ${seat.isMe ? 'border-gold/70 bg-night-2' : 'border-night-3 bg-night-2/90'} ${hauntTarget ? 'ring-2 ring-moon' : ''} ${dropTarget ? 'ring-4 ring-gold scale-105 bg-night-3' : ''} ${dead ? 'opacity-90' : ''}`}>
      <div className="flex items-center justify-center gap-1.5">
        <Crest color={seat.crest} size={14} />
        <span className={`font-ui text-xs font-bold truncate ${seat.isMe ? 'text-gold' : ''}`}>{seat.name}</span>
        {isCrier && <span title="Crier" className="text-[10px]">📯</span>}
      </div>
      <div className="text-[10px] font-ui uppercase tracking-wider text-ink-2 h-3">
        {dead ? `☠ ${seat.revealedTrade ? TRADE_INFO[seat.revealedTrade].name : 'dead'}` : seat.revealedTrade ? <span className="text-gold">👑 {TRADE_INFO[seat.revealedTrade].name}</span> : status}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1 h-[74px]">
        {dead ? (
          <div className="text-center"><div className="text-2xl">🪦</div><div className="text-[10px] text-ink-2">grave pool {seat.gravePoolCount}</div></div>
        ) : assignedKey ? (
          <CardFace cardKey={assignedKey} width={52} tag="you" />
        ) : seat.pileCount > 0 ? (
          <CardBack width={48} count={seat.pileCount} />
        ) : (
          <div className="w-[48px] card-face rounded-md border border-dashed border-night-3" />
        )}
      </div>
      <Wounds seat={seat} deathAt={view.calendar.deathAt} />
      {(seat.pendingCards.length > 0 || seat.scoringCards.length > 0) && (
        <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
          {seat.pendingCards.map((c) => <Chip key={c.id} text={shortName(c.key)} color="moon" />)}
          {seat.scoringCards.map((c) => <Chip key={c.id} text={shortName(c.key)} color="gold" />)}
        </div>
      )}
    </div>
  );
}

function Wounds({ seat, deathAt }: { seat: SeatView; deathAt: number }) {
  if (!seat.alive) return <div className="h-3" />;
  return (
    <div className="flex justify-center gap-0.5 mt-1 h-3" title={`${seat.wounds} of ${deathAt} wounds`}>
      {Array.from({ length: deathAt }).map((_, i) => (
        <motion.span key={i} initial={false} animate={{ scale: i < seat.wounds ? 1 : 0.8, backgroundColor: i < seat.wounds ? '#C4502F' : '#2A2E39' }} className="inline-block w-3 h-3 rounded-sm" />
      ))}
    </div>
  );
}
function Chip({ text, color }: { text: string; color: 'moon' | 'gold' }) {
  return <span className={`text-[9px] font-ui px-1 rounded-sm ${color === 'moon' ? 'bg-moon-deep text-parchment' : 'bg-gold-deep text-parchment'}`}>{text}</span>;
}
function shortName(key: string): string { return key.replace(/^sig:/, '').split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ').slice(0, 14); }
