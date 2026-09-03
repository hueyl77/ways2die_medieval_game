import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { PlayerView, RoundLog } from '../engine/types.ts';
import { buildScenes, cardName, sceneGold, type Scene, sceneWounds } from '../engine/scenes.ts';
import type { GoldFlash } from './GoldBoard';
import { TRADE_INFO } from '../lib/cards';
import { CardFace } from './Card';
import { Button, Crest } from './ui';

const tradeName = (t: string) => TRADE_INFO[t as keyof typeof TRADE_INFO]?.name ?? t;

/** The reveal, one scene at a time. The scene index comes from the server (view.revealStep);
 *  the table advances when every player has clicked Next, skipped, or the scene timer runs out. */
export interface GoldAnim { gold: Record<string, number>; flash: GoldFlash | null }
/** The table's wound counts and graves as the reveal has shown them so far, plus the latest change to flash on a seat. */
export interface WoundAnim { wounds: Record<number, number>; alive: Record<number, boolean>; flash: { seat: number; delta: 1 | -1 | 0; id: number } | null }
const WOUND_START_MS = 500;                   // after the last card of a pile has flipped, the first wound lands
const WOUND_STAGGER = { fast: 0.15, normal: 0.55 };   // seconds between wound steps
export const PILE_STAGGER = { fast: 0.05, normal: 0.14 };
export const LINE_STAGGER = { fast: 0.05, normal: 0.25 };
const FLIGHT_MS = 750;            // a coin's trip from the card to the gold board
const COIN_LABEL_MS = 350;        // the card flips, then the "+N coins" label pops

interface Flight { id: number; from: { x: number; y: number }; to: { x: number; y: number }; count: number }

