import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { useGame } from '../state/useGame';
import { useCardDrag } from '../state/useCardDrag';
import { createPortal } from 'react-dom';
import { CardArt } from '../components/Card';
import { useChat } from '../state/useChat';
import { Table } from '../components/Table';
import { Hand } from '../components/Hand';
import { GoldBoard, Calendar } from '../components/GoldBoard';
import { Chat } from '../components/Chat';
import { RevealPlayer, type GoldAnim } from '../components/RevealPlayer';
import { GameLog } from '../components/GameLog';
import { ChoiceModal, FuneralModal, EndScreen } from '../components/Modals';
import { Button, Eyebrow } from '../components/ui';
import { TRADE_INFO, def } from '../lib/cards';

const PHASE_TEXT: Record<string, string> = {
  gossip: 'Gossip — accuse, deny, lie. Click Ready when you are done talking.',
  placement: 'Placement — talk it over, then put exactly one card in front of every seat, including yourself.',
  choice: 'A choice is being made…',
  reveal: 'The reveal.',
  funeral: 'A funeral. The dead are sealing their wills.',
  ended: 'The year is over.',
};

export default function Game() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, displayName } = useAuth();
  const { view, error, busy, act, secondsLeft } = useGame(id);
  const meSeat = view?.me.seat ?? null;
  const me = meSeat !== null && view ? view.seats[meSeat] : null;
  const isGhost = !!view?.me.isGhost;
  const chat = useChat(id, { name: displayName, userId: user?.id ?? null, ghost: isGhost });

  const [selected, setSelected] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [haunt, setHaunt] = useState<{ cardId: string; pileSeat: number } | null>(null);
  const [seenLogs, setSeenLogs] = useState(0);
  const [goldAnim, setGoldAnim] = useState<GoldAnim | null>(null);
  const [tab, setTab] = useState<'gossip' | 'log'>('gossip');

  useEffect(() => { if (view?.phase !== 'placement') { setAssignments({}); setSelected(null); setHaunt(null); } }, [view?.phase, view?.round]);

  // narrate truth answers and deaths into the chat as they happen
  useEffect(() => {
    if (!view) return;
    for (let i = seenLogs; i < view.logs.length; i++) {
      for (const e of view.logs[i].events) {
        if (e.t === 'truth') chat.system(`${view.seats[e.seat].name}, under ${def(e.cardKey).name}: "${e.answer}"`);
        if (e.t === 'death') chat.system(`${e.name} has died. The envelope opens: ${TRADE_INFO[e.trade].name}.`);
        if (e.t === 'season_event') chat.system(`The Reeve's Tax falls on ${e.trades.length ? e.trades.map((t) => TRADE_INFO[t].name).join(', ') : 'nobody'}.`);
      }
    }
    if (view.logs.length !== seenLogs) setSeenLogs(view.logs.length);
  }, [view, seenLogs, chat]);

  const locked = !!me?.locked;
  const effective = useMemo<Record<number, string>>(() => (locked && view ? Object.fromEntries(Object.entries(view.me.placements).map(([k, v]) => [Number(k), v])) : assignments), [locked, view, assignments]);
  const allAssigned = !!view && view.seats.every((s) => effective[s.index]);

  const placeCardOnSeat = useCallback((cardId: string, seat: number) => {
    if (!view || view.phase !== 'placement' || locked) return;
    if (isGhost) { if (view.seats[seat].alive) setHaunt({ cardId, pileSeat: seat }); setSelected(null); return; }
    setAssignments((a) => { const next = { ...a }; for (const k of Object.keys(next)) if (next[Number(k)] === cardId) delete next[Number(k)]; next[seat] = cardId; return next; });
    setSelected(null);
  }, [view, locked, isGhost]);
  const onSeatClick = useCallback((seat: number) => {
    if (!view || view.phase !== 'placement' || locked) return;
    if (!selected) { if (!isGhost && assignments[seat]) setSelected(assignments[seat]); return; }
    placeCardOnSeat(selected, seat);
  }, [view, locked, isGhost, selected, assignments, placeCardOnSeat]);
  const dnd = useCardDrag((cardId, seat) => { if (seat !== null) placeCardOnSeat(cardId, seat); });
  const canDrag = !!view && view.phase === 'placement' && !locked;

  const autoFill = () => {
    if (!view) return;
    const used = new Set(Object.values(assignments));
    const free = view.me.hand.filter((c) => !used.has(c.id));
    const jobs = free.filter((c) => c.key.startsWith('job:')); const others = free.filter((c) => !c.key.startsWith('job:'));
    const queue = [...jobs, ...others];
    const next = { ...assignments };
    for (const s of view.seats) if (!next[s.index]) { const c = queue.shift(); if (c) next[s.index] = c.id; }
    setAssignments(next);
  };

  if (error && !view) return <div className="p-6 text-blood">{error} <Button variant="ghost" onClick={() => nav('/')}>Home</Button></div>;
  if (!view) return <div className="grid h-full place-items-center text-ink-2">Taking your seat…</div>;
  if (meSeat === null) return <div className="p-6">You are not at this table. <Button variant="ghost" onClick={() => nav('/')}>Home</Button></div>;

  const showReveal = view.phase === 'reveal' && !!view.roundLog?.complete;
  const humansAtTable = view.seats.filter((s) => s.userId).length;
  const reckoning = view.roundLog?.events.find((e) => e.t === 'reckoning');
  const myTrade = view.me.trade;
  const readyCount = view.seats.filter((s) => !s.isTownsfolk && s.alive && s.ready).length;
  const needed = view.seats.filter((s) => !s.isTownsfolk && s.alive).length;
  const lockedCount = view.seats.filter((s) => !s.isTownsfolk && s.alive && s.locked).length;

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr_auto] relative overflow-hidden">
      <header className="lg:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 border-b border-night-3 bg-night-2/60">
        <div><Eyebrow>Room {view.code}</Eyebrow><div className="font-display text-lg leading-tight">{view.phase === 'ended' ? 'The year is over' : <>Round {view.round} of {view.calendar.rounds} · <span className="capitalize">{view.season}</span></>}</div></div>
        <div className="text-sm text-ink-2 flex-1 min-w-[200px]">{PHASE_TEXT[view.phase]}</div>
        {secondsLeft !== null && view.phase !== 'ended' && <div className={`font-ui tabular-nums text-xl ${secondsLeft <= 10 ? 'text-blood' : 'text-gold'}`}>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</div>}
        {myTrade && <div className="text-sm">{isGhost ? '👻 You are a ghost' : <>You are the <span className="text-gold font-bold">{TRADE_INFO[myTrade].emoji} {TRADE_INFO[myTrade].name}</span> <span className="text-ink-2">(keep it secret)</span></>}</div>}
        <Button variant="ghost" onClick={() => window.open('/rules', '_blank', 'noopener')} title="Open the rules in a new window">📜 Rules</Button>
        {view.status === 'finished' ? <Button variant="ghost" onClick={() => nav('/')}>Back to the square</Button>
          : humansAtTable <= 1 ? <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm('Cancel this game? It will be removed from your saved tables.')) void act(() => api.cancel(view.id)).then(() => nav('/')); }}>Cancel game</Button>
          : <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm('Leave the table? Your seat plays on as a bot and the game continues without you.')) void act(() => api.leave(view.id)).then(() => nav('/')); }}>Leave game</Button>}
      </header>

      <main className="relative min-h-0 min-w-0 p-2">
        {reckoning && reckoning.t === 'reckoning' && view.phase !== 'reveal' && view.phase !== 'ended' && (
          <div className="absolute top-2 inset-x-2 z-10 mx-auto max-w-2xl bg-blood-deep/90 border border-blood rounded-md px-4 py-2 text-center text-sm shadow-card">
            <span className="font-display text-base">⚖ The Reckoning.</span> {reckoning.seats.map((x) => `${view.seats[x.seat].name} holds the richest trade — ${TRADE_INFO[x.trade].name} (${x.gold} gold)`).join('; ')}. The envelope is open for the final round.
          </div>
        )}
        <Table view={view} assignments={effective} hauntTarget={haunt?.pileSeat ?? null} onSeatClick={onSeatClick} selectable={view.phase === 'placement' && !locked} dropSeat={dnd.hoverSeat} />
        {dnd.drag && createPortal(<div className="fixed z-[95] pointer-events-none" style={{ left: dnd.drag.x - 55, top: dnd.drag.y - 75, transform: 'rotate(-4deg)' }}><CardArt cardKey={(view.me.hand.find((c) => c.id === dnd.drag!.cardId) ?? view.me.gravePool.find((c) => c.id === dnd.drag!.cardId))?.key ?? 'protect'} width={110} /></div>, document.body)}
        {showReveal && view.roundLog && <RevealPlayer log={view.roundLog} view={view} secondsLeft={secondsLeft} busy={busy} onNext={() => void act(() => api.acknowledge(view.id))} onSkip={() => void act(() => api.skip(view.id))} onGold={setGoldAnim} />}
        {view.phase === 'choice' && view.me.choices.length > 0 && <ChoiceModal view={view} busy={busy} onChoose={(cid, t) => void act(() => api.choose(view.id, cid, t))} />}
        {view.phase === 'funeral' && isGhost && !me?.willSealed && view.succession.length > 0 && <FuneralModal view={view} busy={busy} onSeal={(h) => void act(() => api.will(view.id, h))} />}
        {view.phase === 'ended' && <EndScreen view={view} onHome={() => nav('/')} />}
      </main>

      <aside className="hidden lg:flex flex-col gap-4 p-3 border-l border-night-3 bg-night-2/40 min-h-0 row-span-2">
        <GoldBoard view={view} override={showReveal ? goldAnim?.gold ?? null : null} flash={showReveal ? goldAnim?.flash ?? null : null} />
        <Calendar view={view} />
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex gap-1 font-ui text-[11px] tracking-[0.2em] uppercase">
            <button className={`px-2 py-1 rounded-sm ${tab === 'gossip' ? 'bg-night-3 text-gold' : 'text-ink-2'}`} onClick={() => setTab('gossip')}>Gossip</button>
            <button className={`px-2 py-1 rounded-sm ${tab === 'log' ? 'bg-night-3 text-gold' : 'text-ink-2'}`} onClick={() => setTab('log')}>Log</button>
          </div>
          {tab === 'gossip' ? <Chat msgs={chat.msgs} onSend={(t) => void chat.send(t)} status={chat.status} /> : <GameLog view={view} />}
        </div>
      </aside>

      <footer className="min-w-0 border-t border-night-3 bg-night-2/60 px-3 py-2">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          {view.phase === 'gossip' && me?.alive && <Button disabled={busy || me.ready} onClick={() => void act(() => api.ready(view.id))}>{me.ready ? 'Ready ✓' : 'Ready'}</Button>}
          {view.phase === 'gossip' && <span className="text-sm text-ink-2">{readyCount}/{needed} ready</span>}
          {view.phase === 'placement' && !isGhost && me?.alive && (<>
            <Button disabled={busy || locked || !allAssigned} onClick={() => void act(() => api.place(view.id, Object.fromEntries(Object.entries(effective).map(([k, v]) => [String(k), v])), null))}>{locked ? 'Locked in ✓' : 'Lock in'}</Button>
            {!locked && <Button variant="ghost" onClick={autoFill}>Fill the rest with wares</Button>}
            <span className="text-sm text-ink-2">{Object.keys(effective).length}/{view.seatCount} placed · {lockedCount}/{needed} locked</span>
            {selected && <span className="text-sm text-gold">Now click a seat for {def(view.me.hand.find((c) => c.id === selected)!.key).name}</span>}
            {!selected && Object.keys(effective).length === 0 && <span className="text-sm text-ink-2">Drag a card onto a seat, or click a card and then a seat.</span>}
          </>)}
          {view.phase === 'placement' && isGhost && (<>
            <Button disabled={busy || locked || !haunt} onClick={() => void act(() => api.place(view.id, {}, haunt))}>{locked ? 'Haunted ✓' : 'Haunt'}</Button>
            {!locked && <Button variant="ghost" disabled={busy} onClick={() => void act(() => api.place(view.id, {}, null))}>Rest quietly</Button>}
            <span className="text-sm text-moon">{haunt ? `Haunting ${view.seats[haunt.pileSeat].name} with ${def(view.me.gravePool.find((c) => c.id === haunt.cardId)!.key).name}` : 'Pick a card from your grave pool, then a living seat.'}</span>
          </>)}
          {view.phase === 'reveal' && <span className="text-sm text-ink-2">The reveal — scene {Math.min(view.revealStep + 1, view.revealSteps)} of {view.revealSteps}. The table moves on when everyone has clicked Next.</span>}
          {view.phase === 'choice' && <span className="text-sm text-ink-2">{view.me.choices.length ? 'Your choice is needed.' : 'Waiting for a choice…'}</span>}
          {view.phase === 'funeral' && <span className="text-sm text-ink-2">{isGhost && !me?.willSealed ? 'Seal your will.' : 'The dead are sealing their wills…'}</span>}
          {error && <span className="text-sm text-blood ml-auto">{error}</span>}
        </div>
        <Hand view={view} cards={isGhost ? view.me.gravePool : view.me.hand} selected={selected ?? haunt?.cardId ?? null} assignments={effective} onSelect={(cid) => { if (canDrag && !dnd.justDropped()) setSelected((s) => (s === cid ? null : cid)); }} onDragStart={canDrag ? dnd.startDrag : undefined} />
      </footer>
    </div>
  );
}
