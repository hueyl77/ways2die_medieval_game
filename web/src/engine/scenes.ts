// Turns a round log into the ordered scenes of the reveal. Shared by the client
// (to render) and the engine (to know how many Next clicks a reveal needs).
import type { LogEvent, RoundLog } from './types.ts';
import { CARDS, TRADE_INFO } from './cards.ts';

export interface GoldDelta { trade: string; delta: number }
/** One step of a seat's wound count (+1 hurt, -1 healed), animated one at a time on the seat tile. */
export interface WoundStep { seat: number; delta: 1 | -1; cardKey: string }
export interface SceneLine { text: string; gold?: GoldDelta[]; wounds?: WoundStep[] }
export type Scene =
  | { kind: 'pile'; pileSeat: number; grave: boolean; cards: { id: string; key: string }[]; voided: Map<string, string>; discarded: Map<string, string>; cardGold: Map<string, GoldDelta>; taxed: boolean; wounds: WoundStep[] }
  | { kind: 'list'; title: string; lines: SceneLine[]; tone: 'blood' | 'heal' | 'gold' | 'moon' | 'parchment' }
  | { kind: 'death'; seat: number; trade: string; name: string }
  | { kind: 'hand'; seat: number; cards: string[] };

/** Every gold change a scene applies, in the order it should be animated. */
export function sceneGold(s: Scene): GoldDelta[] {
  if (s.kind === 'pile') return s.cards.map((c) => s.cardGold.get(c.id)).filter((g): g is GoldDelta => !!g);
  if (s.kind === 'list') return s.lines.flatMap((l) => l.gold ?? []);
  return [];
}

/** Every wound step a scene applies, in the order it should be animated. */
export function sceneWounds(s: Scene): WoundStep[] {
  if (s.kind === 'pile') return s.wounds;
  if (s.kind === 'list') return s.lines.flatMap((l) => l.wounds ?? []);
  return [];
}
const steps = (e: { t: 'wound' | 'heal'; seat: number; amount: number; cardKey: string }): WoundStep[] =>
  Array.from({ length: e.amount }, () => ({ seat: e.seat, delta: e.t === 'wound' ? 1 : -1, cardKey: e.cardKey }));

const tradeName = (t: string) => TRADE_INFO[t as keyof typeof TRADE_INFO]?.name ?? t;
export const cardName = (k: string) => CARDS[k]?.name ?? k;