/** Gold coins arcing from a revealed wares card to its trade's row on the gold board. Rendered into document.body so it can cross panels. */
function CoinFlights({ flights }: { flights: Flight[] }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] pointer-events-none">
      {flights.map((f) => Array.from({ length: f.count }).map((_, i) => (
        <motion.div key={`${f.id}-${i}`} className="absolute text-xl leading-none select-none" style={{ left: 0, top: 0 }}
          initial={{ x: f.from.x - 10 + i * 6, y: f.from.y - 10, opacity: 0, scale: 0.5 }}
          animate={{ x: [f.from.x - 10 + i * 6, (f.from.x + f.to.x) / 2, f.to.x - 10], y: [f.from.y - 10, Math.min(f.from.y, f.to.y) - 70, f.to.y - 10], opacity: [0, 1, 1], scale: [0.5, 1.1, 0.7] }}
          transition={{ duration: FLIGHT_MS / 1000, delay: i * 0.08, times: [0, 0.5, 1], ease: 'easeInOut' }}>🪙</motion.div>
      )))}
    </div>,
    document.body,
  );
}
const centerTop = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 8 }; };
const rowPoint = (trade: string) => { const el = document.querySelector(`[data-gold-trade="${trade}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.right - 22, y: r.top + r.height / 2 }; };

export function RevealPlayer({ log, view, secondsLeft, busy, onNext, onSkip, onGold, onFocusSeat, onWounds }:
  { log: RoundLog; view: PlayerView; secondsLeft: number | null; busy: boolean; onNext: () => void; onSkip: () => void; onGold?: (g: GoldAnim | null) => void; onFocusSeat?: (seat: number | null) => void; onWounds?: (w: WoundAnim | null) => void }) {
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
  const [coinLabels, setCoinLabels] = useState<Record<string, number>>({});
  const [hits, setHits] = useState<Record<string, number>>({});   // pile card id -> how many times it has struck, to replay its shake
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightId = useRef(0);
  useEffect(() => {
    const cb = onGoldRef.current;
    const base: Record<string, number> = { ...preGold };
    for (let i = 0; i < step; i++) for (const d of sceneGold(scenes[i])) base[d.trade] = (base[d.trade] ?? 0) + d.delta;
    cb?.({ gold: { ...base }, flash: null });
    setCoinLabels({}); setFlights([]); setHits({});
    const timers: number[] = [];
    const scene = scenes[step];
    let id = 0;
    const bump = (d: { trade: string; delta: number }) => { base[d.trade] = (base[d.trade] ?? 0) + d.delta; cb?.({ gold: { ...base }, flash: { trade: d.trade, delta: d.delta, id: ++id + step * 1000 } }); };
    if (scene?.kind === 'pile') {
      const stagger = PILE_STAGGER[fast ? 'fast' : 'normal'] * 1000;
      scene.cards.forEach((c, idx) => {
        const d = scene.cardGold.get(c.id); if (!d) return;
        const at = COIN_LABEL_MS + idx * stagger;
        // beat 1: "+N coins" above the card and coins take off toward the trade's row
        timers.push(window.setTimeout(() => {
          setCoinLabels((l) => ({ ...l, [c.id]: d.delta }));
          const from = centerTop(document.querySelector(`[data-reveal-card="${c.id}"]`)); const to = rowPoint(d.trade);
          if (from && to) { const f = { id: ++flightId.current, from, to, count: Math.min(3, d.delta) }; setFlights((fl) => [...fl, f]); timers.push(window.setTimeout(() => setFlights((fl) => fl.filter((x) => x.id !== f.id)), FLIGHT_MS + 400)); }
        }, at));
        // beat 2: the coins land and the bar moves
        timers.push(window.setTimeout(() => bump(d), at + FLIGHT_MS));
      });
    } else if (scene?.kind === 'list') {
      const stagger = LINE_STAGGER[fast ? 'fast' : 'normal'] * 1000;
      scene.lines.forEach((l, idx) => { for (const d of l.gold ?? []) timers.push(window.setTimeout(() => bump(d), 250 + idx * stagger)); });
    }
    return () => { for (const t of timers) window.clearTimeout(t); };
  }, [step, scenes, preGold, fast]);
  useEffect(() => () => onGoldRef.current?.(null), []);
  // wounds: start every seat where it stood before the round, then let each scene's wounds land one at a time
  const preWounds = useMemo(() => {
    const w: Record<number, number> = {}; const alive: Record<number, boolean> = {};
    for (const st of view.seats) { w[st.index] = st.wounds; alive[st.index] = st.alive; }
    const first = new Set<number>();
    for (const e of log.events) {
      if ((e.t === 'wound' || e.t === 'heal') && !first.has(e.seat)) { first.add(e.seat); w[e.seat] = e.t === 'wound' ? e.total - e.amount : e.total + e.amount; }
      if (e.t === 'death') alive[e.seat] = true;
    }
    return { w, alive };
  }, [log, view.seats]);
  const onWoundsRef = useRef(onWounds); onWoundsRef.current = onWounds;
  useEffect(() => {
    const cb = onWoundsRef.current; if (!cb) return;
    const wounds = { ...preWounds.w }; const alive = { ...preWounds.alive };
    for (let i = 0; i < step; i++) { for (const d of sceneWounds(scenes[i])) wounds[d.seat] = Math.max(0, (wounds[d.seat] ?? 0) + d.delta); const sc = scenes[i]; if (sc.kind === 'death') alive[sc.seat] = false; }
    cb({ wounds: { ...wounds }, alive: { ...alive }, flash: null });
    const timers: number[] = []; let id = step * 1000;
    const scene = scenes[step];
    // a flash fades on its own unless a newer one has replaced it
    const fade = (flashId: number) => timers.push(window.setTimeout(() => { if (id === flashId) cb({ wounds: { ...wounds }, alive: { ...alive }, flash: null }); }, 900));
    const land = (d: { seat: number; delta: 1 | -1; cardKey: string }) => {
      wounds[d.seat] = Math.max(0, (wounds[d.seat] ?? 0) + d.delta);
      cb({ wounds: { ...wounds }, alive: { ...alive }, flash: { seat: d.seat, delta: d.delta, id: ++id } }); fade(id);
      // the card that did the damage rattles in the pile as the wound lands
      if (d.delta === 1 && scene?.kind === 'pile') { const card = scene.cards.find((c) => c.key === d.cardKey && !scene.voided.has(c.id) && !scene.discarded.has(c.id)); if (card) setHits((h) => ({ ...h, [card.id]: (h[card.id] ?? 0) + 1 })); }
    };
    const stagger = WOUND_STAGGER[fast ? 'fast' : 'normal'] * 1000;
    if (scene?.kind === 'pile') {
      const flipsDone = (fast ? 0.05 : 0.14) * 1000 * Math.max(0, scene.cards.length - 1) + 300;
      scene.wounds.forEach((d, k) => timers.push(window.setTimeout(() => land(d), flipsDone + WOUND_START_MS + k * stagger)));
    } else if (scene?.kind === 'list') {
      const lineStagger = LINE_STAGGER[fast ? 'fast' : 'normal'] * 1000; let k = 0;
      scene.lines.forEach((l, idx) => { for (const d of l.wounds ?? []) { const at = 250 + idx * lineStagger + k * stagger; k += 1; timers.push(window.setTimeout(() => land(d), at)); } });
    } else if (scene?.kind === 'death') {
      timers.push(window.setTimeout(() => { alive[scene.seat] = false; cb({ wounds: { ...wounds }, alive: { ...alive }, flash: { seat: scene.seat, delta: 0, id: ++id } }); fade(id); }, 400));
    }
    return () => { for (const t of timers) window.clearTimeout(t); };
  }, [step, scenes, preWounds, fast]);
  useEffect(() => () => onWoundsRef.current?.(null), []);
  // tell the table whose pile is on show, so it can highlight and point at that seat
  const onFocusRef = useRef(onFocusSeat); onFocusRef.current = onFocusSeat;
  useEffect(() => { onFocusRef.current?.(s.kind === 'pile' ? s.pileSeat : null); }, [s]);
  useEffect(() => () => onFocusRef.current?.(null), []);
  const me = view.me.seat !== null ? view.seats[view.me.seat] : null;
  const acked = !!me?.ack;
  const waiting = view.revealWaitingOn.filter((i) => i !== view.me.seat);
  const last = step >= scenes.length - 1;
  return (
    <div className="absolute inset-0 z-30 bg-night/20 flex flex-col items-center justify-center p-4">
      <div className="absolute top-3 left-3 flex items-center gap-3">
        <div className="font-ui text-[11px] tracking-[0.2em] uppercase text-ink-2">Round {log.round} · scene {step + 1} / {scenes.length}</div>
        {secondsLeft !== null && <div className={`font-ui tabular-nums text-sm ${secondsLeft <= 5 ? 'text-blood' : 'text-gold'}`} title="The scene moves on by itself when this runs out">{secondsLeft}s</div>}
      </div>
      <div className="absolute top-3 right-3 flex gap-2">
        <Button variant="ghost" onClick={() => setFast((f) => !f)}>{fast ? 'Normal speed' : 'Faster'}</Button>
        <Button variant="ghost" disabled={busy || !!me?.skipReveal} onClick={onSkip}>{me?.skipReveal ? 'Skipped' : 'Skip to the end'}</Button>
      </div>
      <CoinFlights flights={flights} />
      {s && <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="w-full max-w-4xl">
        {s.kind === 'pile' && <PileScene s={s} view={view} fast={fast} coinLabels={coinLabels} hits={hits} />}
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

function PileScene({ s, view, fast, coinLabels, hits }: { s: Extract<Scene, { kind: 'pile' }>; view: PlayerView; fast: boolean; coinLabels: Record<string, number>; hits: Record<string, number> }) {
  const owner = view.seats[s.pileSeat];
  return (
    <div className="text-center px-12 py-6 rounded-[40px]" style={{ background: 'radial-gradient(ellipse at center, rgba(20,22,28,.88) 0%, rgba(20,22,28,.6) 60%, rgba(20,22,28,0) 100%)' }}>
      <h2 className="font-display text-3xl text-parchment mb-1">{s.grave ? `${owner.name}'s grave` : `In front of ${owner.name}`}</h2>
      <p className="text-ink-2 text-sm mb-4">{s.grave ? 'Cards left on a grave have no effect.' : `${s.cards.length} cards, shuffled, so nobody knows who placed what.`}{s.taxed && <span className="text-blood"> The Tax Collector is here: nothing in this pile earns gold.</span>}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {s.cards.map((c, idx) => (
          <motion.div key={c.id} data-reveal-card={c.id} className="relative pt-7" initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: (fast ? 0.05 : 0.14) * idx, duration: 0.3 }}>
            {coinLabels[c.id] && <motion.div initial={{ opacity: 0, y: 10, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="absolute top-0 inset-x-0 text-center font-display text-gold text-lg font-bold drop-shadow">+{coinLabels[c.id]} {coinLabels[c.id] > 1 ? 'coins' : 'coin'}</motion.div>}
            {/* keyed by hit count so every strike replays the shake; the flip above stays untouched */}
            <motion.div key={hits[c.id] ?? 0} animate={hits[c.id] ? { x: [0, -9, 9, -7, 7, -3, 3, 0], rotate: [0, -3, 3, -2, 2, 0] } : { x: 0, rotate: 0 }} transition={{ duration: 0.5 }} className={hits[c.id] ? 'rounded-md shadow-[0_0_26px_rgba(239,68,68,.85)] ring-2 ring-red-500' : ''}>
              <CardFace cardKey={c.key} width={110} voided={s.voided.has(c.id) || s.discarded.has(c.id)} />
            </motion.div>
            {(s.voided.get(c.id) || s.discarded.get(c.id)) && <div className="text-[11px] text-blood font-ui mt-1">{s.voided.has(c.id) ? 'voided' : 'discarded'} by {cardName(s.voided.get(c.id) ?? s.discarded.get(c.id)!)}</div>}
            {coinLabels[c.id] && s.cardGold.has(c.id) && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-gold font-ui mt-1">→ {tradeName(s.cardGold.get(c.id)!.trade)} track</motion.div>}
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
