import { CARDS, TRADES, def, isAttack, isJob, isHeal, MISHAP_KEYS, CALAMITY_KEYS, signatureKeys, type Trade } from './cards.ts';
import { randInt, shuffle, pick } from './rng.ts';
import { sceneCount } from './scenes.ts';
import type { GameState, Seat, CardInst, Settings, Calendar, Season, LogEvent, ScoreRow } from './types.ts';

export const DEFAULT_SETTINGS: Settings = {
  gossipSeconds: 120, placementSeconds: 150, choiceSeconds: 30, revealSeconds: 45, revealStepSeconds: 20,
  funeralSeconds: 60, extraTownsfolk: 0, tableSize: 4, seasonRules: false, leaderRules: false, revealPlacementsAtEnd: false,
};
/** Season rules are an optional variant; off, every round plays the same and the seasons are just names on the calendar. */
const seasonal = (s: GameState) => !!s.settings.seasonRules;
const stepMs = (s: GameState) => (s.settings.revealStepSeconds ?? 20) * 1000;

export class RuleError extends Error {
  code: string;
  constructor(code: string, message?: string) { super(message ?? code); this.code = code; }
}

export function calendarFor(seatCount: number): Calendar {
  let rounds: number; let seasons: Season[]; let deathAt: number;
  if (seatCount <= 5) { rounds = 6; seasons = ['spring', 'spring', 'harvest', 'harvest', 'winter', 'winter']; deathAt = 3; }
  else { rounds = 4; seasons = ['harvest', 'harvest', 'winter', 'winter']; deathAt = 4; }   // 6–8 seats
  // fixed cards per envelope: 4 Mishaps + 1 Calamity + 2 Heals + 1 Protect + 1 Alms + 1 Tax Collector + 3 signatures = 13
  return { rounds, seasons, jobsKept: seatCount * rounds - 13, deathAt };
}

export interface SeatSpec { userId: string | null; name: string; crest: string; isTownsfolk: boolean }

// ---------------------------------------------------------------- helpers
export const seasonOf = (s: GameState): Season => s.calendar.seasons[s.round - 1];
export const seatById = (s: GameState, i: number): Seat => s.seats[i];
export const isHuman = (seat: Seat): boolean => !seat.isTownsfolk;
export const livingHumans = (s: GameState): Seat[] => s.seats.filter((x) => x.alive && isHuman(x));
export const deadHumans = (s: GameState): Seat[] => s.seats.filter((x) => !x.alive && isHuman(x));
export const handOf = (s: GameState, seat: number): CardInst[] => s.cards.filter((c) => c.zone === 'hand' && c.ownerSeat === seat);
export const gravePoolOf = (s: GameState, seat: number): CardInst[] => s.cards.filter((c) => c.zone === 'grave_pool' && c.pileSeat === seat);
export const woundsOf = (s: GameState, seat: number): number =>
  s.cards.filter((c) => c.zone === 'wound' && c.pileSeat === seat).length + s.seats[seat].woundTokens;
export const cardById = (s: GameState, id: string): CardInst | undefined => s.cards.find((c) => c.id === id);
export function seatOfUser(s: GameState, userId: string): Seat | undefined { return s.seats.find((x) => x.userId === userId); }
const unlocked = (s: GameState, t: Trade): boolean => !s.lockedTrades.includes(t);
function log(s: GameState, e: LogEvent) { s.roundLog!.events.push(e); }

function newCard(s: GameState, key: string, ownerSeat: number, zone: CardInst['zone'] = 'hand', pileSeat: number | null = null): CardInst {
  const c: CardInst = { id: `c${s.nextCardId++}`, key, ownerSeat, zone, pileSeat, placedBy: null, roundPlaced: null, meta: {} };
  s.cards.push(c);
  return c;
}

