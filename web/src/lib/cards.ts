export { CARDS, TRADES, TRADE_INFO, def, roleArt, CREST_COLORS } from '../engine/cards.ts';
import { def } from '../engine/cards.ts';
export const artUrl = (key: string) => `/cards/${def(key).art}.jpg`;
export const CARD_BACK = '/cards/basic-card-back.jpg';
export function cardTypeLabel(key: string): string {
  const d = def(key);
  if (d.type === 'attack') return d.kind === 'calamity' ? 'Calamity · 2 wounds' : d.kind === 'mishap' ? 'Mishap · 1 wound' : `Attack · ${d.wounds} wound${d.wounds === 1 ? '' : 's'}`;
  if (d.type === 'job') return 'Wares · 1 gold';
  if (key.startsWith('alms:')) return 'Alms · catch-up';
  if (key === 'tax-collector') return 'Tax Collector';
  if (d.type === 'signature') return 'Signature';
  return d.type === 'heal' ? 'Heal' : 'Protect';
}
