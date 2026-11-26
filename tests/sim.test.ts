// Random-play simulation: plays many games end to end and checks invariants.
import { createGame, setReady, submitPlacement, answerChoice, acknowledge, revealSkip, sealWill, tick, handOf, deckOf, gravePoolOf, heirOptions, projectFor, isAttack, convertToBot, poorestWithGold, TRADES, type GameState } from '../web/src/engine/index.ts';
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
    if (st.alive && !st.isTownsfolk && s.phase === 'placement' && !st.locked) {
      const remaining = s.seatCount * (s.calendar.rounds - s.round + 1);
      const hand = handOf(s, st.index).length, deck = deckOf(s, st.index).length;
      if (s.settings.drawMode) { assert(hand === s.seatCount, `drawn hand ${hand} != ${s.seatCount} for seat ${st.index}`, s); assert(hand + deck === remaining, `hand+deck ${hand + deck} != ${remaining} for seat ${st.index}`, s); }
      else assert(hand === remaining && deck === 0, `hand size ${hand} != ${remaining} for seat ${st.index}`, s);
    }
    if (!st.alive) assert(handOf(s, st.index).length === 0 && deckOf(s, st.index).length === 0, 'dead seat holds cards', s);
  }
  // projection leaks
  for (const st of s.seats) {
    if (!st.userId) continue;
    const pv = projectFor(s, st.userId, 1, 0);
    for (const c of pv.me.hand) { const real = s.cards.find((x) => x.id === c.id)!; assert(real.ownerSeat === st.index, 'hand leak', s); }
    const json = JSON.stringify(pv);
    assert(!json.includes('"placedBy"'), 'placedBy leaked', s);
    assert(!json.includes('absentTrades'), 'absentTrades leaked', s);
    for (const v of pv.seats) { assert(!('trade' in v) && !('heir' in v), 'seat secrets leaked', s); if (!v.isMe && v.alive) assert(v.revealedTrade === null || s.phase === 'ended' || s.round === s.calendar.rounds, 'living trade revealed', s); }
    assert(pv.me.trade === st.trade, 'own trade missing', s);
    if (st.alive) assert(pv.me.gravePool.length === 0, 'living player sees a grave pool', s);
  }
}

