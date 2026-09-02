import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerView, RoundLog } from '../engine/types.ts';
import { buildScenes, cardName, sceneGold, type Scene } from '../engine/scenes.ts';
import type { GoldFlash } from './GoldBoard';
import { TRADE_INFO } from '../lib/cards';
import { CardFace } from './Card';
import { Button, Crest } from './ui';

const tradeName = (t: string) => TRADE_INFO[t as keyof typeof TRADE_INFO]?.name ?? t;

/** The reveal, one scene at a time. The scene index comes from the server (view.revealStep);
 *  the table advances when every player has clicked Next, skipped, or the scene timer runs out. */
export interface GoldAnim { gold: Record<string, number>; flash: GoldFlash | null }
export const PILE_STAGGER = { fast: 0.05, normal: 0.14 };
export const LINE_STAGGER = { fast: 0.05, normal: 0.25 };

export function RevealPlayer({ log, view, secondsLeft, busy, onNext, onSkip, onGold }:
  { log: RoundLog; view: PlayerView; secondsLeft: number | null; busy: boolean; onNext: () => void; onSkip: () => void; onGold?: (g: GoldAnim | null) => void }) {
  const scenes = useMemo(() => buildScenes(log, (i) => view.seats[i]?.name ?? `Seat ${i}`), [log, view]);
  const step = Math.min(view.revealStep, Math.max(0, scenes.length - 1));
  const s = scenes[step];
  const [fast, setFast] = useState(false);
  // the board as it stood before this round: today's board minus every change in the log
  const preGold = useMemo(() => {
    const g: Record<string, number> = { ...view.gold };
    for (const e of log.events) if (e.t === 'gold' && e.delta) g[e.trade] = (g[e.trade] ?? 0) - e.delta;
    return g;
  }, [log, view.gold]);
  const onGoldRef = useRef(onGold); onGoldRef.current = onGold;
  useEffect(() => {
    const cb = onGoldRef.current; if (!cb) return;
    const base: Record<string, number> = { ...preGold };
    for (let i = 0; i < step; i++) for (const d of sceneGold(scenes[i])) base[d.trade] = (base[d.trade] ?? 0) + d.delta;
    cb({ gold: { ...base }, flash: null });
    const timers: number[] = [];
    const scene = scenes[step];
    if (scene) {
      const stagger = (scene.kind === 'pile' ? PILE_STAGGER : LINE_STAGGER)[fast ? 'fast' : 'normal'] * 1000;
      const items: { delay: number; deltas: { trade: string; delta: number }[] }[] = scene.kind === 'pile'
        ? scene.cards.map((c, idx) => ({ delay: 350 + idx * stagger, deltas: scene.cardGold.has(c.id) ? [scene.cardGold.get(c.id)!] : [] }))
        : scene.kind === 'list' ? scene.lines.map((l, idx) => ({ delay: 250 + idx * stagger, deltas: l.gold ?? [] })) : [];
      let id = 0;
      for (const it of items) for (const d of it.deltas) timers.push(window.setTimeout(() => { base[d.trade] = (base[d.trade] ?? 0) + d.delta; cb({ gold: { ...base }, flash: { trade: d.trade, delta: d.delta, id: ++id + step * 1000 } }); }, it.delay));
    }
    return () => { for (const t of timers) window.clearTimeout(t); };
  }, [step, scenes, preGold, fast]);
  useEffect(() => () => onGoldRef.current?.(null), []);
  const me = view.me.seat !== null ? view.seats[view.me.seat] : null;
  const acked = !!me?.ack;
  const waiting = view.revealWaitingOn.filter((i) => i !== view.me.seat);
  const last = step >= scenes.length - 1;
  return (
    <div className="absolute inset-0 z-30 bg-night/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="absolute top-3 left-3 flex items-center gap-3">
        <div className="font-ui text-[11px] tracking-[0.2em] uppercase text-ink-2">Round {log.round} · scene {step + 1} / {scenes.length}</div>
        {secondsLeft !== null && <div className={`font-ui tabular-nums text-sm ${secondsLeft <= 5 ? 'text-blood' : 'text-gold'}`} title="The scene moves on by itself when this runs out">{secondsLeft}s</div>}
      </div>
      <div className="absolute top-3 right-3 flex gap-2">
        <Button variant="ghost" onClick={() => setFast((f) => !f)}>{fast ? 'Normal speed' : 'Faster'}</Button>
        <Button variant="ghost" disabled={busy || !!me?.skipReveal} onClick={onSkip}>{me?.skipReveal ? 'Skipped' : 'Skip to the end'}</Button>
      </div>
      {s && <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="w-full max-w-4xl">
        {s.kind === 'pile' && <PileScene s={s} view={view} fast={fast} />}
        {s.kind === 'list' && <ListScene s={s} fast={fast} />}
        {s.kind === 'death' && <DeathScene s={s} />}
        {s.kind === 'hand' && <HandScene s={s} view={view} />}
      </motion.div>}
      <div className="absolute bottom-4 inset-x-0 flex flex-col items-center gap-2">
        <Button disabled={busy || acked} onClick={onNext}>{acked ? 'Waiting for the others…' : last ? 'Finish' : 'Next'}</Button>
        {waiting.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-ink-2 font-ui">
            <span>Still watching:</span>
            {waiting.map((i) => <span key={i} className="flex items-center gap-1"><Crest color={view.seats[i].crest} size={10} />{view.seats[i].name}</span>)}
          </div>
        )}
      </div>
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
          <motion.div key={c.id} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: (fast ? 0.05 : 0.14) * idx, duration: 0.3 }}>
            <CardFace cardKey={c.key} width={110} voided={s.voided.has(c.id) || s.discarded.has(c.id)} />
            {(s.voided.get(c.id) || s.discarded.get(c.id)) && <div className="text-[11px] text-blood font-ui mt-1">{s.voided.has(c.id) ? 'voided' : 'discarded'} by {cardName(s.voided.get(c.id) ?? s.discarded.get(c.id)!)}</div>}
            {s.cardGold.has(c.id) && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (fast ? 0.05 : 0.14) * idx + 0.35 }} className="text-[11px] text-gold font-ui mt-1">+{s.cardGold.get(c.id)!.delta} → {tradeName(s.cardGold.get(c.id)!.trade)}</motion.div>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
function ListScene({ s, fast }: { s: Extract<Scene, { kind: 'list' }>; fast: boolean }) {
  const color = { blood: 'text-blood', heal: 'text-heal', gold: 'text-gold', moon: 'text-moon', parchment: 'text-parchment' }[s.tone];
  return (
    <div className="bg-night-2 border border-night-3 rounded-md p-5 mx-auto max-w-xl max-h-[60vh] overflow-y-auto scrollbar-thin">
      <h2 className={`font-display text-2xl mb-3 ${color}`}>{s.title}</h2>
      <ul className="space-y-1.5">
        {s.lines.map((l, idx) => <motion.li key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (fast ? 0.05 : 0.25) * idx }} className="text-parchment">{l.text}</motion.li>)}
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
      <p className="text-ink-2 text-sm mb-3">{view.seats[s.seat]?.name} is drunk and shows the whole hand.</p>
      <div className="flex flex-wrap justify-center gap-1.5">{s.cards.map((k, idx) => <CardFace key={idx} cardKey={k} width={64} />)}</div>
    </div>
  );
}
