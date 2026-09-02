// Card catalog. Every card in the game is described here; art ids match the
// Ludo.ai batch manifest (make_manifest.py) via the same slug function.
export const TRADES = [
  'blacksmith', 'farmer', 'thief', 'innkeeper', 'city-guard', 'carpenter',
  'jeweler', 'tailor', 'apothecary', 'hunter', 'woodsman', 'miller',
] as const;
export type Trade = (typeof TRADES)[number];

export const TRADE_INFO: Record<Trade, { name: string; verb: string; emoji: string }> = {
  blacksmith: { name: 'Blacksmith', verb: 'the arms dealer', emoji: '⚒' },
  farmer: { name: 'Farmer', verb: 'the provider', emoji: '🌾' },
  thief: { name: 'Thief', verb: 'the criminal', emoji: '🗡' },
  innkeeper: { name: 'Innkeeper', verb: 'the host', emoji: '🍺' },
  'city-guard': { name: 'City Guard', verb: 'the law', emoji: '🛡' },
  carpenter: { name: 'Carpenter', verb: 'builder and breaker', emoji: '🔨' },
  jeweler: { name: 'Jeweler', verb: 'the wealth broker', emoji: '💎' },
  tailor: { name: 'Tailor', verb: 'appearances', emoji: '🧵' },
  apothecary: { name: 'Apothecary', verb: 'the poisoner-physician', emoji: '⚗' },
  hunter: { name: 'Hunter', verb: 'the tracker', emoji: '🏹' },
  woodsman: { name: 'Woodsman', verb: 'the man outside the walls', emoji: '🪓' },
  miller: { name: 'Miller', verb: 'the cheat', emoji: '⚙' },
};

export type CardType = 'job' | 'attack' | 'heal' | 'protect' | 'signature';

