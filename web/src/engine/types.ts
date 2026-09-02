import type { Trade } from './cards.ts';

export type Season = 'spring' | 'harvest' | 'winter';
export type Phase = 'lobby' | 'gossip' | 'placement' | 'choice' | 'reveal' | 'funeral' | 'ended';
export type Zone =
  | 'hand' | 'placed' | 'revealed' | 'wound' | 'scoring' | 'pending'
  | 'town_square' | 'grave_pool' | 'box' | 'shield';

export interface CardInst {
  id: string;
  key: string;
  ownerSeat: number;          // whose envelope it came from (secret)
  zone: Zone;
  pileSeat: number | null;    // pile it sits in / seat it affects
  placedBy: number | null;    // secret, never projected
  roundPlaced: number | null;
  meta: Record<string, number | string | boolean | null>;
}

export interface Seat {
  index: number;
  userId: string | null;
  name: string;
  crest: string;
  isTownsfolk: boolean;
  alive: boolean;
  woundTokens: number;
  diedRound: number | null;
  revealedTrade: Trade | null;
  locked: boolean;
  ready: boolean;
  ack: boolean;                // clicked Next for the current reveal scene
  skipReveal: boolean;         // skipped the rest of this reveal
  afkRounds: number;
  attacksPlaced: number;
  // secrets
  trade: Trade;
  heir: number | null;
  willSealed: boolean;
}

export interface Calendar {
  rounds: number;
  seasons: Season[];      // one entry per round
  jobsKept: number;
  deathAt: number;
}

export interface Settings {
  gossipSeconds: number;
  placementSeconds: number;
  choiceSeconds: number;
  revealSeconds: number;         // legacy, unused
  revealStepSeconds: number;     // timer per reveal scene
  funeralSeconds: number;
  extraTownsfolk: number;        // legacy, unused
  tableSize: number;             // 4–12 seats; empty seats become bots
  seasonRules: boolean;          // optional variant: Market Fair, Reeve's Tax, Hungry Winter (off = every round plays the same)
  leaderRules: boolean;          // optional variant: the Reeve's tithe every round + the Reckoning in the final round (off by default)
  revealPlacementsAtEnd: boolean;
}

export type LogEvent =
  | { t: 'round_start'; round: number; season: Season }
  | { t: 'reveal'; pileSeat: number; cards: { id: string; key: string }[]; grave: boolean }
  | { t: 'void'; pileSeat: number; cardId: string; cardKey: string; by: string }
  | { t: 'discard'; pileSeat: number; cardId: string; cardKey: string; by: string }
  | { t: 'wound'; seat: number; amount: number; cardKey: string; total: number }
  | { t: 'heal'; seat: number; amount: number; cardKey: string; total: number }
  | { t: 'poison_set'; seat: number }
  | { t: 'death'; seat: number; trade: Trade; name: string }
  | { t: 'gold'; trade: Trade; delta: number; by: string; from?: Trade; absorbed?: boolean; pileSeat?: number; cardId?: string }
  | { t: 'shield'; trade: Trade; by: string }
  | { t: 'scoring'; seat: number; cardKey: string }
  | { t: 'pending'; pileSeat: number; cardKey: string; untilRound: number | null }
  | { t: 'truth'; seat: number; cardKey: string; answer: string }
  | { t: 'reveal_hand'; seat: number; cards: string[]; cardKey: string }
  | { t: 'choice_wait'; seat: number; cardKey: string }
  | { t: 'chosen'; seat: number; cardKey: string; trade: Trade; auto: boolean }
  | { t: 'season_event'; kind: 'reeves-tax'; trades: Trade[] }
  | { t: 'reckoning'; seats: { seat: number; trade: Trade; gold: number }[] }
  | { t: 'alms'; pileSeat: number; trade: Trade; granted: boolean; rank: number }
  | { t: 'tax'; pileSeat: number; cards: number }
  | { t: 'banner'; text: string }
  | { t: 'final_reveal'; seats: { seat: number; trade: Trade }[] }
  | { t: 'final_score'; rows: ScoreRow[]; winners: number[]; sharedBy: number[] };

export interface ScoreRow {
  seat: number; trade: Trade; base: number; wounds: number; scoring: number; total: number; eligible: boolean;
}

export interface RoundLog { round: number; events: LogEvent[]; complete: boolean }

export interface Choice {
  id: string;
  seat: number;            // who answers (Crier for townsfolk piles)
  cardId: string;
  cardKey: string;
  kind: 'track';
  options: Trade[];
  answer: Trade | null;
}

export interface GameState extends Record<string, unknown> {
  id: string;
  code: string;
  hostUserId: string;
  status: 'lobby' | 'playing' | 'finished';
  seed: number;
  rng: number;
  settings: Settings;
  seatCount: number;
  calendar: Calendar;
  round: number;
  phase: Phase;
  phaseDeadline: number | null;   // epoch ms
  crierSeat: number;
  revealStep: number;          // current reveal scene index
  revealSteps: number;         // total scenes in this reveal
  seats: Seat[];
  cards: CardInst[];
  gold: Record<string, number>;
  lockedTrades: Trade[];
  shieldedTrades: Trade[];
  absentTrades: Trade[];           // secret
  succession: number[];            // seat indexes whose crest is still in the stack
  choices: Choice[];
  taxedPiles: number[];            // piles visited by a Tax Collector this round
  curfewVoids?: number;            // attacks stopped by a Curfew this round (the Guard is paid per void)
  roundLog: RoundLog | null;
  logs: RoundLog[];
  nextCardId: number;
  winners: number[] | null;
  sharedBy: number[] | null;
  scoreRows: ScoreRow[] | null;
  // per-round scratch (server only)
  placementsThisRound: Record<number, Record<number, string>>; // seat -> pileSeat -> cardId
}

export interface CardView { id: string; key: string; meta: Record<string, number | string | boolean | null> }

export interface SeatView {
  index: number; userId: string | null; name: string; crest: string; isTownsfolk: boolean; alive: boolean;
  wounds: number; woundCards: CardView[]; woundTokens: number; diedRound: number | null;
  revealedTrade: Trade | null; locked: boolean; ready: boolean; ack: boolean; skipReveal: boolean;
  scoringCards: CardView[]; pendingCards: CardView[]; pileCount: number; gravePoolCount: number;
  handCount: number; willSealed: boolean; isMe: boolean;
}

export interface PlayerView {
  id: string; code: string; hostUserId: string; status: GameState['status'];
  settings: Settings; seatCount: number; calendar: Calendar; round: number; season: Season | null;
  phase: Phase; phaseDeadline: number | null; crierSeat: number; version: number;
  revealStep: number; revealSteps: number; revealWaitingOn: number[];
  seats: SeatView[]; gold: Record<string, number>; lockedTrades: Trade[]; shieldedTrades: Trade[];
  succession: number[]; roundLog: RoundLog | null; logs: RoundLog[];
  winners: number[] | null; sharedBy: number[] | null; scoreRows: ScoreRow[] | null;
  me: {
    seat: number | null; trade: Trade | null; hand: CardView[]; placements: Record<number, string>;
    heir: number | null; gravePool: CardView[]; choices: Choice[]; isGhost: boolean; hauntUsed: boolean;
  };
  serverNow: number;
}
