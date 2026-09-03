import { AnimatePresence, motion } from 'framer-motion';
import { ACTIVE_TRADES, TRADE_INFO } from '../lib/cards';
import type { PlayerView } from '../engine/types.ts';
import { Eyebrow } from './ui';

export interface GoldFlash { trade: string; delta: number; id: number }
export function GoldBoard({ view, override, flash, unlock = [] }: { view: PlayerView; override?: Record<string, number> | null; flash?: GoldFlash | null; unlock?: string[] }) {
  const gold = override ?? view.gold;
  const max = Math.max(6, ...Object.values(view.gold), ...Object.values(gold));
  return (
    <div>
      <Eyebrow>Gold board</Eyebrow>
      <ul className="mt-2 space-y-1">
        {ACTIVE_TRADES.map((t) => {
          const g = gold[t] ?? 0; const locked = view.lockedTrades.includes(t) && !unlock.includes(t); const shielded = view.shieldedTrades.includes(t);
          const hit = flash && flash.trade === t ? flash : null;
          const mine = view.me.trade === t;
          return (
            <li key={t} data-gold-trade={t} className={`relative flex items-center gap-2 text-sm ${locked ? 'opacity-40 line-through' : ''}`}>
              <span className="w-5 text-center">{TRADE_INFO[t].emoji}</span>
              <span className={`w-24 font-ui ${mine ? 'text-gold' : ''}`}>{TRADE_INFO[t].name}{shielded ? ' 🔒' : ''}</span>
              <div className="flex-1 h-3 bg-night-3 rounded-sm overflow-hidden">
                <motion.div className="h-full bg-gold" initial={{ width: 0 }} animate={{ width: `${(g / max) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
              </div>
              <span className="w-6 text-right font-ui tabular-nums">{g}</span>
              <AnimatePresence>{hit && <motion.span key={hit.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: -6 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} className={`absolute right-7 top-0 font-ui text-xs font-bold ${hit.delta > 0 ? 'text-gold' : 'text-blood'}`}>{hit.delta > 0 ? '+' : ''}{hit.delta}</motion.span>}</AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SEASON_RULE: Record<string, string> = { spring: 'No special rule.', harvest: 'Market Fair: wares bank +1. Reeve\'s Tax at season\'s end.', winter: 'Hungry Winter: a Protect voids only one Attack.' };

export function Calendar({ view }: { view: PlayerView }) {
  return (
    <div>
      <Eyebrow>Calendar</Eyebrow>
      <div className="mt-2 flex gap-1">
        {view.calendar.seasons.map((s, i) => (
          <div key={i} className={`flex-1 text-center rounded-sm py-1 font-ui text-[11px] uppercase tracking-wider ${i + 1 === view.round ? 'bg-gold text-night' : i + 1 < view.round ? 'bg-night-3 text-ink-2' : 'bg-night-2 border border-night-3 text-ink-2'}`}>{s.slice(0, 3)} {i + 1}</div>
        ))}
      </div>
      {view.season && <p className="text-xs text-ink-2 mt-1"><span className="text-parchment capitalize">{view.season}</span> · {view.settings.seasonRules ? SEASON_RULE[view.season] : 'Every round plays the same.'}</p>}
    </div>
  );
}