export interface CardDef {
  key: string;
  name: string;
  type: CardType;
  trade?: Trade;            // job cards and signatures
  wounds?: number;          // attacks
  pierce?: boolean;         // ignores Protect / Palisade
  kind?: 'mishap' | 'calamity';
  text: string;
  flavor?: string;
  art: string;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const MISHAPS: [string, string][] = [
  ['Bee Swarm', 'Someone moved the hive. Someone always moves the hive.'],
  ['Loose Cobblestone', 'The market square claims another ankle.'],
  ['The Goose', 'It has hated you since Michaelmas.'],
  ['Gardyloo!', 'The contents of an upstairs chamber pot, with a cheerful warning shouted afterward.'],
  ['Rotten Floorboard', 'Straight through to the cellar. The cellar was not empty.'],
  ['Cart-Horse Kick', "He didn't like the look of you either."],
  ['Nettle Patch', 'A gentle shove, a soft landing, six hours of regret.'],
  ['Falling Roof Tile', 'Slate, from a great height, with excellent aim.'],
  ['Rabid Mongrel', 'The dog was fine yesterday. Probably.'],
  ['Hot Poker Handle', "Someone left it in the fire. Someone knew you'd grab it."],
  ['Ale-Slick Stairs', 'Every tavern has that one step.'],
  ['Runaway Barrel', 'Downhill, gathering speed, full of pickled herring.'],
  ['Pig Stampede', 'Market day. Forty pigs. One narrow lane.'],
  ['Blow Dart from the Hedge', 'A tiny thorn, a tiny whistle, a great deal of swelling.'],
  ['Tainted Stew', 'The meat was… ambitious.'],
  ['Hidden Rake', 'Ancient. Reliable. Face-height.'],
  ['Root-Cellar Trapdoor', 'Left open, in the dark, just for you.'],
  ['Mousetrap in the Boot', 'Snap.'],
  ['Bucket Down the Well', 'Somebody let go of the rope.'],
  ['Hornets in the Hood', "You'll find them when you put it on."],
  ['Ferret in the Trousers', 'Traditional. Unpleasant. Hilarious to everyone else.'],
  ["The King's Swan", 'The bird is protected by law. You are not.'],
  ['Greased Ladder', 'Third rung. Every time.'],
  ['Turnip from the Pillory Crowd', 'Not aimed at you. Hit you anyway.'],
];
const CALAMITIES: [string, string][] = [
  ['Cathedral Scaffold', 'Two hundred years to build, two seconds to fall off.'],
  ['Bear in the Woodpile', "Nobody knows how long it's been in there."],
  ['Trebuchet Practice', 'The engineers sincerely apologize.'],
  ['Staked Pit', 'Dug for boar. Covered with leaves. Ready for you.'],
  ['Runaway Millstone', 'Two tons, downhill, spinning.'],
  ['Boiling Pitch', 'Poured from the walls, and the walls were quite sure you were the enemy.'],
  ['Portcullis', 'Timed to the second. The second was yours.'],
  ['Falling Church Bell', 'The rope frayed. The bell rang once.'],
  ['Boar Charge', 'It was cornered. So were you.'],
  ['Through the Ice', 'The river looked solid. The river lied.'],
  ['Drowned in Malmsey', 'A full butt of sweet wine. There are worse ways to go, but not many.'],
  ['Nightshade Tart', 'The berries were the wrong kind of purple.'],
];

type SigSpec = { name: string; text: string; attack?: number; pierce?: boolean };
const SIGNATURES: Record<Trade, SigSpec[]> = {
  blacksmith: [
    { name: 'Silver Dagger', text: 'Attack. Cannot be voided by a Protect.', attack: 1, pierce: true },
    { name: 'Grindstone', text: 'Next round, each Attack revealed in this pile deals 1 extra wound.' },
    { name: 'Iron Strongbox', text: "The pile's owner picks any track. For the rest of the game it ignores every effect that would take gold from it." },
  ],
  farmer: [
    { name: 'Hearty Stew', text: "The pile's owner heals 2." },
    { name: 'Bumper Crop', text: "The Farmer track gains 1; the pile's owner heals 1." },
    { name: 'Gleaning', text: 'The poorest track gains 2.' },
  ],
  thief: [
    { name: 'Cutpurse', text: 'Move 2 gold from the richest track other than the Thief track to the Thief track.' },
    { name: 'Blackmail', text: "Scoring card: stays in front of the pile's owner. At the final count their trade loses 1 gold and the Thief track gains 1." },
    { name: 'Sneak Attack', text: 'Attack dealing 2 wounds. Cannot be voided by a Protect.', attack: 2, pierce: true },
  ],
  innkeeper: [
    { name: 'Strong Ale', text: "The pile's owner is drunk: their entire hand is shown to everyone for five seconds." },
    { name: 'A Round on the House', text: 'Every player heals 1.' },
    { name: 'Bad Batch', text: 'All Heals revealed in this pile this round are voided.' },
  ],
  'city-guard': [
    { name: 'Night Patrol', text: 'Void one Attack in this pile and one in each neighboring pile.' },
    { name: 'Curfew', text: 'Next round, every Attack revealed anywhere is voided.' },
    { name: 'Inquest', text: "The pile's owner must truthfully answer: did you place any Attack this round?" },
  ],
  carpenter: [
    { name: 'Palisade', text: 'A second Protect: voids every Attack in this pile this round.' },
    { name: 'Trestle Market', text: 'Next round, every job card banks +1.' },
    { name: 'Rotten Beam', text: 'Next round, Protects revealed in this pile are voided.' },
  ],
  jeweler: [
    { name: "King's Commission", text: 'The Jeweler track gains 2.' },
    { name: 'Appraisal', text: "The pile's owner must truthfully announce how many job cards remain in their hand." },
    { name: 'Paste Gems', text: 'The richest track loses 2.' },
  ],
  tailor: [
    { name: 'False Colors', text: "Banks 1 gold to any track of the pile owner's choice." },
    { name: 'Cloak of Plain Cloth', text: 'Next round, all Attacks revealed in this pile are voided.' },
    { name: 'Sunday Best', text: "The Tailor track gains 1. Scoring card: the pile's owner's trade scores +1 at game end." },
  ],
  apothecary: [
    { name: 'Panacea', text: "Remove every wound from the pile's owner." },
    { name: 'Slow Poison', text: 'At the end of next round the owner takes 1 wound — voided if any Heal is revealed in this pile first. Protects do not stop it.' },
    { name: "Physician's Fee", text: 'The Apothecary track gains 1 per wound currently in play (max 3).' },
  ],
  hunter: [
    { name: 'Hunting Bow', text: 'Attack dealing 2 wounds.', attack: 2 },
    { name: 'Snare', text: 'Stays on the pile: the next Attack revealed here is voided; when it springs, the Hunter track gains 1.' },
    { name: 'Tracks in the Snow', text: "The pile's owner must truthfully announce how many Attacks they have placed so far this game." },
  ],
  woodsman: [
    { name: 'Felling Axe', text: 'Attack; also discards every pending and persistent card on this pile.', attack: 1 },
    { name: 'Cordwood', text: 'The Woodsman track gains 1 — or 2 during Winter.' },
    { name: 'Deep Forest', text: 'Next round, every card revealed in this pile has no effect, and job cards there bank nothing.' },
  ],
  miller: [
    { name: "Miller's Toll", text: 'The Miller track gains 1 for every two job cards revealed in this pile (max 3).' },
    { name: 'Thumb on the Scale', text: 'Every track richer than the Miller track loses 1.' },
    { name: 'Broken Door', text: 'Attack; before voids are applied, discard one Protect card from this pile.', attack: 1 },
  ],
};

export const CARDS: Record<string, CardDef> = {};
function add(def: CardDef) { CARDS[def.key] = def; }

add({ key: 'heal', name: 'Heal', type: 'heal', text: "Remove one wound from the pile's owner.", art: 'basic-heal' });
add({ key: 'protect', name: 'Protect', type: 'protect', text: 'Void every Attack in this pile (Winter: one Attack).', art: 'basic-protect' });
for (const t of TRADES) {
  add({ key: `job:${t}`, name: `${TRADE_INFO[t].name}'s Wares`, type: 'job', trade: t, text: `Bank 1 gold to the ${TRADE_INFO[t].name} track.`, art: `wares-${slug(TRADE_INFO[t].name)}` });
  for (const s of SIGNATURES[t]) {
    add({ key: `sig:${slug(s.name)}`, name: s.name, type: s.attack ? 'attack' : 'signature', trade: t, wounds: s.attack, pierce: s.pierce, text: s.text, art: `sig-${slug(s.name)}` });
  }
}
for (const [n, f] of MISHAPS) add({ key: `mishap:${slug(n)}`, name: n, type: 'attack', kind: 'mishap', wounds: 1, text: 'Attack: 1 wound.', flavor: f, art: `mishap-${slug(n)}` });
for (const [n, f] of CALAMITIES) add({ key: `calamity:${slug(n)}`, name: n, type: 'attack', kind: 'calamity', wounds: 2, text: 'Attack: 2 wounds.', flavor: f, art: `calamity-${slug(n)}` });

export const MISHAP_KEYS = MISHAPS.map(([n]) => `mishap:${slug(n)}`);
export const CALAMITY_KEYS = CALAMITIES.map(([n]) => `calamity:${slug(n)}`);
export function signatureKeys(t: Trade): string[] { return SIGNATURES[t].map((s) => `sig:${slug(s.name)}`); }
export function def(key: string): CardDef {
  const d = CARDS[key];
  if (!d) throw new Error(`unknown card ${key}`);
  return d;
}
export function isAttack(key: string): boolean { return def(key).type === 'attack'; }
export function isJob(key: string): boolean { return def(key).type === 'job'; }
export function isHeal(key: string): boolean { return def(key).type === 'heal' || key === 'sig:hearty-stew' || key === 'sig:panacea'; }
export function roleArt(t: Trade): string { return `role-${slug(TRADE_INFO[t].name)}`; }

export const CREST_COLORS = ['crimson', 'azure', 'emerald', 'gold', 'violet', 'umber', 'ivory', 'teal', 'rose', 'slate', 'amber', 'moss'];