// ---------------------------------------------------------------- setup
export function createGame(o: { id: string; code: string; hostUserId: string; seats: SeatSpec[]; settings?: Partial<Settings>; seed: number; now: number }): GameState {
  const settings = { ...DEFAULT_SETTINGS, ...(o.settings ?? {}) };
  const seatCount = o.seats.length;
  if (seatCount < 4 || seatCount > 8) throw new RuleError('bad_seat_count');
  const calendar = calendarFor(seatCount);
  const s: GameState = {
    id: o.id, code: o.code, hostUserId: o.hostUserId, status: 'playing', seed: o.seed, rng: o.seed >>> 0,
    settings, seatCount, calendar, round: 1, phase: 'placement', phaseDeadline: o.now + settings.placementSeconds * 1000,
    crierSeat: 0, revealStep: 0, revealSteps: 0, seats: [], cards: [], gold: Object.fromEntries(TRADES.map((t) => [t, 0])),
    lockedTrades: [], shieldedTrades: [], absentTrades: [], succession: [], choices: [], taxedPiles: [], roundLog: null, logs: [],
    nextCardId: 1, winners: null, sharedBy: null, scoreRows: null, placementsThisRound: {},
  };
  const trades = shuffle(s, [...TRADES]);
  o.seats.forEach((spec, i) => {
    s.seats.push({
      index: i, userId: spec.userId, name: spec.name, crest: spec.crest, isTownsfolk: spec.isTownsfolk, alive: true,
      woundTokens: 0, diedRound: null, revealedTrade: null, locked: false, ready: false, ack: false, skipReveal: false, afkRounds: 0,
      attacksPlaced: 0, trade: trades[i], heir: null, willSealed: false,
    });
  });
  s.absentTrades = trades.slice(seatCount);
  s.crierSeat = randInt(s, seatCount);
  const mishaps = shuffle(s, [...MISHAP_KEYS, ...MISHAP_KEYS]);   // two copies of each of the 24 mishaps
  const calamities = shuffle(s, [...CALAMITY_KEYS]);
  for (const seat of s.seats) {
    const jobs = seat.isTownsfolk ? 27 : calendar.jobsKept;
    for (let j = 0; j < jobs; j++) newCard(s, `job:${seat.trade}`, seat.index);
    newCard(s, 'heal', seat.index); newCard(s, 'heal', seat.index); newCard(s, 'protect', seat.index); newCard(s, `alms:${seat.trade}`, seat.index); newCard(s, 'tax-collector', seat.index);
    for (const k of signatureKeys(seat.trade)) newCard(s, k, seat.index);
    for (let m = 0; m < 4; m++) newCard(s, mishaps.pop()!, seat.index);
    newCard(s, calamities.pop()!, seat.index);
    if (isHuman(seat)) s.succession.push(seat.index);
  }
  s.roundLog = { round: 1, events: [{ t: 'round_start', round: 1, season: seasonOf(s) }], complete: false };
  return s;
}

// ---------------------------------------------------------------- lobby → gossip → placement
export function setReady(s: GameState, seat: number, now: number): void {
  if (s.phase !== 'gossip') throw new RuleError('wrong_phase');
  const st = s.seats[seat];
  if (!st.alive) throw new RuleError('dead');
  st.ready = true;
  if (livingHumans(s).every((x) => x.ready)) startPlacement(s, now);
}

export function startPlacement(s: GameState, now: number): void {
  s.phase = 'placement';
  s.phaseDeadline = now + s.settings.placementSeconds * 1000;
  for (const st of s.seats) { st.locked = false; st.ready = false; }
  s.placementsThisRound = {};
}

export function submitPlacement(s: GameState, seat: number, placements: Record<string, string>, haunt: { cardId: string; pileSeat: number } | null, now: number): void {
  if (s.phase !== 'placement') throw new RuleError('wrong_phase');
  const st = s.seats[seat];
  if (st.isTownsfolk) throw new RuleError('not_a_player');
  if (st.locked) throw new RuleError('already_locked');
  if (st.alive) {
    const hand = handOf(s, seat);
    const ids = new Set<string>();
    for (let p = 0; p < s.seatCount; p++) {
      const id = placements[String(p)];
      if (!id) throw new RuleError('invalid_placement', `no card for pile ${p}`);
      if (ids.has(id)) throw new RuleError('invalid_placement', 'card used twice');
      const card = hand.find((c) => c.id === id);
      if (!card) throw new RuleError('invalid_placement', `card ${id} not in hand`);
      ids.add(id);
    }
    for (let p = 0; p < s.seatCount; p++) placeCard(s, cardById(s, placements[String(p)])!, seat, p);
  } else {
    if (haunt) {
      const card = gravePoolOf(s, seat).find((c) => c.id === haunt.cardId);
      if (!card) throw new RuleError('invalid_placement', 'card not in grave pool');
      const target = s.seats[haunt.pileSeat];
      if (!target || !target.alive) throw new RuleError('invalid_placement', 'haunt a living pile');
      placeCard(s, card, seat, haunt.pileSeat);
    }
  }
  st.locked = true;
  if (livingHumans(s).every((x) => x.locked)) beginResolve(s, now);
}

function placeCard(s: GameState, card: CardInst, by: number, pileSeat: number) {
  card.zone = 'placed'; card.pileSeat = pileSeat; card.placedBy = by; card.roundPlaced = s.round;
  (s.placementsThisRound[by] ??= {})[pileSeat] = card.id;
  if (isAttack(card.key)) s.seats[by].attacksPlaced += 1;
}

export function autoPlace(s: GameState, seat: number): void {
  const st = s.seats[seat];
  if (!st.alive || st.locked) return;
  const hand = shuffle(s, handOf(s, seat));
  for (let p = 0; p < s.seatCount; p++) placeCard(s, hand[p], seat, p);
  st.locked = true;
}
/** Trades held by living seats (what "still in play" means for Alms), lowest gold first. */
export function claimedTrades(s: GameState): Trade[] {
  const set = new Set<Trade>(); for (const st of s.seats) if (st.alive) set.add(st.trade);
  return [...set].filter((t) => unlocked(s, t)).sort((a, b) => s.gold[a] - s.gold[b]);
}

