import { insforge } from './insforge';
import { getGuest, type Guest } from './guest';
import type { PlayerView, Settings } from '../engine/types.ts';

export interface ApiOk { ok: true; state: PlayerView | null; games?: GameSummary[]; guest?: Guest }
export interface ApiErr { ok: false; error: string; message?: string }
export interface GameSummary { id: string; code: string; status: string; phase: string; round: number; seat: number; updated_at: string }

export class ApiError extends Error { code: string; constructor(code: string, message?: string) { super(message ?? code); this.code = code; } }

export async function game(op: string, args: Record<string, unknown> = {}): Promise<ApiOk> {
  const guest = getGuest();   // guests carry their signed token in the body; signed-in users are known from their bearer token
  const { data, error } = await insforge.functions.invoke('game', { body: { op, ...args, ...(guest ? { guest: guest.token } : {}) } });
  if (error) throw new ApiError((error as { message?: string }).message ?? 'network', (error as { message?: string }).message);
  const res = data as ApiOk | ApiErr;
  if (!res || !('ok' in res)) throw new ApiError('bad_response');
  if (!res.ok) throw new ApiError(res.error, res.message);
  return res;
}

export const api = {
  guest: (name: string) => game('guest', { name }),
  create: (name: string, settings?: Partial<Settings>) => game('create', { name, settings }),
  join: (code: string, name: string) => game('join', { code, name }),
  mine: () => game('mine'),
  state: (gameId: string) => game('state', { gameId }),
  leave: (gameId: string) => game('leave', { gameId }),
  cancel: (gameId: string) => game('cancel', { gameId }),
  lobbyReady: (gameId: string, ready: boolean) => game('ready', { gameId, ready }),
  crest: (gameId: string, crest: string) => game('crest', { gameId, crest }),
  settings: (gameId: string, settings: Partial<Settings>) => game('settings', { gameId, settings }),
  bot: (gameId: string, action: 'add' | 'remove') => game('bot', { gameId, action }),
  start: (gameId: string) => game('start', { gameId }),
  ready: (gameId: string) => game('ready', { gameId }),
  place: (gameId: string, placements: Record<string, string>, haunt: { cardId: string; pileSeat: number } | null) => game('place', { gameId, placements, haunt }),
  choose: (gameId: string, choiceId: string, trade: string) => game('choose', { gameId, choiceId, trade }),
  will: (gameId: string, heir: number) => game('will', { gameId, heir }),
  acknowledge: (gameId: string) => game('continue', { gameId }),
  skip: (gameId: string) => game('skip', { gameId }),
  tick: (gameId: string) => game('tick', { gameId }),
};

export const ERROR_TEXT: Record<string, string> = {
  not_found: 'No room with that code.', game_started: 'That game has already started.', full: 'That room is full (12 seats).',
  need_a_player: 'Someone has to sit down first.', not_alone: 'Only the last player at the table can cancel the game.', not_host: 'Only the host can do that.', stale: 'The table moved on — try again.',
  invalid_placement: 'Place exactly one card in front of every seat.', unauthorized: 'Please sign in again.',
};
export const errorText = (e: unknown) => (e instanceof ApiError ? ERROR_TEXT[e.code] ?? e.message ?? e.code : String(e));
