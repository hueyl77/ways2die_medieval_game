// Balance harness: plays many games with simple policies and reports per-trade and per-card statistics.
// Usage: node scripts/balance.ts [games=100] [seats=5] [policy=random|sensible|both]
import { createGame, submitPlacement, answerChoice, acknowledge, sealWill, tick, handOf, gravePoolOf, heirOptions, isAttack, ACTIVE_TRADES as TRADES, TRADE_INFO, CARDS, type GameState } from '../web/src/engine/index.ts';
import { seedFrom, randInt, pick } from '../web/src/engine/rng.ts';
import type { Trade } from '../web/src/engine/cards.ts';

type Policy = 'random' | 'sensible' | 'measured';
const GAMES = Number(process.argv[2] ?? 100); const SEATS = Number(process.argv[3] ?? 5); const POLICY = (process.argv[4] ?? 'all') as Policy | 'all';
const DEATH_AT = process.argv[5] && process.argv[5] !== '0' ? Number(process.argv[5]) : null;   // what-if override of the death threshold
const KIT3 = process.argv[6] === 'kit3';   // what-if: 3 Mishaps + 1 Calamity (one mishap becomes a wares card)

function place(s: GameState, seat: number, policy: Policy, r: { rng: number }, now: number) {
  const hand = handOf(s, seat).slice();
  const placements: Record<string, string> = {};
  const take = (pred: (k: string) => boolean) => { const i = hand.findIndex((c) => pred(c.key)); return i >= 0 ? hand.splice(i, 1)[0] : null; };
  const others = s.seats.filter((x) => x.index !== seat && x.alive).map((x) => x.index);
  if (policy === 'random') {
    for (let p = 0; p < s.seatCount; p++) { const i = randInt(r, hand.length); placements[String(p)] = hand[i].id; hand.splice(i, 1); }
  } else if (policy === 'measured') {
    // one attack a round on a random living rival (heavy ones later), defence at home when wounded, wares everywhere else
    const wounded = s.cards.some((c) => c.zone === 'wound' && c.pileSeat === seat) || s.seats[seat].woundTokens > 0;
    const lastRounds = s.round >= s.calendar.rounds - 1;
    const own = (wounded && take((k) => k === 'heal' || k === 'sig:hearty-stew' || k === 'sig:panacea')) || (wounded && take((k) => k === 'protect' || k === 'sig:palisade')) || (lastRounds && take((k) => k === 'protect' || k === 'sig:palisade')) || take((k) => k.startsWith('job:') || k.startsWith('alms:')) || hand.splice(0, 1)[0];
    placements[String(seat)] = own.id;
    const victim = others.length ? pick(r, others) : null;
    let sigPlayed = false;   // one signature card a round, on a random living seat, from round 2 on (real players use their specials)
    const sigSeat = s.round >= 2 && others.length ? pick(r, others) : null;
    for (let p = 0; p < s.seatCount; p++) {
      if (p === seat) continue;
      let c = null as ReturnType<typeof take>;
      if (p === victim) c = take((k) => (lastRounds ? isAttack(k) : (isAttack(k) && (CARDS[k]?.wounds ?? 1) === 1))) || take((k) => k === 'tax-collector');
      if (!c && p === sigSeat && !sigPlayed && !lastRounds) { c = take((k) => k.startsWith('sig:') && !isAttack(k) && k !== 'sig:sunday-best'); if (c) sigPlayed = true; }
      if (!c) c = take((k) => k.startsWith('job:') || k.startsWith('alms:')) || take((k) => k.startsWith('sig:') && !isAttack(k)) || take((k) => k === 'tax-collector');
      if (!c) c = hand.splice(randInt(r, hand.length), 1)[0];
      placements[String(p)] = c.id;
    }
  } else {
    // own pile: Protect if any attacks are likely (always), else Heal when wounded, else wares
    const wounded = s.cards.some((c) => c.zone === 'wound' && c.pileSeat === seat) || s.seats[seat].woundTokens > 0;
    const own = (wounded && take((k) => k === 'heal' || k === 'sig:hearty-stew' || k === 'sig:panacea')) || take((k) => k === 'protect' || k === 'sig:palisade') || take((k) => k.startsWith('job:')) || hand.splice(0, 1)[0];
    placements[String(seat)] = own.id;
    // attacks and nasty pendings go to random living others; alms/tax at random; never attack yourself
    for (let p = 0; p < s.seatCount; p++) {
      if (p === seat) continue;
      const alive = s.seats[p].alive;
      let c = null as ReturnType<typeof take>;
      if (alive && others.length) c = take((k) => isAttack(k) || k === 'sig:slow-poison' || k === 'sig:grindstone' || k === 'sig:rotten-beam' || k === 'sig:bad-batch' || k === 'tax-collector');
      if (!c) c = take((k) => k.startsWith('job:') || k.startsWith('alms:') || k.startsWith('sig:'));
      if (!c) c = hand.splice(randInt(r, hand.length), 1)[0];
      placements[String(p)] = c.id;
    }
  }
  submitPlacement(s, seat, placements, null, now);
}