export function buildScenes(log: RoundLog, name: (seat: number) => string): Scene[] {
  const ev = log.events; const scenes: Scene[] = [];
  const voidsFor = (p: number) => new Map(ev.filter((e): e is Extract<LogEvent, { t: 'void' }> => e.t === 'void' && e.pileSeat === p).map((e) => [e.cardId, e.by]));
  const discFor = (p: number) => new Map(ev.filter((e): e is Extract<LogEvent, { t: 'discard' }> => e.t === 'discard' && e.pileSeat === p).map((e) => [e.cardId, e.by]));
  const season = (ev.find((e) => e.t === 'round_start') as Extract<LogEvent, { t: 'round_start' }> | undefined)?.season;
  const goldEv = ev.filter((e): e is Extract<LogEvent, { t: 'gold' }> => e.t === 'gold');
  // wares bank as their pile flips: attach each wares card's coins to the card
  // Every wound or heal is attributed to the pile holding the live card that caused it: the victim's own pile for attacks
  // (attacks only ever wound the pile's owner), or whichever pile revealed a heal-all card. A card that is in no pile
  // this round (a Slow Poison biting) plays in the Wounds & remedies scene instead.
  const reveals = ev.filter((e): e is Extract<LogEvent, { t: 'reveal' }> => e.t === 'reveal');
  const liveKeys = (p: number) => { const r = reveals.find((x) => x.pileSeat === p); const v = voidsFor(p); const d = discFor(p); return new Set((r?.cards ?? []).filter((c) => !v.has(c.id) && !d.has(c.id)).map((c) => c.key)); };
  const pileOf = new Map<LogEvent, number>();
  for (const e of ev) {
    if (e.t !== 'wound' && e.t !== 'heal') continue;
    if (liveKeys(e.seat).has(e.cardKey)) { pileOf.set(e, e.seat); continue; }
    const host = reveals.find((r) => liveKeys(r.pileSeat).has(e.cardKey));
    if (host) pileOf.set(e, host.pileSeat);
  }
  for (const e of ev) if (e.t === 'reveal') {
    const cardGold = new Map<string, GoldDelta>();
    for (const g of goldEv) if (g.cardId && g.pileSeat === e.pileSeat && g.by.startsWith('job:') && g.delta) cardGold.set(g.cardId, { trade: g.trade, delta: g.delta });
    const wounds = ev.filter((x): x is Extract<LogEvent, { t: 'wound' | 'heal' }> => (x.t === 'wound' || x.t === 'heal') && pileOf.get(x) === e.pileSeat).flatMap(steps);
    scenes.push({ kind: 'pile', pileSeat: e.pileSeat, grave: e.grave, cards: e.cards, voided: voidsFor(e.pileSeat), discarded: discFor(e.pileSeat), cardGold, taxed: ev.some((x) => x.t === 'tax' && x.pileSeat === e.pileSeat), wounds });
  }
  const wounds: SceneLine[] = ev.filter((e) => e.t === 'wound' || e.t === 'heal' || e.t === 'poison_set').map((e) => ({ text:
    e.t === 'wound' ? `${name(e.seat)} takes ${e.amount} wound${e.amount > 1 ? 's' : ''}: ${cardName(e.cardKey)} (${e.total} total)`
    : e.t === 'heal' ? `${name(e.seat)} heals ${e.amount}: ${cardName(e.cardKey)} (${e.total} left)`
    : `${name(e.seat)} has been poisoned. It bites at the end of next round.`,
    wounds: (e.t === 'wound' || e.t === 'heal') && !pileOf.has(e) ? steps(e) : undefined }));
  if (wounds.length) scenes.push({ kind: 'list', title: 'Wounds & remedies', lines: wounds, tone: 'blood' });
  for (const e of ev) if (e.t === 'death') scenes.push({ kind: 'death', seat: e.seat, trade: e.trade, name: e.name });
  // the ledger: wares totals (already animated on the piles), then every other gold effect
  const wares = new Map<string, { total: number; count: number; each: number }>();
  const gold: SceneLine[] = [];
  for (const e of ev) {
    if (e.t === 'gold' && e.by.startsWith('job:') && !e.absorbed) { const w = wares.get(e.trade) ?? { total: 0, count: 0, each: e.delta }; w.total += e.delta; w.count += 1; wares.set(e.trade, w); continue; }
    if (e.t === 'gold' && (e.by === 'reeves-tax' || e.by === 'tithe')) continue; // shown in their own scenes
    if (e.t === 'tax') { gold.push({ text: `Tax Collector in front of ${name(e.pileSeat)}: ${e.cards} card${e.cards === 1 ? '' : 's'} earned nothing: the crown took it` }); continue; }
    if (e.t === 'alms') { gold.push({ text: e.granted ? `Alms for the ${tradeName(e.trade)} (in front of ${name(e.pileSeat)}): among the poorest, +4 gold` : `Alms for the ${tradeName(e.trade)} (in front of ${name(e.pileSeat)}): not clearly among the two poorest: nothing` }); continue; }
    if (e.t === 'gold' && e.by === 'alms') { const last = gold[gold.length - 1]; if (last && last.text.startsWith('Alms')) { last.gold = [{ trade: e.trade, delta: e.delta }]; continue; } }
    if (e.t === 'gold') gold.push({ text: e.absorbed ? `${tradeName(e.trade)} is shielded: ${cardName(e.by)} takes nothing` : `${tradeName(e.trade)} ${e.delta > 0 ? '+' : ''}${e.delta} · ${e.by === 'wounds' ? 'wounds' : cardName(e.by)}${e.from ? ` (from ${tradeName(e.from)})` : ''}`, gold: e.delta ? [{ trade: e.trade, delta: e.delta }] : [] });
    else if (e.t === 'shield') gold.push({ text: `${tradeName(e.trade)} is locked in an Iron Strongbox` });
    else if (e.t === 'scoring') gold.push({ text: `${cardName(e.cardKey)} sits in front of ${name(e.seat)} until the final count` });
    else if (e.t === 'chosen') gold.push({ text: `${name(e.seat)} chose ${tradeName(e.trade)} for ${cardName(e.cardKey)}${e.auto ? ' (by default)' : ''}` });
  }
  const bonusName = (each: number) => each >= 3 ? 'Market Fair + Trestle Market' : season === 'harvest' ? 'Market Fair' : 'Trestle Market';
  const waresLines: SceneLine[] = [...wares.entries()].sort((a, b) => b[1].total - a[1].total)
    .map(([t, w]) => ({ text: `${tradeName(t)} +${w.total} · ${w.count} wares${w.each > 1 ? ` at ${w.each} each (${bonusName(w.each)})` : ' sold'}` }));
  gold.unshift(...waresLines);
  if (gold.length) scenes.push({ kind: 'list', title: 'The ledger', lines: gold, tone: 'gold' });
  for (const e of ev) {
    if (e.t === 'truth') scenes.push({ kind: 'list', title: cardName(e.cardKey), lines: [{ text: `${name(e.seat)} must answer truthfully: ${e.answer}` }], tone: 'moon' });
    if (e.t === 'reveal_hand') scenes.push({ kind: 'hand', seat: e.seat, cards: e.cards });
  }
  const pend: SceneLine[] = ev.filter((e): e is Extract<LogEvent, { t: 'pending' }> => e.t === 'pending').map((e) => ({ text: `${cardName(e.cardKey)} stays on ${name(e.pileSeat)}'s pile${e.untilRound ? ' until next round' : ''}` }));
  if (pend.length) scenes.push({ kind: 'list', title: 'Left on the table', lines: pend, tone: 'moon' });
  const tithe = goldEv.filter((g) => g.by === 'tithe');
  if (tithe.length) scenes.push({ kind: 'list', title: "The Reeve's tithe", lines: tithe.map((g) => ({ text: g.absorbed ? `${tradeName(g.trade)} is shielded: the Reeve leaves empty-handed` : `${tradeName(g.trade)} pays ${-g.delta} gold to the crown (1 per 8 held)`, gold: g.delta ? [{ trade: g.trade, delta: g.delta }] : [] })), tone: 'gold' });
  for (const e of ev) if (e.t === 'reckoning') scenes.unshift({ kind: 'list', title: 'The Reckoning', lines: e.seats.map((x) => ({ text: `${name(x.seat)} held the richest trade at the start of the round: ${tradeName(x.trade)}, ${x.gold} gold: and the whole village knew it.` })), tone: 'blood' });
  for (const e of ev) if (e.t === 'season_event') {
    const taxed = goldEv.filter((g) => g.by === 'reeves-tax');
    const lines: SceneLine[] = e.trades.length ? e.trades.map((t) => { const g = taxed.find((x) => x.trade === t); return { text: g && g.absorbed ? `${tradeName(t)} is shielded: the Reeve leaves empty-handed` : `${tradeName(t)} pays ${g ? -g.delta : 2} gold to the crown`, gold: g && g.delta ? [{ trade: t, delta: g.delta }] : [] }; }) : [{ text: 'Nobody was rich enough to tax.' }];
    scenes.push({ kind: 'list', title: "The Reeve's Tax", lines, tone: 'gold' });
  }
  return scenes;
}

export const sceneCount = (log: RoundLog): number => buildScenes(log, (i) => `#${i}`).length;
