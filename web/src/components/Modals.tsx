import { motion } from 'framer-motion';
import type { PlayerView } from '../engine/types.ts';
import { TRADE_INFO, def } from '../lib/cards';
import { Button, Crest } from './ui';

export function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-40 bg-night/80 backdrop-blur-sm grid place-items-center p-4"><motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-night-2 border border-gold/40 rounded-md p-6 w-full max-w-lg shadow-card">{children}</motion.div></div>;
}

export function ChoiceModal({ view, onChoose, busy }: { view: PlayerView; onChoose: (choiceId: string, trade: string) => void; busy: boolean }) {
  const ch = view.me.choices[0];
  if (!ch) return null;
  return (
    <Overlay>
      <h2 className="font-display text-2xl text-gold">{def(ch.cardKey).name}</h2>
      <p className="text-sm text-ink-2 mb-4">{def(ch.cardKey).text} Choose a track.</p>
      <div className="grid grid-cols-3 gap-2">
        {ch.options.map((t) => <Button key={t} variant="ghost" disabled={busy} onClick={() => onChoose(ch.id, t)}>{TRADE_INFO[t].emoji} {TRADE_INFO[t].name} ({view.gold[t] ?? 0})</Button>)}
      </div>
    </Overlay>
  );
}

export function FuneralModal({ view, onSeal, busy }: { view: PlayerView; onSeal: (heir: number) => void; busy: boolean }) {
  return (
    <Overlay>
      <div className="text-center text-4xl mb-2">🪦</div>
      <h2 className="font-display text-2xl text-parchment text-center">Seal your will</h2>
      <p className="text-sm text-ink-2 text-center mt-1 mb-4">Choose a living villager as your secret heir. If they win the year, you rise to share the victory. They will never know.</p>
      <div className="grid grid-cols-2 gap-2">
        {view.succession.map((i) => { const s = view.seats[i]; return (
          <Button key={i} variant="ghost" disabled={busy} onClick={() => onSeal(i)}><Crest color={s.crest} size={14} /> <span className="ml-2">{s.name}</span></Button>
        ); })}
      </div>
    </Overlay>
  );
}

export function EndScreen({ view, onHome }: { view: PlayerView; onHome: () => void }) {
  const rows = view.scoreRows ?? [];
  const winners = view.winners ?? [];
  return (
    <div className="absolute inset-0 z-40 bg-night/90 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">{winners.length ? '👑' : '🕯️'}</div>
          <h2 className="font-display text-4xl text-gold">{winners.length ? `${winners.map((w) => view.seats[w].name).join(' & ')} ${winners.length > 1 ? 'share the year' : 'wins the year'}` : 'The village stands empty'}</h2>
          {view.sharedBy && view.sharedBy.length > 0 && <p className="text-moon mt-2">From beyond the grave, {view.sharedBy.map((s) => view.seats[s].name).join(' and ')} rise to share it — their wills named the winner.</p>}
        </div>
        <div className="bg-night-2 border border-night-3 rounded-md p-4 mb-4">
          <h3 className="font-display text-xl text-parchment mb-2">The final reveal</h3>
          <ul className="grid sm:grid-cols-2 gap-1 text-sm">
            {view.seats.map((s) => <li key={s.index} className={`${s.alive ? '' : 'opacity-60'}`}><Crest color={s.crest} size={12} /> <span className="ml-1">{s.name}</span> — <span className="text-gold">{s.revealedTrade ? `${TRADE_INFO[s.revealedTrade].emoji} ${TRADE_INFO[s.revealedTrade].name}` : 'unknown'}</span>{!s.alive && ' ☠'}{view.me.heir !== null && s.index === view.me.heir ? ' (your heir)' : ''}</li>)}
          </ul>
        </div>
        <table className="w-full text-sm bg-night-2 border border-night-3 rounded-md overflow-hidden">
          <thead className="font-ui text-[11px] uppercase tracking-wider text-ink-2"><tr><th className="text-left p-2">Survivor</th><th className="text-left p-2">Trade</th><th className="p-2">Gold</th><th className="p-2">Wounds</th><th className="p-2">Total</th></tr></thead>
          <tbody>{rows.sort((a, b) => b.total - a.total).map((r) => (
            <tr key={r.seat} className={winners.includes(r.seat) ? 'text-gold' : r.eligible ? '' : 'opacity-50 italic'}><td className="p-2">{view.seats[r.seat].name}</td><td className="p-2">{TRADE_INFO[r.trade].name}</td><td className="p-2 text-center">{r.base}</td><td className="p-2 text-center">−{r.wounds}</td><td className="p-2 text-center font-bold">{r.total}</td></tr>
          ))}</tbody>
        </table>
        <div className="text-center mt-6"><Button onClick={onHome}>Back to the square</Button></div>
      </div>
    </div>
  );
}

