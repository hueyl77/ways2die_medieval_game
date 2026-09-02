import type { GameState, PlayerView, SeatView, CardView, Seat } from './types.ts';
import { handOf, gravePoolOf, woundsOf, pileCount, heirOptions, seasonOf, revealWaitingOn } from './engine.ts';

const view = (c: { id: string; key: string; meta: Record<string, number | string | boolean | null> }): CardView => ({ id: c.id, key: c.key, meta: { ...c.meta } });

export function projectFor(s: GameState, userId: string | null, version: number, now: number): PlayerView {
  const me: Seat | undefined = userId ? s.seats.find((x) => x.userId === userId) : undefined;
  const seats: SeatView[] = s.seats.map((st) => ({
    index: st.index, userId: st.userId, name: st.name, crest: st.crest, isTownsfolk: st.isTownsfolk, alive: st.alive,
    wounds: woundsOf(s, st.index),
    woundCards: s.cards.filter((c) => c.zone === 'wound' && c.pileSeat === st.index).map(view),
    woundTokens: st.woundTokens, diedRound: st.diedRound, revealedTrade: st.revealedTrade,
    locked: st.locked, ready: st.ready, ack: st.ack, skipReveal: st.skipReveal ?? false,
    scoringCards: s.cards.filter((c) => c.zone === 'scoring' && c.pileSeat === st.index).map(view),
    pendingCards: s.cards.filter((c) => c.zone === 'pending' && c.pileSeat === st.index).map(view),
    pileCount: pileCount(s, st.index), gravePoolCount: gravePoolOf(s, st.index).length,
    handCount: handOf(s, st.index).length, willSealed: st.willSealed, isMe: !!me && me.index === st.index,
  }));
  const isGhost = !!me && !me.alive && !me.isTownsfolk;
  return {
    id: s.id, code: s.code, hostUserId: s.hostUserId, status: s.status, settings: s.settings, seatCount: s.seatCount,
    calendar: s.calendar, round: s.round, season: s.status === 'playing' ? seasonOf(s) : null, phase: s.phase,
    phaseDeadline: s.phaseDeadline, crierSeat: s.crierSeat, version,
    revealStep: s.revealStep ?? 0, revealSteps: s.revealSteps ?? 0, revealWaitingOn: s.phase === 'reveal' ? revealWaitingOn(s) : [],
    seats, gold: { ...s.gold },
    lockedTrades: [...s.lockedTrades], shieldedTrades: [...s.shieldedTrades],
    succession: isGhost && !me!.willSealed ? heirOptions(s, me!.index) : [],
    roundLog: s.roundLog, logs: s.logs, winners: s.winners, sharedBy: s.sharedBy, scoreRows: s.scoreRows,
    me: {
      seat: me ? me.index : null, trade: me ? me.trade : null,
      hand: me ? handOf(s, me.index).map(view) : [],
      placements: me ? { ...(s.placementsThisRound[me.index] ?? {}) } : {},
      heir: me ? me.heir : null,
      gravePool: isGhost ? gravePoolOf(s, me!.index).map(view) : [],
      choices: me ? s.choices.filter((c) => c.seat === me.index && !c.answer) : [],
      isGhost, hauntUsed: isGhost ? me!.locked : false,
    },
    serverNow: now,
  };
}
