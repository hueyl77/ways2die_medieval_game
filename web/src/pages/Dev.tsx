// Local harness: runs the real engine in the browser with fake seats so the table,
// hand, reveal animation and modals can be exercised without accounts or a server.
import { useCallback, useMemo, useRef, useState } from 'react';
import { createGame, setReady, submitPlacement, answerChoice, acknowledge, revealSkip, sealWill, tick, projectFor, handOf, gravePoolOf, heirOptions, type GameState } from '../engine/index.ts';
import { Table } from '../components/Table';
import { Hand } from '../components/Hand';
import { GoldBoard, Calendar } from '../components/GoldBoard';
import { RevealPlayer, type GoldAnim } from '../components/RevealPlayer';
import { GameLog } from '../components/GameLog';
import { ChoiceModal, FuneralModal, EndScreen } from '../components/Modals';
import { Button, Eyebrow } from '../components/ui';
import { TRADE_INFO, def } from '../lib/cards';

const ME = 'u0';
function makeGame(seatCount: number): GameState {
  const seats = Array.from({ length: seatCount }, (_, i) => ({ userId: i < seatCount - 1 ? `u${i}` : null, name: i === 0 ? 'You' : i < seatCount - 1 ? ['Marta', 'Bram', 'Odo', 'Ysolde', 'Piers', 'Agnes', 'Wat', 'Hild', 'Cedric', 'Rowan', 'Edith'][i - 1] : 'Stranger', crest: ['gold', 'crimson', 'azure', 'emerald', 'violet', 'umber', 'ivory', 'teal', 'rose', 'slate', 'amber', 'moss'][i], isTownsfolk: i === seatCount - 1 }));
  return createGame({ id: 'dev', code: 'DEVDEV', hostUserId: ME, seats, seed: Math.floor(Math.random() * 1e9), now: Date.now(), settings: { gossipSeconds: 999, placementSeconds: 999, revealSeconds: 999, funeralSeconds: 999, choiceSeconds: 999 } });
}