interface Stats { games: number; wins: Record<string, number>; plays: Record<string, number>; finalGold: Record<string, number[]>; deaths: Record<string, number>; deathsPerGame: number[]; deathRound: number[]; winnerMargin: number[]; noWinner: number; sharedWins: number; ghostWins: number; cardGold: Record<string, number>; cardCount: Record<string, number>; almsGranted: number; almsPlayed: number; taxCards: number; taxPlayed: number; voidsBy: Record<string, number>; woundsBy: Record<string, number>; }
const zero = () => Object.fromEntries(TRADES.map((t) => [t, 0])) as Record<string, number>;
const stats = (): Stats => ({ games: 0, wins: zero(), plays: zero(), finalGold: Object.fromEntries(TRADES.map((t) => [t, []])), deaths: zero(), deathsPerGame: [], deathRound: [], winnerMargin: [], noWinner: 0, sharedWins: 0, ghostWins: 0, cardGold: {}, cardCount: {}, almsGranted: 0, almsPlayed: 0, taxCards: 0, taxPlayed: 0, voidsBy: {}, woundsBy: {} });

function play(policy: Policy, seed: number, st: Stats) {
  const seats = Array.from({ length: SEATS }, (_, i) => ({ userId: `u${i}`, name: `P${i}`, crest: `c${i}`, isTownsfolk: false }));
  const s = createGame({ id: `g${seed}`, code: `C${seed}`, hostUserId: 'u0', seats, seed, now: 0 });
  if (DEATH_AT) s.calendar.deathAt = DEATH_AT;
  if (KIT3) for (const x of s.seats) { const m = handOf(s, x.index).find((c) => c.key.startsWith('mishap:')); if (m) m.key = `job:${x.trade}`; }
  const r = { rng: seed ^ 0x51ed270b }; let now = 1000; let guard = 0;
  for (const x of s.seats) st.plays[x.trade]++;
  while (s.phase !== 'ended' && guard++ < 5000) {
    now += 1000;
    if (s.phase === 'placement') {
      for (const x of s.seats) { if (x.locked || s.phase !== 'placement') continue; if (x.alive) place(s, x.index, policy, r, now); else { const pool = gravePoolOf(s, x.index); const living = s.seats.filter((y) => y.alive); submitPlacement(s, x.index, {}, pool.length && living.length ? { cardId: pick(r, pool).id, pileSeat: pick(r, living).index } : null, now); } }
    } else if (s.phase === 'choice') { for (const ch of [...s.choices]) if (!ch.answer && s.phase === 'choice') answerChoice(s, ch.seat, ch.id, ch.cardKey === 'sig:iron-strongbox' ? (s.seats[ch.seat].trade as Trade) : pick(r, ch.options) as Trade, now); }
    else if (s.phase === 'reveal') { for (const x of s.seats) if (s.phase === 'reveal' && !x.ack) acknowledge(s, x.index, now); }
    else if (s.phase === 'funeral') { for (const x of s.seats) if (!x.alive && !x.willSealed && s.phase === 'funeral') { const o = heirOptions(s, x.index); if (o.length) sealWill(s, x.index, pick(r, o), now); } if (s.phase === 'funeral') tick(s, s.phaseDeadline! + 1); }
    else tick(s, (s.phaseDeadline ?? now) + 1);
  }
  st.games++;
  const rows = s.scoreRows ?? [];
  for (const row of rows) st.finalGold[row.trade].push(row.total);
  for (const x of s.seats) if (!x.alive) { st.deaths[x.trade]++; st.deathRound.push(x.diedRound!); }
  st.deathsPerGame.push(s.seats.filter((x) => !x.alive).length);
  if (!s.winners?.length) st.noWinner++; else { for (const w of s.winners) st.wins[s.seats[w].trade]++; if (s.winners.length > 1) st.sharedWins++; const sorted = rows.map((x) => x.total).sort((a, b) => b - a); st.winnerMargin.push(sorted.length > 1 ? sorted[0] - sorted[1] : sorted[0] ?? 0); }
  if (s.sharedBy?.length) st.ghostWins++;
  for (const l of s.logs) for (const e of l.events) {
    if (e.t === 'gold' && !e.by.startsWith('job:') && e.delta) { st.cardGold[e.by] = (st.cardGold[e.by] ?? 0) + e.delta; st.cardCount[e.by] = (st.cardCount[e.by] ?? 0) + 1; }
    if (e.t === 'alms') { st.almsPlayed++; if (e.granted) st.almsGranted++; }
    if (e.t === 'tax') { st.taxPlayed++; st.taxCards += e.cards; }
    if (e.t === 'void') st.voidsBy[e.by] = (st.voidsBy[e.by] ?? 0) + 1;
    if (e.t === 'wound') st.woundsBy[e.cardKey] = (st.woundsBy[e.cardKey] ?? 0) + e.amount;
  }
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
function report(policy: Policy, st: Stats) {
  console.log(`\n=== ${policy.toUpperCase()} play · ${st.games} games · ${SEATS} seats${DEATH_AT ? ` · death at ${DEATH_AT} (what-if)` : ''}${KIT3 ? ' · kit 3+1 (what-if)' : ''} ===`);
  console.log(`deaths/game ${mean(st.deathsPerGame).toFixed(2)} · mean death round ${mean(st.deathRound).toFixed(1)} · no winner ${st.noWinner} · shared wins ${st.sharedWins} · ghost shares ${st.ghostWins} · winner margin ${mean(st.winnerMargin).toFixed(1)} gold`);
  console.log(`Alms granted ${st.almsGranted}/${st.almsPlayed} (${(100 * st.almsGranted / Math.max(1, st.almsPlayed)).toFixed(0)}%) · Tax Collector seized ${(st.taxCards / Math.max(1, st.taxPlayed)).toFixed(1)} cards per play`);
  console.log('\ntrade         seated  wins  win%/seat  survive%  avg final gold');
  for (const t of [...TRADES].sort((a, b) => (st.wins[b] / Math.max(1, st.plays[b])) - (st.wins[a] / Math.max(1, st.plays[a])))) {
    const seated = st.plays[t]; const winPct = (100 * st.wins[t] / Math.max(1, seated)).toFixed(0); const surv = (100 * (1 - st.deaths[t] / Math.max(1, seated))).toFixed(0);
    console.log(`${TRADE_INFO[t].name.padEnd(13)} ${String(seated).padStart(6)} ${String(st.wins[t]).padStart(5)} ${winPct.padStart(9)}% ${surv.padStart(8)}% ${mean(st.finalGold[t]).toFixed(1).padStart(14)}`);
  }
  console.log('\ncard gold effects (total gold moved / plays):');
  const keys = Object.keys(st.cardGold).sort((a, b) => Math.abs(st.cardGold[b]) - Math.abs(st.cardGold[a]));
  for (const k of keys) console.log(`  ${(CARDS[k]?.name ?? k).padEnd(22)} ${String(st.cardGold[k]).padStart(6)} / ${st.cardCount[k]}  (${(st.cardGold[k] / st.cardCount[k]).toFixed(1)} per)`);
  const w = Object.entries(st.woundsBy).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('\ntop wound sources:', w.map(([k, n]) => `${CARDS[k]?.name ?? k} ${n}`).join(' · '));
  const v = Object.entries(st.voidsBy).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('top voids:', v.map(([k, n]) => `${CARDS[k]?.name ?? k} ${n}`).join(' · '));
}

for (const policy of (POLICY === 'all' ? ['random', 'measured', 'sensible'] : [POLICY]) as Policy[]) {
  const st = stats();
  for (let n = 0; n < GAMES; n++) play(policy, seedFrom(`${policy}-${SEATS}-${n}`), st);
  report(policy, st);
}