// ---------------------------------------------------------------- resolution
const isGrave = (s: GameState, p: number) => !s.seats[p].alive;
const revealedIn = (s: GameState, p: number) => s.cards.filter((c) => c.zone === 'revealed' && c.pileSeat === p);
const pendingIn = (s: GameState, p: number) => s.cards.filter((c) => c.zone === 'pending' && c.pileSeat === p);
const live = (c: CardInst) => !c.meta.voided;
const voidCard = (s: GameState, c: CardInst, by: string) => { if (!c.meta.voided) { c.meta.voided = true; log(s, { t: 'void', pileSeat: c.pileSeat!, cardId: c.id, cardKey: c.key, by }); } };
const discard = (s: GameState, c: CardInst, by: string) => { log(s, { t: 'discard', pileSeat: c.pileSeat!, cardId: c.id, cardKey: c.key, by }); c.zone = 'town_square'; c.pileSeat = null; };
const neighbors = (s: GameState, p: number) => [(p + s.seatCount - 1) % s.seatCount, (p + 1) % s.seatCount];

function addGold(s: GameState, t: Trade, delta: number, by: string, from?: Trade, ctx?: { pileSeat?: number; cardId?: string }): boolean {
  if (!unlocked(s, t) || delta === 0) return false;
  if (delta < 0 && s.shieldedTrades.includes(t)) { log(s, { t: 'gold', trade: t, delta: 0, by, absorbed: true, ...ctx }); return false; }
  const before = s.gold[t];
  s.gold[t] = Math.max(0, before + delta);
  const applied = s.gold[t] - before;
  if (applied !== 0) log(s, { t: 'gold', trade: t, delta: applied, by, from, ...ctx });
  return applied !== 0;
}
function richest(s: GameState, exclude: Trade[] = []): Trade[] {
  const cands = TRADES.filter((t) => unlocked(s, t) && !exclude.includes(t));
  const max = Math.max(...cands.map((t) => s.gold[t]));
  return cands.filter((t) => s.gold[t] === max);
}
function poorest(s: GameState): Trade[] {
  const cands = TRADES.filter((t) => unlocked(s, t));
  const min = Math.min(...cands.map((t) => s.gold[t]));
  return cands.filter((t) => s.gold[t] === min);
}

function wound(s: GameState, seat: number, amount: number, card: CardInst | null, by: string) {
  const st = s.seats[seat];
  if (!st.alive || amount <= 0) return;
  if (card) { card.zone = 'wound'; card.pileSeat = seat; st.woundTokens += amount - 1; }
  else st.woundTokens += amount;
  log(s, { t: 'wound', seat, amount, cardKey: by, total: woundsOf(s, seat) });
}
function heal(s: GameState, seat: number, amount: number, by: string) {
  const st = s.seats[seat];
  if (!st.alive) return;
  let healed = 0;
  while (amount > 0) {
    if (st.woundTokens > 0) { st.woundTokens--; healed++; amount--; continue; }
    const wc = s.cards.find((c) => c.zone === 'wound' && c.pileSeat === seat);
    if (!wc) break;
    wc.zone = 'town_square'; wc.pileSeat = null; healed++; amount--;
  }
  if (healed > 0) log(s, { t: 'heal', seat, amount: healed, cardKey: by, total: woundsOf(s, seat) });
}

