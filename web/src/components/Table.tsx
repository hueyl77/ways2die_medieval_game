import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerView, SeatView } from '../engine/types.ts';
import type { WoundAnim } from './RevealPlayer';
import { TRADE_INFO } from '../lib/cards';
import { CardFace, CardBack } from './Card';
import { Crest } from './ui';

export function Table({ view, assignments, hauntTarget, onSeatClick, selectable, dropSeat = null, focusSeat = null, woundAnim = null }:
  { view: PlayerView; assignments: Record<number, string>; hauntTarget: number | null; onSeatClick: (seat: number) => void; selectable: boolean; dropSeat?: number | null; focusSeat?: number | null; woundAnim?: WoundAnim | null }) {
  const n = view.seatCount;
  const myIndex = view.me.seat ?? 0;
  const keyOf = (id: string) => view.me.hand.find((c) => c.id === id)?.key ?? view.me.gravePool.find((c) => c.id === id)?.key;
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* the market square: buildings and stalls of the eight trades ring an empty plaza where the seats sit */}
      <div className="absolute inset-0 bg-cover" style={{ backgroundImage: "url('/bg/market-square.jpg')", backgroundPosition: 'center 30%' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(20,22,28,.5) 0%, rgba(20,22,28,.5) 45%, rgba(20,22,28,.82) 100%)' }} />
      <div className="absolute inset-[12%] rounded-[50%] border border-parchment/15 bg-night/25 shadow-[inset_0_0_80px_rgba(0,0,0,.45)]" />
      {view.seats.map((s) => {
        const angle = Math.PI / 2 + ((s.index - myIndex) * 2 * Math.PI) / n;
        const x = 50 + 42 * Math.cos(angle); const y = 50 + 31 * Math.sin(angle);
        const assigned = assignments[s.index];
        const isCrier = view.crierSeat === s.index;
        const focus = focusSeat === s.index;
        // centred with an inline transform: a framer `layout` animation used to overwrite the Tailwind translate and shove tiles off their seats
        return (
          <div key={s.index} className="absolute transition-[left,top] duration-500" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
            <SeatTile seat={s} view={view} assignedKey={assigned ? keyOf(assigned) : undefined} isCrier={isCrier} hauntTarget={hauntTarget === s.index} dropTarget={dropSeat === s.index} focus={focus} anim={woundAnim} onClick={selectable ? () => onSeatClick(s.index) : undefined} />
          </div>
        );
      })}
    </div>
  );
}

function SeatTile({ seat, view, assignedKey, isCrier, hauntTarget, dropTarget, focus = false, anim = null, onClick }:
  { seat: SeatView; view: PlayerView; assignedKey?: string; isCrier: boolean; hauntTarget: boolean; dropTarget: boolean; focus?: boolean; anim?: WoundAnim | null; onClick?: () => void }) {
  // during the reveal the table shows wounds and graves as the scenes have revealed them, not the finished round
  const alive = anim ? (anim.alive[seat.index] ?? seat.alive) : seat.alive;
  const wounds = anim ? (anim.wounds[seat.index] ?? seat.wounds) : seat.wounds;
  const flash = anim?.flash && anim.flash.seat === seat.index ? anim.flash : null;
  const dead = !alive;
  const shownTrade = anim && alive && !seat.alive ? null : seat.revealedTrade;   // the envelope stays shut until the death scene
  const status = view.phase === 'gossip' ? (seat.ready ? 'ready' : '') : view.phase === 'placement' ? (seat.locked ? 'locked' : dead ? '' : 'placing') : view.phase === 'reveal' ? (seat.ack ? 'done' : 'watching') : '';
  return (
    <div onClick={onClick} data-seat={seat.index} className={`relative w-[132px] rounded-md border p-1.5 text-center transition ${onClick ? 'cursor-pointer hover:border-gold' : ''} ${seat.isMe ? 'border-gold/70 bg-night-2' : 'border-night-3 bg-night-2/90'} ${hauntTarget ? 'ring-2 ring-moon' : ''} ${focus ? 'ring-4 ring-gold scale-110 shadow-[0_0_36px_rgba(216,168,79,.55)] bg-night-2' : ''} ${dropTarget ? 'ring-4 ring-gold scale-105 bg-night-3' : ''} ${dead ? 'opacity-90' : ''}`}>
      <div className="flex items-center justify-center gap-1.5">
        <Crest color={seat.crest} size={14} />
        <span className={`font-ui text-xs font-bold truncate ${seat.isMe ? 'text-gold' : ''}`}>{seat.name}</span>
        {isCrier && <span title="Crier" className="text-[10px]">📯</span>}
      </div>
      <div className="text-[10px] font-ui uppercase tracking-wider text-ink-2 h-3">
        {dead ? `☠ ${shownTrade ? TRADE_INFO[shownTrade].name : 'dead'}` : shownTrade ? <span className="text-gold">👑 {TRADE_INFO[shownTrade].name}</span> : status}
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
      <Wounds wounds={wounds} alive={alive} deathAt={view.calendar.deathAt} />
      <AnimatePresence>
        {flash && (
          <motion.div key={flash.id} initial={{ opacity: 0, y: 6, scale: 0.6 }} animate={{ opacity: 1, y: -8, scale: 1 }} exit={{ opacity: 0, y: -22 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }}
            className={`absolute -top-3 inset-x-0 text-center font-display text-lg drop-shadow-[0_0_8px_rgba(0,0,0,.9)] pointer-events-none ${flash.delta > 0 ? 'text-blood' : flash.delta < 0 ? 'text-heal' : 'text-parchment'}`}>
            {flash.delta > 0 ? '+1 wound' : flash.delta < 0 ? 'healed' : '☠ dead'}
          </motion.div>
        )}
      </AnimatePresence>
      {(seat.pendingCards.length > 0 || seat.scoringCards.length > 0) && (
        <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
          {seat.pendingCards.map((c) => <Chip key={c.id} text={shortName(c.key)} color="moon" />)}
          {seat.scoringCards.map((c) => <Chip key={c.id} text={shortName(c.key)} color="gold" />)}
        </div>
      )}
    </div>
  );
}

function Wounds({ wounds, alive, deathAt }: { wounds: number; alive: boolean; deathAt: number }) {
  if (!alive) return <div className="h-3" />;
  return (
    <div className="flex justify-center gap-0.5 mt-1 h-3" title={`${wounds} of ${deathAt} wounds`}>
      {Array.from({ length: deathAt }).map((_, i) => (
        <motion.span key={i} initial={false} animate={{ scale: i < wounds ? [1.6, 1] : 0.8, backgroundColor: i < wounds ? '#C4502F' : '#2A2E39' }} transition={{ duration: 0.35 }} className="inline-block w-3 h-3 rounded-sm" />
      ))}
    </div>
  );
}
function Chip({ text, color }: { text: string; color: 'moon' | 'gold' }) {
  return <span className={`text-[9px] font-ui px-1 rounded-sm ${color === 'moon' ? 'bg-moon-deep text-parchment' : 'bg-gold-deep text-parchment'}`}>{text}</span>;
}
function shortName(key: string): string { return key.replace(/^sig:/, '').split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ').slice(0, 14); }
