import type { PlayerView } from '../engine/types.ts';
import { isAttack } from '../engine/cards.ts';

/** Puts a card on every seat that has none yet and returns the new assignments.
 *  Drawing from the deck: the rest of the hand is dealt out at random, keeping Attacks off your own seat when there is a choice.
 *  Open Envelope (whole envelope in hand): wares first, as that mode always did. */
export function fillRest(view: PlayerView, assignments: Record<number, string>): Record<number, string> {
  const used = new Set(Object.values(assignments));
  const free = view.me.hand.filter((c) => !used.has(c.id));
  const next = { ...assignments };
  const open = view.seats.filter((s) => !next[s.index]).map((s) => s.index);
  if (!view.settings.drawMode) {
    const queue = [...free.filter((c) => c.key.startsWith('job:')), ...free.filter((c) => !c.key.startsWith('job:'))];
    for (const i of open) { const c = queue.shift(); if (c) next[i] = c.id; }
    return next;
  }
  const cards = free.map((c) => ({ c, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.c);
  const mine = view.me.seat;
  if (mine !== null && open.includes(mine)) {
    const k = cards.findIndex((c) => !isAttack(c.key));
    const [c] = cards.splice(k >= 0 ? k : 0, 1);
    if (c) next[mine] = c.id;
  }
  for (const i of open) if (!next[i]) { const c = cards.shift(); if (c) next[i] = c.id; }
  return next;
}

export const fillRestLabel = (view: PlayerView) => (view.settings.drawMode ? 'Place the rest at random' : 'Fill the rest with wares');