export function beginResolve(s: GameState, now: number): void {
  if (s.phase !== 'placement') throw new RuleError('wrong_phase');
  // AFK humans and townsfolk are auto-placed
  for (const st of s.seats) {
    if (!st.alive) continue;
    if (!st.locked) { if (isHuman(st)) st.afkRounds += 1; autoPlace(s, st.index); }
    else if (isHuman(st)) st.afkRounds = 0;
  }
  const season = seasonOf(s);
  s.taxedPiles = [];
  // 1. shuffle + reveal every pile
  for (let p = 0; p < s.seatCount; p++) {
    const pile = shuffle(s, s.cards.filter((c) => c.zone === 'placed' && c.pileSeat === p));
    for (const c of pile) c.zone = 'revealed';
    log(s, { t: 'reveal', pileSeat: p, cards: pile.map((c) => ({ id: c.id, key: c.key })), grave: isGrave(s, p) });
    if (isGrave(s, p)) for (const c of pile) { c.zone = 'grave_pool'; c.meta = {}; }
  }
  const curfew = s.cards.some((c) => c.zone === 'pending' && c.key === 'sig:curfew' && c.meta.untilRound === s.round);
  const trestle = s.cards.some((c) => c.zone === 'pending' && c.key === 'sig:trestle-market' && c.meta.untilRound === s.round);
  // 2. voids, pile by pile
  for (let p = 0; p < s.seatCount; p++) {
    if (isGrave(s, p)) continue;
    const pile = revealedIn(s, p);
    const pend = () => pendingIn(s, p);
    // Felling Axe clears the pile's pending/persistent cards before anything acts
    if (pile.some((c) => c.key === 'sig:felling-axe')) for (const c of pend()) discard(s, c, 'sig:felling-axe');
    // Broken Door discards one Protect
    if (pile.some((c) => c.key === 'sig:broken-door')) { const pr = pile.find((c) => c.key === 'protect'); if (pr) discard(s, pr, 'sig:broken-door'); }
    const active = (key: string) => pend().some((c) => c.key === key && (c.meta.untilRound === null || c.meta.untilRound === s.round));
    const attacks = () => pile.filter((c) => c.zone === 'revealed' && isAttack(c.key) && live(c));
    if (active('sig:deep-forest')) { for (const c of pile) if (c.zone === 'revealed') voidCard(s, c, 'sig:deep-forest'); continue; }
    if (pile.some((c) => c.key === 'tax-collector' && live(c))) s.taxedPiles.push(p);   // no gold is earned from this pile this round
    if (curfew) for (const c of attacks()) voidCard(s, c, 'sig:curfew');
    if (active('sig:cloak-of-plain-cloth')) for (const c of attacks()) voidCard(s, c, 'sig:cloak-of-plain-cloth');
    const isProtect = (c: CardInst) => c.key === 'protect' || c.key === 'sig:palisade';   // Palisade is the Carpenter's second Protect
    if (active('sig:rotten-beam')) for (const c of pile) if (isProtect(c) && c.zone === 'revealed') voidCard(s, c, 'sig:rotten-beam');
    for (const pr of pile.filter((c) => isProtect(c) && c.zone === 'revealed' && live(c))) {
      const targets = attacks().filter((c) => !def(c.key).pierce);
      if (season === 'winter' && seasonal(s)) { if (targets[0]) voidCard(s, targets[0], pr.key); }
      else for (const c of targets) voidCard(s, c, pr.key);
      pr.meta.used = true;
    }
    // Snare (persistent from an earlier round) springs on the next attack revealed here
    const snare = pend().find((c) => c.key === 'sig:snare');
    if (snare) { const a = attacks()[0]; if (a) { voidCard(s, a, 'sig:snare'); discard(s, snare, 'sig:snare'); if (!s.taxedPiles.includes(p)) addGold(s, 'hunter', 1, 'sig:snare', undefined, { pileSeat: p }); } }
    // Night Patrol: one here, one in each neighbor
    if (pile.some((c) => c.key === 'sig:night-patrol' && live(c))) {
      const a = attacks()[0]; if (a) voidCard(s, a, 'sig:night-patrol');
      for (const n of neighbors(s, p)) { if (isGrave(s, n)) continue; const na = revealedIn(s, n).find((c) => isAttack(c.key) && live(c)); if (na) voidCard(s, na, 'sig:night-patrol'); }
    }
    if (pile.some((c) => c.key === 'sig:bad-batch' && live(c))) for (const c of pile) if (isHeal(c.key) && c.zone === 'revealed') voidCard(s, c, 'sig:bad-batch');
  }
  // 3. wounds
  for (let p = 0; p < s.seatCount; p++) {
    if (isGrave(s, p)) continue;
    const grind = pendingIn(s, p).some((c) => c.key === 'sig:grindstone' && c.meta.untilRound === s.round);
    for (const c of revealedIn(s, p)) {
      if (!isAttack(c.key) || !live(c)) continue;
      wound(s, p, (def(c.key).wounds ?? 1) + (grind ? 1 : 0), c, c.key);
    }
    // Slow Poison due this round
    const poison = pendingIn(s, p).find((c) => c.key === 'sig:slow-poison' && c.meta.untilRound === s.round);
    if (poison) {
      const antidote = revealedIn(s, p).find((c) => isHeal(c.key) && live(c) && !c.meta.consumed);
      if (antidote) { antidote.meta.consumed = true; voidCard(s, antidote, 'antidote'); log(s, { t: 'banner', text: `${s.seats[p].name}'s poison was cured` }); }
      else wound(s, p, 1, null, 'sig:slow-poison');
      discard(s, poison, 'sig:slow-poison');
    }
  }
  // 4. heals
  for (let p = 0; p < s.seatCount; p++) {
    if (isGrave(s, p)) continue;
    for (const c of revealedIn(s, p)) {
      if (!live(c) || c.meta.consumed) continue;
      if (c.key === 'heal') heal(s, p, 1, c.key);
      else if (c.key === 'sig:hearty-stew') heal(s, p, 2, c.key);
      else if (c.key === 'sig:bumper-crop') heal(s, p, 1, c.key);
      else if (c.key === 'sig:panacea') heal(s, p, 99, c.key);
      else if (c.key === 'sig:a-round-on-the-house') for (const st of s.seats) if (st.alive) heal(s, st.index, 1, c.key);
    }
  }
  // 5. deaths
  for (const st of s.seats) {
    if (!st.alive || woundsOf(s, st.index) < s.calendar.deathAt) continue;
    st.alive = false; st.diedRound = s.round; st.revealedTrade = st.trade; s.lockedTrades.push(st.trade);
    for (const c of handOf(s, st.index)) { c.zone = 'grave_pool'; c.pileSeat = st.index; }
    st.willSealed = !isHuman(st);
    log(s, { t: 'death', seat: st.index, trade: st.trade, name: st.name });
  }
  // 6. choices (Iron Strongbox, False Colors) pause the round
  s.choices = [];
  for (let p = 0; p < s.seatCount; p++) {
    if (isGrave(s, p) && s.seats[p].diedRound !== s.round) continue;
    for (const c of revealedIn(s, p)) {
      if (!live(c) || (c.key !== 'sig:iron-strongbox' && c.key !== 'sig:false-colors')) continue;
      const owner = s.seats[p];
      const answerer = owner.alive && isHuman(owner) ? p : crierHuman(s);
      if (answerer === null) continue;
      s.choices.push({ id: `${s.round}-${c.id}`, seat: answerer, cardId: c.id, cardKey: c.key, kind: 'track', options: TRADES.filter((t) => unlocked(s, t)), answer: null });
      log(s, { t: 'choice_wait', seat: answerer, cardKey: c.key });
    }
  }
  if (s.choices.length) { s.phase = 'choice'; s.phaseDeadline = now + s.settings.choiceSeconds * 1000; return; }
  finishResolve(s, now, { curfew, trestle });
}