function playGame(seatCount: number, humans: number, seed: number, verbose = false, drawMode = false): GameState {
  const seats = Array.from({ length: seatCount }, (_, i) => ({ userId: i < humans ? `u${i}` : null, name: i < humans ? `P${i}` : `Townsfolk ${i}`, crest: `c${i}`, isTownsfolk: i >= humans }));
  const s = createGame({ id: `g${seed}`, code: `C${seed}`, hostUserId: 'u0', seats, seed, now: 0, settings: { drawMode } });
  assert(s.calendar.rounds === 5, 'every year is five rounds', s);
  for (const st of s.seats) { const h = [...handOf(s, st.index), ...deckOf(s, st.index)]; assert(h.filter((c) => c.key.startsWith('mishap:')).length === 3 && h.filter((c) => c.key.startsWith('calamity:')).length === 1 && h.filter((c) => c.key === `alms:${st.trade}`).length === 1 && h.filter((c) => c.key === 'tax-collector').length === 1, 'kit is not 3 mishaps + 1 calamity + 1 alms + 1 tax collector', s); }
  const r = { rng: seed ^ 0x9e3779b9 };
  let now = 1000; let guard = 0;
  while (s.phase !== 'ended') {
    assert(guard++ < 5000, 'game did not terminate', s);
    now += 1000;
    checkInvariants(s);
    // now and then a player walks away mid-game (never u0, so the game keeps a human)
    if (randInt(r, 40) === 0) { const c = s.seats.filter((x) => x.userId && x.userId !== 'u0'); if (c.length) convertToBot(s, pick(r, c).index, now); }
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
      for (const st of s.seats) if (!st.isTownsfolk && s.phase === 'reveal' && !st.ack) { if (randInt(r, 6) === 0) revealSkip(s, st.index, now); else if (randInt(r, 8) === 0) tick(s, s.phaseDeadline! + 1); else acknowledge(s, st.index, now); }
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
const sizes = [[4, 3], [4, 4], [5, 5], [6, 6], [8, 8], [7, 5], [8, 4], [4, 3], [5, 5]];
for (let n = 0; n < 60; n++) {
  const [seatCount, humans] = sizes[n % sizes.length];
  const s = playGame(seatCount, humans, seedFrom(`sim-${n}`), n < 3, n % 2 === 1);   // odd games draw from the deck (standard), even games play the Open Envelope variant
  games++; seatsTotal += seatCount; deaths += s.seats.filter((x) => !x.alive).length; if (!s.winners?.length) noWinner++;
  for (const l of s.logs) for (const e of l.events) { if (e.t === 'void') attacksVoided++; if (e.t === 'reveal') attacksPlayed += e.cards.filter((c) => isAttack(c.key)).length; }
}
// last one standing: a round that begins with a single villager alive ends the year at once, and the survivor wins
{
  const seats = Array.from({ length: 5 }, (_, i) => ({ userId: i < 4 ? `u${i}` : null, name: `P${i}`, crest: `c${i}`, isTownsfolk: i === 4 }));
  const s = createGame({ id: 'solo', code: 'SOLO', hostUserId: 'u0', seats, seed: 7, now: 0 });
  for (const st of s.seats) if (st.index !== 0) { st.alive = false; st.diedRound = 1; st.revealedTrade = st.trade; st.willSealed = true; }
  s.seats[1].heir = 0; s.succession = s.succession.filter((i) => i !== 0);
  assert(s.phase === 'placement', 'expected placement', s);
  assert(tick(s, 1000), 'tick should end the year for a lone survivor', s);
  assert(s.phase === 'ended' && s.status === 'finished', 'lone survivor did not end the year', s);
  assert(JSON.stringify(s.winners) === '[0]', 'lone survivor should win: ' + JSON.stringify(s.winners), s);
  assert(s.sharedBy.includes(1), 'the ghost whose will named the survivor should share the win', s);
  assert(s.scoreRows?.length === 1, 'only the survivor is scored', s);
}
// Gleaning: only tracks holding gold qualify, ties are all offered, and an empty board offers nobody
{
  const seats = Array.from({ length: 5 }, (_, i) => ({ userId: `u${i}`, name: `P${i}`, crest: `c${i}`, isTownsfolk: false }));
  const s = createGame({ id: 'glean', code: 'GLEAN0', hostUserId: 'u0', seats, seed: 3, now: 0 });
  assert(poorestWithGold(s).length === 0, 'an empty board should offer no Gleaning target', s);
  s.gold.farmer = 3; s.gold.thief = 1; s.gold.jeweler = 1;
  assert(JSON.stringify(poorestWithGold(s)) === JSON.stringify(['thief', 'jeweler']), 'tied poorest tracks with gold: ' + JSON.stringify(poorestWithGold(s)), s);
  s.gold.thief = 2;
  assert(JSON.stringify(poorestWithGold(s)) === JSON.stringify(['jeweler']), 'single poorest track with gold', s);
}
// Drawing from the deck is the standard game: a hand of one card per seat, and the whole envelope is played by the year's end
{
  const seats = Array.from({ length: 5 }, (_, i) => ({ userId: `u${i}`, name: `P${i}`, crest: `c${i}`, isTownsfolk: false }));
  const s = createGame({ id: 'ale', code: 'ALE000', hostUserId: 'u0', seats, seed: 11, now: 0 });
  assert(s.settings.drawMode === true, 'drawing from the deck should be the default', s);
  for (const st of s.seats) assert(handOf(s, st.index).length === 5 && deckOf(s, st.index).length === 20, `seat ${st.index} should hold 5 and keep 20 in the deck`, s);
  // Strong Ale: this round's hand is already on the table, so the drunk draws next round's hand early and shows it
  for (const st of s.seats) for (const c of handOf(s, st.index)) c.key = `job:${st.trade}`;   // a quiet round: wares only
  const ale = handOf(s, 0)[0]; ale.key = 'sig:strong-ale';
  for (const st of s.seats) {
    const hand = handOf(s, st.index).slice(); const pl: Record<string, string> = {};
    if (st.index === 0) { pl['1'] = ale.id; const rest = hand.filter((c) => c.id !== ale.id); for (const p of [0, 2, 3, 4]) pl[String(p)] = rest.pop()!.id; }
    else for (let p = 0; p < 5; p++) pl[String(p)] = hand[p].id;
    submitPlacement(s, st.index, pl, null, 1000);
  }
  assert(s.phase === 'reveal', 'expected the reveal after every seat locked in, got ' + s.phase, s);
  const shown = s.roundLog!.events.find((e) => e.t === 'reveal_hand');
  assert(shown && shown.t === 'reveal_hand' && shown.seat === 1 && shown.cards.length === 5, 'the drunk should show a freshly drawn hand of 5', s);
  const drunkHand = handOf(s, 1).map((c) => c.id).sort().join(',');
  assert(handOf(s, 1).length === 5 && deckOf(s, 1).length === 15, 'the drunk drew early: 5 in hand, 15 in the deck', s);
  for (const i of [0, 2, 3, 4]) assert(handOf(s, i).length === 0 && deckOf(s, i).length === 20, `seat ${i} should not have drawn yet`, s);
  let guard = 0;
  while (s.phase === 'reveal') { assert(guard++ < 200, 'reveal did not finish', s); for (const st of s.seats) if (s.phase === 'reveal' && !st.ack) acknowledge(s, st.index, 2000); }
  assert(s.phase === 'placement' && s.round === 2, 'expected round 2 placement, got ' + s.phase + ' round ' + s.round, s);
  assert(handOf(s, 1).map((c) => c.id).sort().join(',') === drunkHand, 'the drunk plays exactly the hand everyone saw', s);
  for (const st of s.seats) assert(handOf(s, st.index).length === 5 && deckOf(s, st.index).length === 15, `round 2: seat ${st.index} should hold 5 and keep 15`, s);
}
// determinism
const a = JSON.stringify(playGame(5, 5, 4242)); const b = JSON.stringify(playGame(5, 5, 4242));
assert(a === b, 'engine is not deterministic');
const da = JSON.stringify(playGame(6, 5, 4243, false, true)); const db = JSON.stringify(playGame(6, 5, 4243, false, true));
assert(da === db, 'engine is not deterministic in draw mode');
console.log(`OK: ${games} games, ${(deaths / games).toFixed(2)} deaths/game, ${(deaths / seatsTotal * 100).toFixed(0)}% of seats died, ${noWinner} games with nobody winning, ${attacksVoided} voids / ${attacksPlayed} attacks revealed, ${Date.now() - t0} ms`);
