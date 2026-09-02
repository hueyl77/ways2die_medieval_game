import type { CardView, PlayerView } from '../engine/types.ts';
import { CardFace } from './Card';

export function Hand({ view, cards, selected, assignments, onSelect, onDragStart }:
  { view: PlayerView; cards: CardView[]; selected: string | null; assignments: Record<number, string>; onSelect: (id: string) => void; onDragStart?: (id: string, e: React.PointerEvent) => void }) {
  const seatName = (i: number) => view.seats[i]?.name.split(' ')[0] ?? `#${i}`;
  const assignedTo = (id: string) => { const e = Object.entries(assignments).find(([, cid]) => cid === id); return e ? seatName(Number(e[0])) : undefined; };
  const order = ['attack', 'signature', 'heal', 'protect', 'job'];
  const sorted = [...cards].sort((a, b) => order.indexOf(typeOf(a.key)) - order.indexOf(typeOf(b.key)) || a.key.localeCompare(b.key));
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-thin py-2 px-1">
      {sorted.map((c) => { const tag = assignedTo(c.id); return (
        <div key={c.id} className="shrink-0"><CardFace cardKey={c.key} width={84} selected={selected === c.id} dimmed={!!tag && selected !== c.id} tag={tag ? `→ ${tag}` : undefined} onClick={() => onSelect(c.id)} onPointerDown={onDragStart ? (e) => onDragStart(c.id, e) : undefined} /></div>
      ); })}
      {cards.length === 0 && <p className="text-sm text-ink-2 italic px-2">No cards in hand.</p>}
    </div>
  );
}
function typeOf(key: string): string { return key.startsWith('sig:') || key.startsWith('alms:') || key === 'tax-collector' ? 'signature' : key.startsWith('mishap:') || key.startsWith('calamity:') ? 'attack' : key.startsWith('job:') ? 'job' : key; }