function crierHuman(s: GameState): number | null {
  for (let i = 0; i < s.seatCount; i++) { const st = s.seats[(s.crierSeat + i) % s.seatCount]; if (st.alive && isHuman(st)) return st.index; }
  return null;
}

export function answerChoice(s: GameState, seat: number, choiceId: string, trade: Trade, now: number): void {
  if (s.phase !== 'choice') throw new RuleError('wrong_phase');
  const ch = s.choices.find((c) => c.id === choiceId);
  if (!ch || ch.seat !== seat) throw new RuleError('invalid_choice');
  if (!ch.options.includes(trade)) throw new RuleError('invalid_choice');
  ch.answer = trade;
  if (s.choices.every((c) => c.answer)) finishResolve(s, now, { curfew: pendingCurfew(s), trestle: pendingTrestle(s) });
}
const pendingCurfew = (s: GameState) => s.cards.some((c) => c.zone === 'pending' && c.key === 'sig:curfew' && c.meta.untilRound === s.round);
const pendingTrestle = (s: GameState) => s.cards.some((c) => c.zone === 'pending' && c.key === 'sig:trestle-market' && c.meta.untilRound === s.round);

export function finishResolve(s: GameState, now: number, flags: { curfew: boolean; trestle: boolean }): void {
  const season = seasonOf(s);
  for (const ch of s.choices) {
    if (!ch.answer) { ch.answer = ch.cardKey === 'sig:iron-strongbox' ? richest(s)[0] : poorest(s)[0]; log(s, { t: 'chosen', seat: ch.seat, cardKey: ch.cardKey, trade: ch.answer, auto: true }); }
    else log(s, { t: 'chosen', seat: ch.seat, cardKey: ch.cardKey, trade: ch.answer, auto: false });
  }
  // 7. gold — Alms first, judged on the board as it stood before this round's income.
  // The card's trade must be clearly last or second-to-last among trades held by living seats:
  // at most one other such trade may sit at or below it. Ties (everyone at 0, a three-way tie for last…) do nothing.
  const boardBefore: Record<string, number> = { ...s.gold };
  for (let p = 0; p < s.seatCount; p++) {
    if (isGrave(s, p) && s.seats[p].diedRound !== s.round) continue;
    for (const c of revealedIn(s, p)) {
      if (!c.key.startsWith('alms:') || !live(c)) continue;
      if (s.taxedPiles.includes(p)) continue;   // the tax collector took it
      const target = def(c.key).trade!;
      const claimed = claimedTrades(s);
      const rank = claimed.indexOf(target);
      const atOrBelow = claimed.filter((t) => t !== target && boardBefore[t] <= boardBefore[target]).length;
      const granted = rank >= 0 && atOrBelow <= 1;
      log(s, { t: 'alms', pileSeat: p, trade: target, granted, rank });
      if (granted) addGold(s, target, 5, 'alms', undefined, { pileSeat: p, cardId: c.id });
    }
  }
  const jobBonus = (season === 'harvest' && seasonal(s) ? 1 : 0) + (flags.trestle ? 1 : 0);
  const GAINS = new Set(['sig:bumper-crop', 'sig:gleaning', 'sig:cutpurse', 'sig:king-s-commission', 'sig:miller-s-toll', 'sig:physician-s-fee', 'sig:cordwood', 'sig:false-colors', 'sig:sunday-best']);
  for (let p = 0; p < s.seatCount; p++) {
    if (isGrave(s, p) && s.seats[p].diedRound !== s.round) continue;
    if (s.taxedPiles.includes(p)) {
      const taken = revealedIn(s, p).filter((c) => live(c) && (isJob(c.key) || c.key.startsWith('alms:') || GAINS.has(c.key))).length;
      log(s, { t: 'tax', pileSeat: p, cards: taken });
      continue;
    }
    for (const c of revealedIn(s, p)) if (isJob(c.key) && live(c)) addGold(s, def(c.key).trade!, 1 + jobBonus, c.key, undefined, { pileSeat: p, cardId: c.id });
  }
  // then signature gold effects clockwise from the Crier
  for (let i = 0; i < s.seatCount; i++) {
    const p = (s.crierSeat + i) % s.seatCount;
    if (isGrave(s, p) && s.seats[p].diedRound !== s.round) continue;
    const pile = revealedIn(s, p);
    for (const c of pile) {
      if (!live(c)) continue;
      if (s.taxedPiles.includes(p) && GAINS.has(c.key)) continue;   // gains from a taxed pile go to the crown
      switch (c.key) {
        case 'sig:bumper-crop': addGold(s, 'farmer', 1, c.key); break;
        case 'sig:gleaning': addGold(s, poorest(s)[0], 2, c.key); break;
        case 'sig:cutpurse': { const r = richest(s, ['thief'])[0]; if (r && unlocked(s, 'thief')) { const amt = Math.min(2, s.gold[r]); if (amt > 0 && addGold(s, r, -amt, c.key)) addGold(s, 'thief', amt, c.key, r); } break; }
        case 'sig:paste-gems': addGold(s, richest(s)[0], -2, c.key); break;
        case 'sig:king-s-commission': addGold(s, 'jeweler', 2, c.key); break;
        case 'sig:miller-s-toll': addGold(s, 'miller', Math.min(3, Math.floor(pile.filter((x) => isJob(x.key)).length / 2)), c.key); break;
        case 'sig:thumb-on-the-scale': for (const t of TRADES) if (t !== 'miller' && unlocked(s, t) && s.gold[t] > s.gold['miller']) addGold(s, t, -1, c.key); break;
        case 'sig:physician-s-fee': addGold(s, 'apothecary', Math.min(3, s.seats.filter((x) => x.alive).reduce((n, x) => n + woundsOf(s, x.index), 0)), c.key); break;
        case 'sig:cordwood': addGold(s, 'woodsman', season === 'winter' ? 2 : 1, c.key); break;
        case 'sig:false-colors': { const ch = s.choices.find((x) => x.cardId === c.id); if (ch?.answer) addGold(s, ch.answer, 1, c.key); break; }
        case 'sig:iron-strongbox': { const ch = s.choices.find((x) => x.cardId === c.id); if (ch?.answer && !s.shieldedTrades.includes(ch.answer)) { s.shieldedTrades.push(ch.answer); c.zone = 'shield'; c.pileSeat = null; c.meta.trade = ch.answer; log(s, { t: 'shield', trade: ch.answer, by: c.key }); } break; }
        case 'sig:sunday-best': addGold(s, 'tailor', 1, c.key); c.zone = 'scoring'; c.pileSeat = p; log(s, { t: 'scoring', seat: p, cardKey: c.key }); break;
        case 'sig:blackmail': c.zone = 'scoring'; c.pileSeat = p; log(s, { t: 'scoring', seat: p, cardKey: c.key }); break;
      }
    }
  }
  // 8. words
  for (let p = 0; p < s.seatCount; p++) {
    const owner = s.seats[p];
    for (const c of revealedIn(s, p)) {
      if (!live(c) || owner.isTownsfolk) continue;
      if (c.key === 'sig:inquest') { const keys = Object.values(s.placementsThisRound[p] ?? {}).map((id) => cardById(s, id)!.key); log(s, { t: 'truth', seat: p, cardKey: c.key, answer: keys.some(isAttack) ? 'Yes' : 'No' }); }
      else if (c.key === 'sig:appraisal') log(s, { t: 'truth', seat: p, cardKey: c.key, answer: String(handOf(s, p).filter((x) => isJob(x.key)).length) });
      else if (c.key === 'sig:tracks-in-the-snow') log(s, { t: 'truth', seat: p, cardKey: c.key, answer: String(owner.attacksPlaced) });
      else if (c.key === 'sig:strong-ale') log(s, { t: 'reveal_hand', seat: p, cardKey: c.key, cards: handOf(s, p).map((x) => x.key) });
    }
  }
  // 9. pending: cards whose effect happens later stay on the pile
  const PENDING: Record<string, number | null> = { 'sig:grindstone': 1, 'sig:curfew': 1, 'sig:cloak-of-plain-cloth': 1, 'sig:trestle-market': 1, 'sig:rotten-beam': 1, 'sig:deep-forest': 1, 'sig:slow-poison': 1, 'sig:snare': null };
  for (let p = 0; p < s.seatCount; p++) {
    for (const c of revealedIn(s, p)) {
      if (!live(c) || !(c.key in PENDING)) continue;
      c.zone = 'pending'; c.meta.untilRound = PENDING[c.key] === null ? null : s.round + 1;
      if (c.key === 'sig:slow-poison') log(s, { t: 'poison_set', seat: p });
      log(s, { t: 'pending', pileSeat: p, cardKey: c.key, untilRound: c.meta.untilRound as number | null });
    }
  }
  // expired pendings → town square; everything else revealed → town square
  for (const c of s.cards) {
    if (c.zone === 'pending' && c.meta.untilRound !== null && (c.meta.untilRound as number) <= s.round) { c.zone = 'town_square'; c.pileSeat = null; }
    else if (c.zone === 'revealed') { c.zone = 'town_square'; c.pileSeat = null; c.meta = {}; }
  }
  // 10. season end
  const next = s.calendar.seasons[s.round];
  if (seasonal(s) && season === 'harvest' && next !== 'harvest') {
    const r = richest(s).filter((t) => s.gold[t] > 0);
    log(s, { t: 'season_event', kind: 'reeves-tax', trades: r });
    for (const t of r) addGold(s, t, -2, 'reeves-tax');
  }
  // Optional leader rule (settings.leaderRules): the Reeve's tithe — each track pays 1 gold per 8 it holds
  if (s.settings.leaderRules) for (const t of TRADES) {
    if (!unlocked(s, t)) continue;
    const due = Math.floor(s.gold[t] / 8);
    if (due > 0) addGold(s, t, -due, 'tithe');
  }
  s.roundLog!.complete = true;
  s.logs.push(s.roundLog!);
  s.choices = [];
  s.phase = 'reveal';
  s.revealStep = 0;
  s.revealSteps = Math.max(1, sceneCount(s.roundLog!));
  s.phaseDeadline = now + stepMs(s);
  for (const st of s.seats) { st.ack = false; st.skipReveal = false; }
}

