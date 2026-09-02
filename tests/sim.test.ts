// Random-play simulation: plays many games end to end and checks invariants.
import { createGame, setReady, submitPlacement, answerChoice, acknowledge, sealWill, tick, handOf, gravePoolOf, heirOptions, projectFor, isAttack, TRADES, type GameState } from '../web/src/engine/index.ts';
import { seedFrom, randInt, pick } from '../web/src/engine/rng.ts';
import type { Trade } from '../web/src/engine/cards.ts';

function assert(cond: unknown, msg: string, s?: GameState) {
  if (!cond) { console.error('ASSERTION FAILED:', msg, s ? `(game ${s.code} round ${s.round} phase ${s.phase})` : ''); process.exit(1); }
}

function checkInvariants(s: GameState) {
  const ids = new Set<string>();
  for (const c of s.cards) { assert(!ids.has(c.id), 'duplicate card id ' + c.id, s); ids.add(c.id); }
  for (const t of TRADES) assert(s.gold[t] >= 0, 'negative gold ' + t, s);
  for (const st of s.seats) {
    assert(st.woundTokens >= 0, 'negative tokens', s);
    if (st.alive && !st.isTownsfolk && s.phase === 'gossip') {
      const expected = s.seatCount * (s.calendar.rounds - s.round + 1);
      assert(handOf(s, st.index).length === expected, `hand size ${handOf(s, st.index).length} != ${expected} for seat ${st.index}`, s);
    }
    if (!st.alive) assert(handOf(s, st.index).length === 0, 'dead seat holds cards', s);
  }
  // projection leaks
  for (const st of s.seats) {
    if (!st.userId) continue;
    const pv = projectFor(s, st.userId, 1, 0);
    for (const c of pv.me.hand) { const real = s.cards.find((x) => x.id === c.id)!; assert(real.ownerSeat === st.index, 'hand leak', s); }
    const json = JSON.stringify(pv);
    assert(!json.includes('"placedBy"'), 'placedBy leaked', s);
    assert(!json.includes('absentTrades'), 'absentTrades leaked', s);
    for (const v of pv.seats) { assert(!('trade' in v) && !('heir' in v), 'seat secrets leaked', s); if (!v.isMe && v.alive) assert(v.revealedTrade === null || s.phase === 'ended', 'living trade revealed', s); }
    assert(pv.me.trade === st.trade, 'own trade missing', s);
    if (st.alive) assert(pv.me.gravePool.length === 0, 'living player sees a grave pool', s);
  }
}

function playGame(seatCount: number, humans: number, seed: number, verbose = false): GameState {
  const seats = Array.from({ length: seatCount }, (_, i) => ({ userId: i < humans ? `u${i}` : null, name: i < humans ? `P${i}` : `Townsfolk ${i}`, crest: `c${i}`, isTownsfolk: i >= humans }));
  const s = createGame({ id: `g${seed}`, code: `C${seed}`, hostUserId: 'u0', seats, seed, now: 0 });
  const r = { rng: seed ^ 0x9e3779b9 };
  let now = 1000; let guard = 0;
  while (s.phase !== 'ended') {
    assert(guard++ < 5000, 'game did not terminate', s);
    now += 1000;
    checkInvariants(s);
    if (s.phase === 'gossip') {
      for (const st of s.seats) if (st.alive && !st.isTownsfolk && s.phase === 'gossip') setReady(s, st.index, now);
    } else if (s.phase === 'placement') {
      for (const st of s.seats) {
        if (st.isTownsfolk || st.locked || s.phase !== 'placement') continue;
        if (st.alive) {
          if (randInt(r, 10) === 0) continue; // AFK sometimes → auto-place
          const hand = handOf(s, st.index).slice();
          const placements: Record<string, string> = {};
          for (let p = 0; p < s.seatCount; p++) { const i = randInt(r, hand.length); placements[String(p)] = hand[i].id; hand.splice(i, 1); }
          submitPlacement(s, st.index, placements, null, now);
        } else {
          const pool = gravePoolOf(s, st.index);
          const living = s.seats.filter((x) => x.alive);
          const haunt = pool.length && living.length && randInt(r, 3) ? { cardId: pick(r, pool).id, pileSeat: pick(r, living).index } : null;
          submitPlacement(s, st.index, {}, haunt, now);
        }
      }
      if (s.phase === 'placement') tick(s, s.phaseDeadline! + 1);
    } else if (s.phase === 'choice') {
      for (const ch of [...s.choices]) if (!ch.answer && s.phase === 'choice') answerChoice(s, ch.seat, ch.id, pick(r, ch.options) as Trade, now);
    } else if (s.phase === 'reveal') {
      for (const st of s.seats) if (!st.isTownsfolk && s.phase === 'reveal') acknowledge(s, st.index, now);
    } else if (s.phase === 'funeral') {
      for (const st of s.seats) if (!st.alive && !st.isTownsfolk && !st.willSealed && s.phase === 'funeral') { const opts = heirOptions(s, st.index); if (opts.length && randInt(r, 4)) sealWill(s, st.index, pick(r, opts), now); }
      if (s.phase === 'funeral') tick(s, s.phaseDeadline! + 1);
    }
  }
  checkInvariants(s);
  assert(s.scoreRows, 'no score rows', s);
  if (verbose) console.log(s.code, 'rounds', s.calendar.rounds, 'deaths', s.seats.filter((x) => !x.alive).length, 'winners', s.winners, 'shared', s.sharedBy, 'gold', s.gold);
  return s;
}

const t0 = Date.now();
let games = 0, deaths = 0, seatsTotal = 0, noWinner = 0, attacksVoided = 0, attacksPlayed = 0;
const sizes = [[4, 3], [4, 4], [5, 5], [6, 6], [8, 8], [9, 9], [12, 12], [4, 3], [5, 5]];
for (let n = 0; n < 60; n++) {
  const [seatCount, humans] = sizes[n % sizes.length];
  const s = playGame(seatCount, humans, seedFrom(`sim-${n}`), n < 3);
  games++; seatsTotal += seatCount; deaths += s.seats.filter((x) => !x.alive).length; if (!s.winners?.length) noWinner++;
  for (const l of s.logs) for (const e of l.events) { if (e.t === 'void') attacksVoided++; if (e.t === 'reveal') attacksPlayed += e.cards.filter((c) => isAttack(c.key)).length; }
}
// determinism
const a = JSON.stringify(playGame(5, 5, 4242)); const b = JSON.stringify(playGame(5, 5, 4242));
assert(a === b, 'engine is not deterministic');
console.log(`OK: ${games} games, ${(deaths / games).toFixed(2)} deaths/game, ${(deaths / seatsTotal * 100).toFixed(0)}% of seats died, ${noWinner} games with nobody winning, ${attacksVoided} voids / ${attacksPlayed} attacks revealed, ${Date.now() - t0} ms`);