export default function Dev() {
  const stateRef = useRef<GameState>(makeGame(5));
  const [version, setVersion] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [haunt, setHaunt] = useState<{ cardId: string; pileSeat: number } | null>(null);
  const [goldAnim, setGoldAnim] = useState<GoldAnim | null>(null);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const s = stateRef.current;
  const view = useMemo(() => projectFor(s, ME, version, Date.now()), [s, version]);

  // everyone else acts automatically
  const settle = useCallback(() => {
    const st = stateRef.current; const now = Date.now();
    const phase = () => st.phase as string;
    for (let guard = 0; guard < 8; guard++) {
      if (phase() === 'gossip') {
        for (const x of st.seats) if (x.alive && !x.isTownsfolk && x.userId !== ME && phase() === 'gossip') setReady(st, x.index, now);
      } else if (phase() === 'placement') {
        for (const x of st.seats) {
          if (x.isTownsfolk || x.userId === ME || x.locked || phase() !== 'placement') continue;
          if (x.alive) {
            const hand = handOf(st, x.index).slice(); const pl: Record<string, string> = {};
            for (let p = 0; p < st.seatCount; p++) pl[String(p)] = hand.splice(Math.floor(Math.random() * hand.length), 1)[0].id;
            submitPlacement(st, x.index, pl, null, now);
          } else {
            const pool = gravePoolOf(st, x.index); const living = st.seats.filter((y) => y.alive);
            submitPlacement(st, x.index, {}, pool.length && living.length ? { cardId: pool[0].id, pileSeat: living[Math.floor(Math.random() * living.length)].index } : null, now);
          }
        }
      } else if (phase() === 'choice') {
        for (const ch of [...st.choices]) if (!ch.answer && st.seats[ch.seat].userId !== ME && phase() === 'choice') answerChoice(st, ch.seat, ch.id, ch.options[0], now);
      } else if (phase() === 'reveal') {
        for (const x of st.seats) if (!x.isTownsfolk && x.userId !== ME && phase() === 'reveal') acknowledge(st, x.index, now);
      } else if (phase() === 'funeral') {
        for (const x of st.seats) if (!x.alive && !x.isTownsfolk && !x.willSealed && x.userId !== ME && phase() === 'funeral') { const o = heirOptions(st, x.index); if (o.length) sealWill(st, x.index, o[0], now); }
      } else break;
      const mine = st.seats.find((x) => x.userId === ME)!;
      const waitingOnMe = (phase() === 'gossip' && mine.alive && !mine.ready) || (phase() === 'placement' && !mine.locked) || (phase() === 'choice' && st.choices.some((c) => c.seat === mine.index && !c.answer)) || (phase() === 'reveal' && !mine.ack) || (phase() === 'funeral' && !mine.alive && !mine.willSealed);
      if (waitingOnMe) break;
    }
    bump();
  }, [bump]);

  (window as unknown as { __mwtd?: unknown }).__mwtd = { state: stateRef.current, settle, bump };
  const me = view.seats[view.me.seat!];
  const isGhost = view.me.isGhost;
  const now = Date.now();
  const showReveal = view.phase === 'reveal' && !!view.roundLog?.complete;
  const secondsLeft = view.phaseDeadline ? Math.max(0, Math.ceil((view.phaseDeadline - Date.now()) / 1000)) : null;
  const allAssigned = view.seats.every((x) => assignments[x.index]);

  const onSeatClick = (seat: number) => {
    if (view.phase !== 'placement' || me.locked) return;
    if (isGhost) { if (selected && view.seats[seat].alive) setHaunt({ cardId: selected, pileSeat: seat }); return; }
    if (!selected) return;
    setAssignments((a) => { const n = { ...a }; for (const k of Object.keys(n)) if (n[Number(k)] === selected) delete n[Number(k)]; n[seat] = selected; return n; });
    setSelected(null);
  };
  const autoFill = () => { const used = new Set(Object.values(assignments)); const free = view.me.hand.filter((c) => !used.has(c.id)); const q = [...free.filter((c) => c.key.startsWith('job:')), ...free.filter((c) => !c.key.startsWith('job:'))]; const n = { ...assignments }; for (const x of view.seats) if (!n[x.index]) { const c = q.shift(); if (c) n[x.index] = c.id; } setAssignments(n); };

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto] lg:grid-cols-[minmax(0,1fr)_320px] relative overflow-hidden">
      <header className="lg:col-span-2 flex flex-wrap items-center gap-4 px-4 py-2 border-b border-night-3 bg-night-2/60">
        <div><Eyebrow>Dev harness</Eyebrow><div className="font-display text-lg">{view.phase === 'ended' ? 'The year is over' : <>Round {view.round}/{view.calendar.rounds} · <span className="capitalize">{view.season}</span> · {view.phase}</>}</div></div>
        <div className="text-sm">{isGhost ? '👻 ghost' : view.me.trade && <>You are the <span className="text-gold">{TRADE_INFO[view.me.trade].emoji} {TRADE_INFO[view.me.trade].name}</span></>}</div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => { stateRef.current = makeGame(5); setAssignments({}); bump(); }}>New 5-seat game</Button>
          <Button variant="ghost" onClick={() => { stateRef.current = makeGame(9); setAssignments({}); bump(); }}>New 9-seat game</Button>
          <Button variant="ghost" onClick={() => { tick(stateRef.current, now + 1e9); bump(); }}>Force deadline</Button>
        </div>
      </header>
      <main className="relative min-h-0 min-w-0 p-2">
        <Table view={view} assignments={me.locked ? view.me.placements : assignments} hauntTarget={haunt?.pileSeat ?? null} onSeatClick={onSeatClick} selectable={view.phase === 'placement' && !me.locked} />
        {showReveal && view.roundLog && <RevealPlayer log={view.roundLog} view={view} secondsLeft={secondsLeft} busy={false} onNext={() => { acknowledge(stateRef.current, me.index, now); settle(); }} onSkip={() => { revealSkip(stateRef.current, me.index, now); settle(); }} onGold={setGoldAnim} />}
        {view.phase === 'choice' && view.me.choices.length > 0 && <ChoiceModal view={view} busy={false} onChoose={(cid, t) => { answerChoice(stateRef.current, me.index, cid, t as never, now); settle(); }} />}
        {view.phase === 'funeral' && isGhost && !me.willSealed && view.succession.length > 0 && <FuneralModal view={view} busy={false} onSeal={(h) => { sealWill(stateRef.current, me.index, h, now); settle(); }} />}
        {view.phase === 'ended' && <EndScreen view={view} onHome={() => { stateRef.current = makeGame(5); bump(); }} />}
      </main>
      <aside className="hidden lg:flex flex-col gap-4 p-3 border-l border-night-3 bg-night-2/40 min-h-0 row-span-2"><GoldBoard view={view} override={showReveal ? goldAnim?.gold ?? null : null} flash={showReveal ? goldAnim?.flash ?? null : null} /><Calendar view={view} /><div className="flex-1 min-h-0 flex flex-col"><div className="font-ui text-[11px] tracking-[0.2em] uppercase text-gold">Log</div><GameLog view={view} /></div></aside>
      <footer className="min-w-0 border-t border-night-3 bg-night-2/60 px-3 py-2">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          {view.phase === 'gossip' && me.alive && <Button onClick={() => { setReady(stateRef.current, me.index, now); settle(); }}>Ready</Button>}
          {view.phase === 'placement' && !isGhost && me.alive && (<>
            <Button disabled={me.locked || !allAssigned} onClick={() => { submitPlacement(stateRef.current, me.index, Object.fromEntries(Object.entries(assignments).map(([k, v]) => [String(k), v])), null, now); setAssignments({}); settle(); }}>{me.locked ? 'Locked ✓' : 'Lock in'}</Button>
            <Button variant="ghost" onClick={autoFill}>Fill the rest with wares</Button>
            <span className="text-sm text-ink-2">{Object.keys(assignments).length}/{view.seatCount} placed</span>
            {selected && <span className="text-sm text-gold">Click a seat for {def(view.me.hand.find((c) => c.id === selected)!.key).name}</span>}
          </>)}
          {view.phase === 'placement' && isGhost && (<><Button disabled={me.locked || !haunt} onClick={() => { submitPlacement(stateRef.current, me.index, {}, haunt, now); setHaunt(null); settle(); }}>Haunt</Button><Button variant="ghost" disabled={me.locked} onClick={() => { submitPlacement(stateRef.current, me.index, {}, null, now); settle(); }}>Rest quietly</Button></>)}
          {view.phase === 'gossip' && me.alive === false && <Button onClick={settle}>Skip (dead)</Button>}
        </div>
        <Hand view={view} cards={isGhost ? view.me.gravePool : view.me.hand} selected={selected ?? haunt?.cardId ?? null} assignments={me.locked ? view.me.placements : assignments} onSelect={(cid) => { if (view.phase === 'placement' && !me.locked) setSelected((x) => (x === cid ? null : cid)); }} />
      </footer>
    </div>
  );
}