// ---------------------------------------------------------------- reveal: one scene at a time, in lockstep
const allRevealAcked = (s: GameState) => s.seats.filter(isHuman).every((x) => x.ack || x.skipReveal);

/** A player clicked Next on the current scene. The table advances when everyone has. */
export function acknowledge(s: GameState, seat: number, now: number): void {
  if (s.phase !== 'reveal') throw new RuleError('wrong_phase');
  const st = s.seats[seat];
  if (st.isTownsfolk) throw new RuleError('not_a_player');
  st.ack = true;
  if (allRevealAcked(s)) advanceReveal(s, now);
}
export const revealNext = acknowledge;

/** A player skips the rest of the reveal: they count as ready for every remaining scene. */
export function revealSkip(s: GameState, seat: number, now: number): void {
  if (s.phase !== 'reveal') throw new RuleError('wrong_phase');
  const st = s.seats[seat];
  if (st.isTownsfolk) throw new RuleError('not_a_player');
  st.skipReveal = true; st.ack = true;
  if (allRevealAcked(s)) advanceReveal(s, now);
}

export function advanceReveal(s: GameState, now: number): void {
  if (s.phase !== 'reveal') return;
  s.revealStep += 1;
  if (s.revealStep >= s.revealSteps) { afterReveal(s, now); return; }
  for (const st of s.seats) st.ack = st.skipReveal;
  s.phaseDeadline = now + stepMs(s);
  if (allRevealAcked(s)) advanceReveal(s, now);
}
export const revealWaitingOn = (s: GameState): number[] => s.seats.filter((x) => isHuman(x) && !x.ack && !x.skipReveal).map((x) => x.index);

