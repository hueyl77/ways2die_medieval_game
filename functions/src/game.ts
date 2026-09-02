// Edge function `game` — the only path that reads or writes game tables.
// Bundled with esbuild (engine inlined; npm:@insforge/sdk external).
import { createClient, createAdminClient } from 'npm:@insforge/sdk';
import {
  createGame, setReady, submitPlacement, answerChoice, acknowledge, revealSkip, sealWill, tick, projectFor, convertToBot, humanCount,
  RuleError, DEFAULT_SETTINGS, CREST_COLORS, seedFrom, type GameState, type PlayerView, type Settings,
} from '../../web/src/engine/index.ts';

declare const Deno: { env: { get(k: string): string | undefined } };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

interface LobbySeat { userId: string; name: string; crest: string; ready: boolean }
interface LobbySnapshot { lobby: true; seats: LobbySeat[]; settings: Settings; bots?: number }
const BOT_NAMES = ['Bot Marta', 'Bot Bram', 'Bot Odo', 'Bot Ysolde', 'Bot Piers', 'Bot Agnes', 'Bot Wat', 'Bot Hild', 'Bot Cedric', 'Bot Rowan', 'Bot Edith'];
interface GameRow { id: string; code: string; host_user_id: string; status: string; phase: string; round: number; version: number; settings: Settings; snapshot: LobbySnapshot | GameState | null }

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clampInt = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
/** Seats at the table = max(table size, humans), capped at 12; the difference is bots. */
const tableSize = (snap: LobbySnapshot) => Math.min(12, Math.max(4, snap.settings.tableSize ?? 4, snap.seats.length));
const botCount = (snap: LobbySnapshot) => tableSize(snap) - snap.seats.length;
function newCode(): string { let c = ''; for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]; return c; }
function cleanName(n: unknown, fallback: string): string { const s = String(n ?? '').replace(/[^\p{L}\p{N} _'.-]/gu, '').trim().slice(0, 20); return s || fallback; }

function lobbyView(row: GameRow, userId: string, now: number): PlayerView {
  const snap = row.snapshot as LobbySnapshot;
  const blank = { alive: true, wounds: 0, woundCards: [], woundTokens: 0, diedRound: null, revealedTrade: null, locked: false, ack: false, skipReveal: false, scoringCards: [], pendingCards: [], pileCount: 0, gravePoolCount: 0, handCount: 0, willSealed: false };
  const seats = [
    ...snap.seats.map((s, i) => ({ ...blank, index: i, userId: s.userId, name: s.name, crest: s.crest, isTownsfolk: false, ready: s.ready, isMe: s.userId === userId })),
    ...Array.from({ length: botCount(snap) }, (_, i) => ({ ...blank, index: snap.seats.length + i, userId: null, name: BOT_NAMES[i % BOT_NAMES.length], crest: 'stranger', isTownsfolk: true, ready: true, isMe: false })),
  ];
  const meIdx = snap.seats.findIndex((s) => s.userId === userId);
  return {
    id: row.id, code: row.code, hostUserId: row.host_user_id, status: 'lobby', settings: snap.settings, seatCount: seats.length,
    calendar: { rounds: 0, seasons: [], jobsKept: 0, deathAt: 0 }, round: 0, season: null, phase: 'lobby', phaseDeadline: null, crierSeat: 0,
    version: row.version, seats, gold: {}, lockedTrades: [], shieldedTrades: [], succession: [], roundLog: null, logs: [],
    winners: null, sharedBy: null, scoreRows: null,
    me: { seat: meIdx >= 0 ? meIdx : null, trade: null, hand: [], placements: {}, heir: null, gravePool: [], choices: [], isGhost: false, hauntUsed: false },
    serverNow: now,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  const apiKey = Deno.env.get('API_KEY');
  if (!baseUrl || !apiKey) return json({ ok: false, error: 'server_misconfigured' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'unauthorized' }, 401);
  const userClient = createClient({ baseUrl, accessToken: token });
  const { data: userData } = await userClient.auth.getCurrentUser();
  const user = userData?.user as { id: string; email?: string; name?: string; profile?: { name?: string } } | undefined;
  if (!user?.id) return json({ ok: false, error: 'unauthorized' }, 401);
  const userId = user.id;
  const defaultName = cleanName(user.profile?.name ?? user.name, (user.email ?? 'villager').split('@')[0].slice(0, 20));

  const admin = createAdminClient({ baseUrl, apiKey });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const op = String(body.op ?? '');
  const now = Date.now();

  const loadById = async (id: string): Promise<GameRow | null> => {
    const { data, error } = await admin.database.from('games').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as GameRow | null) ?? null;
  };
  const save = async (row: GameRow, snapshot: LobbySnapshot | GameState, extra: Partial<GameRow> = {}): Promise<boolean> => {
    const patch: Record<string, unknown> = { snapshot, version: row.version + 1, ...extra };
    if (!('lobby' in snapshot)) { patch.status = snapshot.status; patch.phase = snapshot.phase; patch.round = snapshot.round; }
    const { data, error } = await admin.database.from('games').update(patch).eq('id', row.id).eq('version', row.version).select('id');
    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  };
  const persistLogs = async (row: GameRow, before: number, s: GameState) => {
    for (let i = before; i < s.logs.length; i++) {
      await admin.database.from('rounds').insert([{ game_id: row.id, round: s.logs[i].round, log: s.logs[i] }]);
    }
  };
  const respond = (row: GameRow, snapshot: LobbySnapshot | GameState, version: number) =>
    json({ ok: true, state: 'lobby' in snapshot ? lobbyView({ ...row, snapshot, version }, userId, now) : projectFor(snapshot, userId, version, now) });

  try {
    // ------------------------------------------------------------ create
    if (op === 'create') {
      const settings: Settings = { ...DEFAULT_SETTINGS, ...((body.settings as Partial<Settings>) ?? {}) };
      const name = cleanName(body.name, defaultName);
      const snapshot: LobbySnapshot = { lobby: true, seats: [{ userId, name, crest: CREST_COLORS[0], ready: false }], settings, bots: 0 };
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const { data, error } = await admin.database.from('games').insert([{ code, host_user_id: userId, status: 'lobby', phase: 'lobby', settings, snapshot }]).select('*');
        if (error) { if (/duplicate|unique/i.test(error.message)) continue; throw new Error(error.message); }
        const row = (data as GameRow[])[0];
        await admin.database.from('game_members').insert([{ game_id: row.id, user_id: userId, seat_index: 0, name, crest: CREST_COLORS[0] }]);
        return respond(row, snapshot, row.version);
      }
      return json({ ok: false, error: 'code_collision' }, 500);
    }
    // ------------------------------------------------------------ mine
    if (op === 'mine') {
      const { data, error } = await admin.database.from('game_members').select('game_id, seat_index, games(id, code, status, phase, round, updated_at)').eq('user_id', userId);
      if (error) throw new Error(error.message);
      const rows = (data as { game_id: string; seat_index: number; games: { id: string; code: string; status: string; phase: string; round: number; updated_at: string } }[])
        .map((r) => ({ id: r.game_id, seat: r.seat_index, ...r.games }))
        .filter((g) => g.status !== 'finished')
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      return json({ ok: true, games: rows });
    }
    // ------------------------------------------------------------ join (by code)
    if (op === 'join') {
      const code = String(body.code ?? '').toUpperCase().trim();
      const { data, error } = await admin.database.from('games').select('*').eq('code', code).maybeSingle();
      if (error) throw new Error(error.message);
      const row = data as GameRow | null;
      if (!row) return json({ ok: false, error: 'not_found' }, 404);
      for (let attempt = 0; attempt < 3; attempt++) {
        const fresh = attempt === 0 ? row : (await loadById(row.id))!;
        const snap = fresh.snapshot as LobbySnapshot | GameState;
        if (!('lobby' in snap)) {
          const member = snap.seats.some((s) => s.userId === userId);
          if (!member) return json({ ok: false, error: 'game_started' }, 403);
          return respond(fresh, snap, fresh.version);
        }
        if (snap.seats.some((s) => s.userId === userId)) return respond(fresh, snap, fresh.version);
        if (snap.seats.length >= 12) return json({ ok: false, error: 'full' }, 403);
        const name = cleanName(body.name, defaultName);
        const used = new Set(snap.seats.map((s) => s.crest));
        const crest = CREST_COLORS.find((c) => !used.has(c)) ?? CREST_COLORS[snap.seats.length % CREST_COLORS.length];
        const next: LobbySnapshot = { ...snap, seats: [...snap.seats, { userId, name, crest, ready: false }] };
        if (await save(fresh, next)) {
          await admin.database.from('game_members').insert([{ game_id: fresh.id, user_id: userId, seat_index: next.seats.length - 1, name, crest }]);
          return respond(fresh, next, fresh.version + 1);
        }
      }
      return json({ ok: false, error: 'stale' }, 409);
    }

    // ------------------------------------------------------------ everything else needs a game id + membership
    const gameId = String(body.gameId ?? '');
    if (!gameId) return json({ ok: false, error: 'missing_game' }, 400);
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await loadById(gameId);
      if (!row) return json({ ok: false, error: 'not_found' }, 404);
      const snap = row.snapshot as LobbySnapshot | GameState;
      const isMember = snap.seats.some((s) => s.userId === userId);
      if (!isMember) return json({ ok: false, error: 'not_member' }, 403);

      if ('lobby' in snap) {
        if (op === 'state') return respond(row, snap, row.version);
        let next: LobbySnapshot | null = null;
        if (op === 'leave') {
          const seats = snap.seats.filter((s) => s.userId !== userId);
          if (seats.length === 0) { await admin.database.from('games').delete().eq('id', row.id); return json({ ok: true, state: null }); }
          next = { ...snap, seats };
          const extra: Partial<GameRow> = row.host_user_id === userId ? { host_user_id: seats[0].userId } : {};
          if (await save(row, next, extra)) {
            await admin.database.from('game_members').delete().eq('game_id', row.id).eq('user_id', userId);
            return json({ ok: true, state: null });
          }
          continue;
        }
        if (op === 'ready') next = { ...snap, seats: snap.seats.map((s) => (s.userId === userId ? { ...s, ready: !!(body.ready ?? true) } : s)) };
        else if (op === 'crest') {
          const crest = String(body.crest ?? '');
          if (!CREST_COLORS.includes(crest) || snap.seats.some((s) => s.crest === crest && s.userId !== userId)) return json({ ok: false, error: 'crest_taken' }, 400);
          next = { ...snap, seats: snap.seats.map((s) => (s.userId === userId ? { ...s, crest } : s)) };
        } else if (op === 'bot') {
          if (row.host_user_id !== userId) return json({ ok: false, error: 'not_host' }, 403);
          const action = String(body.action ?? 'add');
          const size = tableSize(snap);
          if (action === 'add' && size >= 12) return json({ ok: false, error: 'full' }, 403);
          next = { ...snap, settings: { ...snap.settings, tableSize: action === 'add' ? size + 1 : Math.max(4, snap.seats.length, size - 1) } };
        } else if (op === 'settings') {
          if (row.host_user_id !== userId) return json({ ok: false, error: 'not_host' }, 403);
          const incoming = (body.settings as Partial<Settings>) ?? {};
          const clamp = clampInt;
          next = { ...snap, settings: {
            ...snap.settings,
            tableSize: clamp(incoming.tableSize, 4, 12, snap.settings.tableSize ?? 4),
            revealStepSeconds: clamp(incoming.revealStepSeconds, 5, 120, snap.settings.revealStepSeconds ?? 20),
            gossipSeconds: clamp(incoming.gossipSeconds, 30, 600, snap.settings.gossipSeconds),
            placementSeconds: clamp(incoming.placementSeconds, 45, 600, snap.settings.placementSeconds),
            revealSeconds: clamp(incoming.revealSeconds, 15, 300, snap.settings.revealSeconds),
            funeralSeconds: clamp(incoming.funeralSeconds, 20, 300, snap.settings.funeralSeconds),
            choiceSeconds: clamp(incoming.choiceSeconds, 10, 120, snap.settings.choiceSeconds),
            extraTownsfolk: clamp(incoming.extraTownsfolk, 0, 2, snap.settings.extraTownsfolk),
            revealPlacementsAtEnd: !!(incoming.revealPlacementsAtEnd ?? snap.settings.revealPlacementsAtEnd),
            seasonRules: !!(incoming.seasonRules ?? snap.settings.seasonRules ?? false),
          } };
        } else if (op === 'start') {
          if (row.host_user_id !== userId) return json({ ok: false, error: 'not_host' }, 403);
          const humans = snap.seats.length;
          if (humans < 1) return json({ ok: false, error: 'need_a_player' }, 400);
          const bots = botCount(snap);
          const specs = [
            ...snap.seats.map((s) => ({ userId: s.userId, name: s.name, crest: s.crest, isTownsfolk: false })),
            ...Array.from({ length: bots }, (_, i) => ({ userId: null, name: BOT_NAMES[i % BOT_NAMES.length], crest: 'stranger', isTownsfolk: true })),
          ];
          const seed = seedFrom(`${row.id}:${now}:${Math.random()}`);
          const state = createGame({ id: row.id, code: row.code, hostUserId: row.host_user_id, seats: specs, settings: snap.settings, seed, now });
          if (await save(row, state)) {
            await admin.database.from('game_events').insert([{ game_id: row.id, user_id: userId, kind: 'start', payload: { seed, seatCount: state.seatCount } }]);
            return respond(row, state, row.version + 1);
          }
          continue;
        } else return json({ ok: false, error: 'wrong_phase' }, 403);
        if (next && (await save(row, next))) return respond(row, next, row.version + 1);
        continue;
      }

      // ---------------------------------------------------------- playing / finished
      const state = snap as GameState;
      const seat = state.seats.find((s) => s.userId === userId)!;
      const logsBefore = state.logs.length;
      let changed = false;
      if (state.status === 'playing') changed = tick(state, now) || changed;
      // ---- leaving a running game: the seat plays on as a bot; a table with no humans left is deleted
      if (op === 'leave') {
        convertToBot(state, seat.index, now);
        if (humanCount(state) === 0) { await admin.database.from('games').delete().eq('id', row.id); return json({ ok: true, state: null }); }
        const extra: Partial<GameRow> = row.host_user_id === userId ? { host_user_id: state.seats.find((s) => s.userId)!.userId! } : {};
        if (await save(row, state, extra)) {
          await persistLogs(row, logsBefore, state);
          await admin.database.from('game_members').delete().eq('game_id', row.id).eq('user_id', userId);
          await admin.database.from('game_events').insert([{ game_id: row.id, user_id: userId, kind: 'leave', payload: { round: state.round, phase: state.phase, seat: seat.index } }]);
          return json({ ok: true, state: null });
        }
        continue;
      }
      // ---- the last human at the table may cancel the game outright (removes it from everyone's saved sessions)
      if (op === 'cancel') {
        if (humanCount(state) !== 1) return json({ ok: false, error: 'not_alone' }, 403);
        await admin.database.from('games').delete().eq('id', row.id);
        return json({ ok: true, state: null });
      }
      try {
        switch (op) {
          case 'state': break;
          case 'ready': if (state.phase === 'gossip') { setReady(state, seat.index, now); changed = true; } break;
          case 'place': submitPlacement(state, seat.index, (body.placements as Record<string, string>) ?? {}, (body.haunt as { cardId: string; pileSeat: number } | null) ?? null, now, (body.targets as Record<string, never>) ?? {}); changed = true; break;
          case 'choose': answerChoice(state, seat.index, String(body.choiceId), body.trade as never, now); changed = true; break;
          case 'will': sealWill(state, seat.index, Number(body.heir), now); changed = true; break;
          case 'continue': if (state.phase === 'reveal') { acknowledge(state, seat.index, now); changed = true; } break;
          case 'skip': if (state.phase === 'reveal') { revealSkip(state, seat.index, now); changed = true; } break;
          case 'tick': break;
          default: return json({ ok: false, error: 'unknown_op' }, 400);
        }
      } catch (e) {
        if (e instanceof RuleError) return json({ ok: false, error: e.code, message: e.message }, 400);
        throw e;
      }
      if (!changed) return respond(row, state, row.version);
      if (await save(row, state)) {
        await persistLogs(row, logsBefore, state);
        if (op !== 'tick' && op !== 'state') await admin.database.from('game_events').insert([{ game_id: row.id, user_id: userId, kind: op, payload: { round: state.round, phase: state.phase, seat: seat.index, placements: op === 'place' ? body.placements ?? null : null, haunt: op === 'place' ? body.haunt ?? null : null } }]);
        return respond(row, state, row.version + 1);
      }
    }
    return json({ ok: false, error: 'stale' }, 409);
  } catch (e) {
    console.error('game function error', e);
    return json({ ok: false, error: 'internal', message: (e as Error).message }, 500);
  }
}
