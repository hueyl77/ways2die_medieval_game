import { motion } from 'framer-motion';
import type { CardView, PlayerView } from '../engine/types.ts';
import { CardFace, CardBack } from './Card';

const SLOT = 92;      // a hand card (84) plus the gap beside it
const DECK_W = 60;

export function Hand({ view, cards, selected, assignments, onSelect, onDragStart }:
  { view: PlayerView; cards: CardView[]; selected: string | null; assignments: Record<number, string>; onSelect: (id: string) => void; onDragStart?: (id: string, e: React.PointerEvent) => void }) {
  const seatName = (i: number) => view.seats[i]?.name.split(' ')[0] ?? `#${i}`;
  const assignedTo = (id: string) => { const e = Object.entries(assignments).find(([, cid]) => cid === id); return e ? seatName(Number(e[0])) : undefined; };
  const order = ['attack', 'signature', 'heal', 'protect', 'job'];
  const sorted = [...cards].sort((a, b) => order.indexOf(typeOf(a.key)) - order.indexOf(typeOf(b.key)) || a.key.localeCompare(b.key));
  // Drawing from the deck: the envelope sits face-down beside the hand; each round it is shuffled and one card per seat is dealt out
  const draw = !!view.settings.drawMode && !view.me.isGhost;
  const deckCount = view.seats.find((s) => s.isMe)?.deckCount ?? 0;
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-thin py-2 px-1">
      {draw && <Deck count={deckCount} round={view.round} />}
      {sorted.map((c, i) => { const tag = assignedTo(c.id); return (
        <motion.div key={c.id} className="shrink-0" data-hand-card={c.id}
          initial={draw ? { opacity: 0, x: -(DECK_W + 24 + i * SLOT), rotate: -8, scale: 0.9 } : false}
          animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
          transition={draw ? { delay: 0.65 + i * 0.13, type: 'spring', stiffness: 230, damping: 24 } : { duration: 0 }}>
          <CardFace cardKey={c.key} width={84} selected={selected === c.id} dimmed={!!tag && selected !== c.id} tag={tag ? `→ ${tag}` : undefined} onClick={() => onSelect(c.id)} onPointerDown={onDragStart ? (e) => onDragStart(c.id, e) : undefined} />
        </motion.div>
      ); })}
      {cards.length === 0 && <p className="text-sm text-ink-2 italic px-2 self-center">No cards in hand.</p>}
    </div>
  );
}

/** The rest of the envelope, face-down. It riffles at the start of every round, just before the hand is dealt. */
function Deck({ count, round }: { count: number; round: number }) {
  const layers = Math.min(3, count);
  return (
    <div className="shrink-0 self-center flex flex-col items-center gap-1 pr-3 mr-1 border-r border-night-3" data-deck={count}
      title="Your envelope, face-down. Every round you shuffle it and draw one card for each seat at the table.">
      <div className="relative" style={{ width: DECK_W + 6, height: (DECK_W * 4) / 3 + 6 }}>
        {count === 0 && <div className="absolute inset-0 rounded-md border border-dashed border-night-3" />}
        {Array.from({ length: layers }).map((_, i) => (
          <motion.div key={`${round}-${i}`} className="absolute" style={{ left: i * 3, top: (layers - 1 - i) * 3 }}
            initial={{ x: 0, rotate: 0 }}
            animate={{ x: [0, (i - 1) * 18, 0, (1 - i) * 14, 0], rotate: [0, (i - 1) * 7, 0, (1 - i) * 5, 0] }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}>
            <CardBack width={DECK_W} />
          </motion.div>
        ))}
      </div>
      <div className="text-[10px] font-ui uppercase tracking-wider text-ink-2 whitespace-nowrap">{count ? `Deck · ${count}` : 'Deck empty'}</div>
    </div>
  );
}

function typeOf(key: string): string { return key.startsWith('sig:') || key.startsWith('alms:') || key === 'tax-collector' ? 'signature' : key.startsWith('mishap:') || key.startsWith('calamity:') ? 'attack' : key.startsWith('job:') ? 'job' : key; }