export function afterReveal(s: GameState, now: number): void {
  const pendingWills = deadHumans(s).filter((x) => !x.willSealed);
  for (const st of pendingWills) if (heirOptions(s, st.index).length === 0) st.willSealed = true;
  if (deadHumans(s).some((x) => !x.willSealed)) { s.phase = 'funeral'; s.phaseDeadline = now + s.settings.funeralSeconds * 1000; return; }
  nextRoundOrEnd(s, now);
}

export function heirOptions(s: GameState, seat: number): number[] {
  return s.succession.filter((i) => i !== seat && s.seats[i].alive && isHuman(s.seats[i]));
}

export function sealWill(s: GameState, seat: number, heir: number, now: number): void {
  if (s.phase !== 'funeral') throw new RuleError('wrong_phase');
  const st = s.seats[seat];
  if (st.alive || st.willSealed || !isHuman(st)) throw new RuleError('not_your_funeral');
  if (!heirOptions(s, seat).includes(heir)) throw new RuleError('invalid_heir');
  st.heir = heir; st.willSealed = true; s.succession = s.succession.filter((i) => i !== heir);
  // a ghost whose every possible heir was just taken dies without a will
  for (const d of deadHumans(s)) if (!d.willSealed && heirOptions(s, d.index).length === 0) d.willSealed = true;
  if (deadHumans(s).every((x) => x.willSealed)) nextRoundOrEnd(s, now);
}

function nextRoundOrEnd(s: GameState, now: number): void {
  if (s.round >= s.calendar.rounds || livingHumans(s).length === 0) { finalScoring(s); return; }
  s.round += 1;
  s.crierSeat = (s.crierSeat + 1) % s.seatCount;
  for (const st of s.seats) { st.ready = false; st.ack = false; st.skipReveal = false; }
  s.revealStep = 0; s.revealSteps = 0;
  s.roundLog = { round: s.round, events: [{ t: 'round_start', round: s.round, season: seasonOf(s) }], complete: false };
  // Optional leader rule (settings.leaderRules): the Reckoning — at the start of the final round the richest trade is unmasked
  if (s.settings.leaderRules && s.round === s.calendar.rounds) {
    const living = s.seats.filter((x) => x.alive);
    const max = Math.max(0, ...living.map((x) => s.gold[x.trade]));
    if (max > 0) {
      const top = living.filter((x) => s.gold[x.trade] === max);
      for (const st of top) st.revealedTrade = st.trade;
      log(s, { t: 'reckoning', seats: top.map((x) => ({ seat: x.index, trade: x.trade, gold: max })) });
    }
  }
  startPlacement(s, now);   // no Ready step: gossip happens while cards are placed
}

