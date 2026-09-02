import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { LogEvent, PlayerView, RoundLog } from '../engine/types.ts';
import { TRADE_INFO, def } from '../lib/cards';
import { CardFace } from './Card';
import { Button } from './ui';

type Scene =
  | { kind: 'pile'; pileSeat: number; grave: boolean; cards: { id: string; key: string }[]; voided: Map<string, string>; discarded: Map<string, string> }
  | { kind: 'list'; title: string; lines: string[]; tone: 'blood' | 'heal' | 'gold' | 'moon' | 'parchment' }
  | { kind: 'death'; seat: number; trade: string; name: string }
  | { kind: 'hand'; seat: number; cards: string[] };

const name = (v: PlayerView, seat: number) => v.seats[seat]?.name ?? `Seat ${seat}`;
const tradeName = (t: string) => TRADE_INFO[t as keyof typeof TRADE_INFO]?.name ?? t;
const cardName = (k: string) => { try { return def(k).name; } catch { return k; } };

export function buildScenes(log: RoundLog, v: PlayerView): Scene[] {
  const ev = log.events; const scenes: Scene[] = [];
  const voidsFor = (p: number) => new Map(ev.filter((e): e is Extract<LogEvent, { t: 'void' }> => e.t === 'void' && e.pileSeat === p).map((e) => [e.cardId, e.by]));
  const discFor = (p: number) => new Map(ev.filter((e): e is Extract<LogEvent, { t: 'discard' }> => e.t === 'discard' && e.pileSeat === p).map((e) => [e.cardId, e.by]));
  for (const e of ev) if (e.t === 'reveal') scenes.push({ kind: 'pile', pileSeat: e.pileSeat, grave: e.grave, cards: e.cards, voided: voidsFor(e.pileSeat), discarded: discFor(e.pileSeat) });
  const wounds = ev.filter((e) => e.t === 'wound' || e.t === 'heal' || e.t === 'poison_set').map((e) =>
    e.t === 'wound' ? `${name(v, e.seat)} takes ${e.amount} wound${e.amount > 1 ? 's' : ''} — ${cardName(e.cardKey)} (${e.total} total)`
    : e.t === 'heal' ? `${name(v, e.seat)} heals ${e.amount} — ${cardName(e.cardKey)} (${e.total} left)`
    : `${name(v, e.seat)} has been poisoned. It bites at the end of next round.`);
  if (wounds.length) scenes.push({ kind: 'list', title: 'Wounds & remedies', lines: wounds, tone: 'blood' });
  for (const e of ev) if (e.t === 'death') scenes.push({ kind: 'death', seat: e.seat, trade: e.trade, name: e.name });
  // wares bank one coin at a time; show them as one line per trade
  const wares = new Map<string, number>();
  const gold: string[] = [];
  for (const e of ev) {
    if (e.t === 'gold' && e.by.startsWith('job:') && !e.absorbed) { wares.set(e.trade, (wares.get(e.trade) ?? 0) + e.delta); continue; }
    if (e.t === 'gold') gold.push(e.absorbed ? `${tradeName(e.trade)} is shielded — ${cardName(e.by)} takes nothing` : `${tradeName(e.trade)} ${e.delta > 0 ? '+' : ''}${e.delta} · ${e.by === 'reeves-tax' ? "Reeve's Tax" : e.by === 'wounds' ? 'wounds' : cardName(e.by)}${e.from ? ` (from ${tradeName(e.from)})` : ''}`);
    else if (e.t === 'shield') gold.push(`${tradeName(e.trade)} is locked in an Iron Strongbox`);
    else if (e.t === 'scoring') gold.push(`${cardName(e.cardKey)} sits in front of ${name(v, e.seat)} until the final count`);
    else if (e.t === 'chosen') gold.push(`${name(v, e.seat)} chose ${tradeName(e.trade)} for ${cardName(e.cardKey)}${e.auto ? ' (by default)' : ''}`);
  }
  const waresLines = [...wares.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${tradeName(t)} +${n} · wares sold`);
  gold.unshift(...waresLines);
  if (gold.length) scenes.push({ kind: 'list', title: 'The ledger', lines: gold, tone: 'gold' });
  for (const e of ev) {
    if (e.t === 'truth') scenes.push({ kind: 'list', title: cardName(e.cardKey), lines: [`${name(v, e.seat)} must answer truthfully: ${e.answer}`], tone: 'moon' });
    if (e.t === 'reveal_hand') scenes.push({ kind: 'hand', seat: e.seat, cards: e.cards });
  }
  const pend = ev.filter((e): e is Extract<LogEvent, { t: 'pending' }> => e.t === 'pending').map((e) => `${cardName(e.cardKey)} stays on ${name(v, e.pileSeat)}'s pile${e.untilRound ? ' until next round' : ''}`);
  if (pend.length) scenes.push({ kind: 'list', title: 'Left on the table', lines: pend, tone: 'moon' });
  for (const e of ev) if (e.t === 'season_event') scenes.push({ kind: 'list', title: "The Reeve's Tax", lines: e.trades.length ? e.trades.map((t) => `${tradeName(t)} pays 2 gold to the crown`) : ['Nobody was rich enough to tax.'], tone: 'gold' });
  return scenes;
}

const sceneMs = (s: Scene, fast: boolean) => {
  const base = s.kind === 'pile' ? 1100 + 160 * s.cards.length + (s.voided.size + s.discarded.size) * 500
    : s.kind === 'death' ? 2800 : s.kind === 'hand' ? 5000 : 900 + Math.min(8, s.lines.length) * 550;
  return fast ? base / 2.5 : base;
};

export function RevealPlayer({ log, view, onDone }: { log: RoundLog; view: PlayerView; onDone: () => void }) {
  const scenes = useMemo(() => buildScenes(log, view), [log, view]);
  const [i, setI] = useState(0);
  const [fast, setFast] = useState(false);
  useEffect(() => {
    if (i >= scenes.length) { onDone(); return; }
    const t = setTimeout(() => setI((n) => n + 1), sceneMs(scenes[i], fast));
    return () => clearTimeout(t);
  }, [i, scenes, fast, onDone]);
  const s = scenes[i];
  return (
    <div className="absolute inset-0 z-30 bg-night/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="absolute top-3 right-3 flex gap-2">
        <Button variant="ghost" onClick={() => setFast((f) => !f)}>{fast ? 'Normal speed' : 'Faster'}</Button>
        <Button variant="ghost" onClick={() => setI(scenes.length)}>Skip</Button>
      </div>
      <div className="font-ui text-[11px] tracking-[0.2em] uppercase text-ink-2 mb-3">Round {log.round} · scene {Math.min(i + 1, scenes.length)} / {scenes.length}</div>
      {s && <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="w-full max-w-4xl">
        {s.kind === 'pile' && <PileScene s={s} view={view} fast={fast} />}
        {s.kind === 'list' && <ListScene s={s} fast={fast} />}
        {s.kind === 'death' && <DeathScene s={s} />}
        {s.kind === 'hand' && <HandScene s={s} view={view} />}
      </motion.div>}
    </div>
  );
}

function PileScene({ s, view, fast }: { s: Extract<Scene, { kind: 'pile' }>; view: PlayerView; fast: boolean }) {
  const owner = view.seats[s.pileSeat];
  return (
    <div className="text-center">
      <h2 className="font-display text-3xl text-parchment mb-1">{s.grave ? `${owner.name}'s grave` : `In front of ${owner.name}`}</h2>
      <p className="text-ink-2 text-sm mb-4">{s.grave ? 'Cards left on a grave have no effect.' : `${s.cards.length} cards, shuffled — nobody knows who placed what.`}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {s.cards.map((c, idx) => (
          <motion.div key={c.id} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: (fast ? 0.06 : 0.16) * idx, duration: 0.35 }}>
            <CardFace cardKey={c.key} width={110} voided={s.voided.has(c.id) || s.discarded.has(c.id)} />
            {(s.voided.get(c.id) || s.discarded.get(c.id)) && <div className="text-[11px] text-blood font-ui mt-1">{s.voided.has(c.id) ? 'voided' : 'discarded'} by {cardName(s.voided.get(c.id) ?? s.discarded.get(c.id)!)}</div>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
function ListScene({ s, fast }: { s: Extract<Scene, { kind: 'list' }>; fast: boolean }) {
  const color = { blood: 'text-blood', heal: 'text-heal', gold: 'text-gold', moon: 'text-moon', parchment: 'text-parchment' }[s.tone];
  return (
    <div className="bg-night-2 border border-night-3 rounded-md p-5 mx-auto max-w-xl max-h-[70vh] overflow-y-auto scrollbar-thin">
      <h2 className={`font-display text-2xl mb-3 ${color}`}>{s.title}</h2>
      <ul className="space-y-1.5">
        {s.lines.map((l, idx) => <motion.li key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (fast ? 0.12 : 0.45) * idx }} className="text-parchment">{l}</motion.li>)}
      </ul>
    </div>
  );
}
function DeathScene({ s }: { s: Extract<Scene, { kind: 'death' }> }) {
  return (
    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
      <div className="text-6xl mb-2">☠️</div>
      <h2 className="font-display text-4xl text-blood">{s.name} is dead</h2>
      <p className="text-parchment mt-2 text-lg">The envelope opens: {s.name} was the <span className="text-gold">{tradeName(s.trade)}</span>.</p>
    </motion.div>
  );
}
function HandScene({ s, view }: { s: Extract<Scene, { kind: 'hand' }>; view: PlayerView }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-3xl text-moon mb-1">Strong Ale</h2>
      <p className="text-ink-2 text-sm mb-3">{name(view, s.seat)} is drunk and shows the whole hand for five seconds.</p>
      <div className="flex flex-wrap justify-center gap-1.5">{s.cards.map((k, idx) => <CardFace key={idx} cardKey={k} width={64} />)}</div>
    </div>
  );
}
