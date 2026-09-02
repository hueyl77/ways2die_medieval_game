import { useEffect, useRef } from 'react';
import type { PlayerView, LogEvent } from '../engine/types.ts';
import { cardName } from '../engine/scenes.ts';
import { TRADE_INFO } from '../lib/cards';

const tradeName = (t: string) => TRADE_INFO[t as keyof typeof TRADE_INFO]?.name ?? t;

/** One readable line per game event (wares are summed per trade and per round). */
export function describeRound(events: LogEvent[], name: (seat: number) => string): { text: string; tone: string }[] {
  const out: { text: string; tone: string }[] = [];
  const wares = new Map<string, { total: number; count: number }>();
  for (const e of events) {
    switch (e.t) {
      case 'round_start': out.push({ text: `Round ${e.round} begins — ${e.season[0].toUpperCase()}${e.season.slice(1)}.`, tone: 'text-gold' }); break;
      case 'reveal': out.push({ text: e.grave ? `${name(e.pileSeat)}'s grave held ${e.cards.length} cards (no effect).` : `In front of ${name(e.pileSeat)}: ${e.cards.map((c) => cardName(c.key)).join(', ')}.`, tone: 'text-parchment' }); break;
      case 'void': out.push({ text: `${cardName(e.cardKey)} in front of ${name(e.pileSeat)} was voided by ${cardName(e.by)}.`, tone: 'text-moon' }); break;
      case 'discard': out.push({ text: `${cardName(e.cardKey)} in front of ${name(e.pileSeat)} was discarded by ${cardName(e.by)}.`, tone: 'text-moon' }); break;
      case 'wound': out.push({ text: `${name(e.seat)} took ${e.amount} wound${e.amount > 1 ? 's' : ''} from ${cardName(e.cardKey)} (${e.total} total).`, tone: 'text-blood' }); break;
      case 'heal': out.push({ text: `${name(e.seat)} healed ${e.amount} from ${cardName(e.cardKey)} (${e.total} left).`, tone: 'text-heal' }); break;
      case 'poison_set': out.push({ text: `${name(e.seat)} was poisoned; it bites at the end of next round.`, tone: 'text-blood' }); break;
      case 'death': out.push({ text: `☠ ${e.name} died. The envelope opened: ${tradeName(e.trade)}.`, tone: 'text-blood font-bold' }); break;
      case 'gold':
        if (e.by === 'alms') break;   // described by the alms event
        if (e.by.startsWith('job:') && !e.absorbed) { const w = wares.get(e.trade) ?? { total: 0, count: 0 }; w.total += e.delta; w.count += 1; wares.set(e.trade, w); break; }
        out.push({ text: e.absorbed ? `${tradeName(e.trade)} is shielded — ${describeBy(e.by)} took nothing.` : `${tradeName(e.trade)} ${e.delta > 0 ? 'gained' : 'lost'} ${Math.abs(e.delta)} gold from ${describeBy(e.by)}${e.from ? ` (taken from ${tradeName(e.from)})` : ''}.`, tone: 'text-gold' }); break;
      case 'shield': out.push({ text: `${tradeName(e.trade)} was locked in an Iron Strongbox.`, tone: 'text-gold' }); break;
      case 'scoring': out.push({ text: `${cardName(e.cardKey)} now sits in front of ${name(e.seat)} until the final count.`, tone: 'text-gold' }); break;
      case 'pending': out.push({ text: `${cardName(e.cardKey)} stays on ${name(e.pileSeat)}'s pile${e.untilRound ? ' until next round' : ''}.`, tone: 'text-moon' }); break;
      case 'truth': out.push({ text: `${cardName(e.cardKey)} — ${name(e.seat)} answered truthfully: ${e.answer}.`, tone: 'text-moon' }); break;
      case 'reveal_hand': out.push({ text: `Strong Ale — ${name(e.seat)} showed their hand: ${e.cards.map(cardName).join(', ')}.`, tone: 'text-moon' }); break;
      case 'choice_wait': out.push({ text: `${name(e.seat)} had a choice to make for ${cardName(e.cardKey)}.`, tone: 'text-ink-2' }); break;
      case 'chosen': out.push({ text: `${name(e.seat)} chose ${tradeName(e.trade)} for ${cardName(e.cardKey)}${e.auto ? ' (by default)' : ''}.`, tone: 'text-gold' }); break;
      case 'season_event': out.push({ text: `The Reeve's Tax fell on ${e.trades.length ? e.trades.map(tradeName).join(', ') : 'nobody'}.`, tone: 'text-gold' }); break;
      case 'alms': out.push({ text: e.granted ? `Alms in front of ${name(e.pileSeat)} named the ${tradeName(e.trade)} — among the poorest trades in play, so it gained 5 gold.` : `Alms in front of ${name(e.pileSeat)} named the ${tradeName(e.trade)}, but it was not clearly among the two poorest trades in play (judged before this round's gold), so nothing happened.`, tone: 'text-gold' }); break;
      case 'tax': out.push({ text: `A Tax Collector in front of ${name(e.pileSeat)} seized everything earned there (${e.cards} card${e.cards === 1 ? '' : 's'}).`, tone: 'text-gold' }); break;
      case 'reckoning': out.push({ text: `⚖ The Reckoning: ${e.seats.map((x) => `${name(x.seat)} holds the richest trade, ${tradeName(x.trade)} (${x.gold} gold)`).join('; ')}. Their envelope is open for the final round.`, tone: 'text-blood font-bold' }); break;
      case 'banner': out.push({ text: e.text, tone: 'text-parchment' }); break;
      case 'final_reveal': out.push({ text: `The final reveal: ${e.seats.map((x) => `${name(x.seat)} — ${tradeName(x.trade)}`).join('; ')}.`, tone: 'text-gold font-bold' }); break;
      case 'final_score': out.push({ text: e.winners.length ? `${e.winners.map(name).join(' & ')} won the year.${e.sharedBy.length ? ` ${e.sharedBy.map(name).join(' & ')} rose to share it.` : ''}` : 'Nobody won the year.', tone: 'text-gold font-bold' }); break;
    }
  }
  // wares summaries go right after the piles they came from is too fiddly; append them before the first non-pile gold line
  const waresLines = [...wares.entries()].sort((a, b) => b[1].total - a[1].total).map(([t, w]) => ({ text: `${tradeName(t)} gained ${w.total} gold from wares (${w.count} card${w.count > 1 ? 's' : ''}).`, tone: 'text-gold' }));
  const firstGold = out.findIndex((l) => l.tone.startsWith('text-gold') && !l.text.startsWith('Round'));
  if (firstGold >= 0) out.splice(firstGold, 0, ...waresLines); else out.push(...waresLines);
  return out;
}
const describeBy = (by: string) => by === 'reeves-tax' ? "the Reeve's Tax" : by === 'tithe' ? "the Reeve's tithe (1 per 8 held)" : by === 'wounds' ? 'wounds' : cardName(by);

export function GameLog({ view }: { view: PlayerView }) {
  const box = useRef<HTMLDivElement>(null);
  const name = (i: number) => view.seats[i]?.name ?? `Seat ${i}`;
  // a round being revealed scene by scene stays out of the log until the reveal is over
  const rounds = view.logs.filter((l) => !(view.phase === 'reveal' && l.round === view.round));
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [rounds.length, view.phase]);
  return (
    <div ref={box} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin mt-2 pr-1 space-y-3">
      {rounds.length === 0 && <p className="text-xs text-ink-2 italic">Nothing has happened yet. Give it a round.</p>}
      {rounds.map((l) => (
        <div key={l.round}>
          {describeRound(l.events, name).map((line, i) => <div key={i} className={`text-xs leading-snug ${line.tone}`}>{line.text}</div>)}
        </div>
      ))}
    </div>
  );
}