export function finalScoring(s: GameState): void {
  s.roundLog = { round: s.round + 1, events: [], complete: false };
  for (const st of s.seats) if (st.alive) st.revealedTrade = st.trade;
  log(s, { t: 'final_reveal', seats: s.seats.filter((x) => x.alive).map((x) => ({ seat: x.index, trade: x.trade })) });
  // scoring cards
  for (const c of s.cards.filter((x) => x.zone === 'scoring')) {
    const owner = s.seats[c.pileSeat!];
    if (!owner.alive) continue;
    if (c.key === 'sig:blackmail') { addGold(s, owner.trade, -1, c.key); addGold(s, 'thief', 1, c.key); }
    if (c.key === 'sig:sunday-best') addGold(s, owner.trade, 1, c.key);
  }
  const rows: ScoreRow[] = [];
  for (const st of s.seats) {
    if (!st.alive) continue;
    const w = woundsOf(s, st.index);
    const before = s.gold[st.trade];
    if (w > 0) addGold(s, st.trade, -w, 'wounds');
    rows.push({ seat: st.index, trade: st.trade, base: before, wounds: w, scoring: 0, total: s.gold[st.trade], eligible: true });   // every living seat, bots included, can win
  }
  const eligible = rows.filter((r) => r.eligible);
  let winners: number[] = [];
  if (eligible.length) {
    const max = Math.max(...eligible.map((r) => r.total));
    let top = eligible.filter((r) => r.total === max);
    const fewest = Math.min(...top.map((r) => r.wounds));
    top = top.filter((r) => r.wounds === fewest);
    winners = top.map((r) => r.seat);
  }
  const sharedBy = deadHumans(s).filter((x) => x.heir !== null && winners.includes(x.heir)).map((x) => x.index);
  s.winners = winners; s.sharedBy = sharedBy; s.scoreRows = rows;
  log(s, { t: 'final_score', rows, winners, sharedBy });
  s.roundLog.complete = true; s.logs.push(s.roundLog);
  s.phase = 'ended'; s.status = 'finished'; s.phaseDeadline = null;
}

// ---------------------------------------------------------------- deadlines
export function tick(s: GameState, now: number): boolean {
  if (s.phaseDeadline === null || now < s.phaseDeadline) return false;
  switch (s.phase) {
    case 'gossip': startPlacement(s, now); return true;
    case 'placement': beginResolve(s, now); return true;
    case 'choice': finishResolve(s, now, { curfew: pendingCurfew(s), trestle: pendingTrestle(s) }); return true;
    case 'reveal': advanceReveal(s, now); return true;
    case 'funeral': {
      for (const st of deadHumans(s)) if (!st.willSealed) { const opts = heirOptions(s, st.index); if (opts.length) { const h = pick(s, opts); st.heir = h; s.succession = s.succession.filter((i) => i !== h); } st.willSealed = true; }
      nextRoundOrEnd(s, now); return true;
    }
    default: return false;
  }
}

/** A human leaves a running game: the seat plays on as a bot. Whatever the seat was blocking is re-checked. */
export function convertToBot(s: GameState, seat: number, now: number): void {
  const st = s.seats[seat];
  if (st.isTownsfolk) return;
  st.isTownsfolk = true; st.userId = null; st.name = `${st.name} (left)`;
  st.ready = true; st.ack = true; st.skipReveal = true; st.willSealed = true;
  s.succession = s.succession.filter((i) => i !== seat);
  for (const ch of s.choices) if (ch.seat === seat && !ch.answer) { const c = crierHuman(s); if (c !== null) ch.seat = c; else ch.answer = ch.options[0]; }
  if (s.status !== 'playing') return;
  switch (s.phase) {
    case 'gossip': if (livingHumans(s).length && livingHumans(s).every((x) => x.ready)) startPlacement(s, now); break;
    case 'placement': if (livingHumans(s).length && livingHumans(s).every((x) => x.locked)) beginResolve(s, now); break;
    case 'choice': if (s.choices.every((c) => c.answer)) finishResolve(s, now, { curfew: pendingCurfew(s), trestle: pendingTrestle(s) }); break;
    case 'reveal': if (allRevealAcked(s)) advanceReveal(s, now); break;
    case 'funeral': if (deadHumans(s).every((x) => x.willSealed)) nextRoundOrEnd(s, now); break;
  }
}
export const humanCount = (s: GameState): number => s.seats.filter((x) => x.userId !== null).length;

export function pileCount(s: GameState, p: number): number { return s.cards.filter((c) => c.zone === 'placed' && c.pileSeat === p).length; }
export { CARDS };
