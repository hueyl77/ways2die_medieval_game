# A Million Ways to Die in Medieval — Technical Specification (v1.0)

Companion to `PRD.md`. Everything here is implemented in this repository.

---

## 1. Architecture

```
Browser (Vite + React 19 + TypeScript + Tailwind 3.4 + Framer Motion)
   │  @insforge/sdk  (auth, functions.invoke, realtime)
   ▼
InsForge project  nmah6d87.us-west.insforge.app
   ├─ Auth            email/password (+ OAuth providers when enabled)
   ├─ Edge function   `game`  — the ONLY path that reads/writes game tables
   │     bundled from  engine/ (pure rules engine) + functions/src/game.ts
   ├─ Postgres        games · seats · seat_private · cards · rounds · game_events
   │     RLS: no client policies on game tables (server-only via admin key)
   ├─ Realtime        channel  game:<id>   (trigger on games.version → "state_changed")
   │                  channel  chat:<id>   (clients publish; RLS = seat members)
   └─ Deployments     the built SPA (vercel.json rewrite for SPA routing)
```

**Server authority.** Clients never touch game tables. Every read is `game` → `op: "state"` which returns a *projection* for the calling user: all public information plus that user's private information (hand, role, heir, grave pool if dead). Every write is an `op` validated against the stored state. Anonymity is therefore a server property: `cards.placed_by_seat` exists in the database and is never projected.

**Determinism.** The engine is a pure module: `(state, action, rng) → (state, events)`. The RNG is a seeded mulberry32 stored per game; shuffles are reproducible from the log. The same module runs in the Deno edge function and in the Node test harness.

## 2. Repository layout

```
web/                      Vite SPA (deployed to InsForge hosting from this directory)
  src/engine/             pure TypeScript rules engine (no I/O) — shared by the SPA, the edge function and the tests
    cards.ts              card catalog: trades, signatures, mishaps, basics, art ids
    types.ts              GameState, Seat, CardInst, LogEvent, PlayerView
    rng.ts                mulberry32 + shuffle
    engine.ts             createGame, placement, resolution, funerals, scoring, deadlines
    project.ts            projectFor(state, userId) → PlayerView (hides secrets)
  src/lib/                insforge.ts (SDK client), api.ts (typed `game` invoker), cards.ts (art urls)
  src/auth/               AuthProvider (email+code verification, OAuth)
  src/state/              useGame (realtime + state fetch + deadline tick), useChat
  src/pages/              Login, Home, Room (lobby), Game (table), Rules, Dev (local harness, dev only)
  src/components/         Table, Hand, Card, GoldBoard/Calendar, Chat, RevealPlayer, Modals, ui
  public/cards/           downscaled card art (jpg, 560px), keyed by art id; public/rules.html
functions/
  src/game.ts             HTTP handler (Deno): auth, op router, load/save, realtime bump
  dist/game.js            esbuild bundle (deployed artifact; generated)
tests/sim.test.ts         random-play simulation + invariants (node)
migrations/               InsForge SQL migrations
docs/                     PRD.md, TECH_SPEC.md
rules/                    rulebook (md + html)
art/                      Ludo.ai originals + generator scripts (not deployed)
```

## 3. Data model (Postgres, schema `public`)

All tables: `ENABLE ROW LEVEL SECURITY` with **no policies** for `anon`/`authenticated` (so PostgREST denies everything). The edge function uses the project admin client.

```sql
games (
  id uuid pk, code text unique (6 chars), host_user_id uuid → auth.users,
  status text  -- lobby | playing | finished
  settings jsonb, seat_count int, round int, season text, phase text,
  -- phase: lobby | gossip | placement | reveal | funeral | ended
  phase_deadline timestamptz, rng_state int, version int, created_at, updated_at
)
seats (
  game_id uuid, seat_index int, user_id uuid null, name text, crest text,
  is_townsfolk bool, alive bool, wounds int, wound_tokens int, died_round int,
  revealed_trade text null,            -- set at funeral / final reveal
  locked bool, ready bool, afk_rounds int, last_seen timestamptz,
  pk (game_id, seat_index)
)
seat_private (                          -- never projected to other users
  game_id, seat_index, trade text, heir_seat int null, pk (game_id, seat_index)
)
cards (
  id uuid pk, game_id, card_key text, owner_seat int,            -- whose hand it came from
  zone text,  -- hand | placed | revealed | wound | scoring | pending | town_square | grave_pool | box
  pile_seat int null, placed_by_seat int null,                  -- secret
  round_placed int null, meta jsonb
)
rounds (game_id, round int, log jsonb, resolved_at timestamptz, pk (game_id, round))
game_events (id bigserial, game_id, created_at, kind text, payload jsonb)  -- playtest log
```

Indexes: `cards(game_id, zone)`, `cards(game_id, pile_seat)`, `seats(user_id)`, `games(code)`.

**Storage choice.** State is normalized in tables (not one JSONB blob) so the playtest log and future analytics can query it, but the edge function loads a whole game into memory, runs the engine, and writes back in one transaction-like sequence (see §5.4).

### Realtime
```sql
insert into realtime.channels (pattern, description, enabled) values ('game:%','game state bumps',true), ('chat:%','gossip chat',true);
-- trigger: after update of version on games → realtime.publish('game:'||id, 'state_changed', {version, phase})
-- RLS: subscribe to game:<id> / chat:<id> only if public.is_game_member(id); publish to chat only if member.
```

## 4. Edge function `game`

`POST /functions/game` with `Authorization: Bearer <user access token>`, body `{ op, gameId?, ...args }`. Returns `{ ok, state?: PlayerView, error? }`.

| op | args | who | effect |
|---|---|---|---|
| `create` | `{ name, settings }` | any user | new game in `lobby`, host seated, returns code |
| `join` | `{ code, crest? }` | any user | seats the user; rejoin if already seated |
| `leave` | `{ gameId }` | seated, lobby only | removes seat |
| `settings` | `{ gameId, settings }` | host, lobby | update timers/townsfolk |
| `start` | `{ gameId }` | host | seats = max(table size 4–12, humans); empty seats become bots (Townsfolk); runs `createGame`, phase `gossip` |
| `state` | `{ gameId }` | member | projection for caller |
| `ready` | `{ gameId }` | living member | gossip ready; all ready → `placement` |
| `place` | `{ gameId, placements: {pileSeat: cardId}, haunt?: cardId→pileSeat }` | living or ghost | validates and stores; sets `locked`; all locked → resolve |
| `choose` | `{ gameId, choiceId, value }` | pile owner (or Crier for Townsfolk) | answers a pending choice (Strongbox track, tie-break, False Colors) |
| `will` | `{ gameId, heirSeat }` | dead, unsealed | seals the will |
| `continue` | `{ gameId }` | member | "Next" on the current reveal scene; when every human has clicked (or skipped, or the scene timer expires) the table advances one scene; after the last scene → funerals / next round |
| `skip` | `{ gameId }` | member | skips the rest of the reveal for that player (counts as Next on every remaining scene) |
| `bot` | `{ gameId, action: 'add' \| 'remove' }` | host, lobby | grows/shrinks the table size; empty seats become bots at start |
| `chat` | *(not an op)* | — | realtime publish from the client |
| `tick` | `{ gameId }` | any member | applies deadline effects (AFK auto-play, timeouts); called by clients when a deadline passes |

Errors: `401 unauthorized`, `403 not_member / not_host / wrong_phase`, `400 invalid_placement / invalid_choice`, `409 stale` (state version changed; client refetches).

### 4.1 Request handling
1. CORS preflight.
2. Resolve user via `client.auth.getCurrentUser()` from the bearer token.
3. Load game + seats + seat_private + cards + last round with the admin client.
4. Rehydrate `GameState`, run the op (engine call), collect `events`.
5. Persist: diff-write cards (by id), upsert seats/private, update game (`version = version + 1`) — the version update fires the realtime trigger.
6. Return the caller's projection.

Concurrency: ops carry the client's `version`; if it doesn't match, respond `409` (the client already subscribed to `state_changed` and refetches). Placement writes are idempotent per seat.

## 5. Engine

### 5.1 Setup (`createGame`)
Inputs: seats (`{ seatIndex, userId|null, name, isTownsfolk }`), settings, seed.
- Seat count → calendar row (rounds, seasons, jobs kept, death threshold) from the rulebook table.
- Shuffle the 12 trades; deal one per seat; the rest are `absent` (secret).
- Per seat: `jobsKept` job cards of its trade, 2 heals, 1 protect, 3 signatures; from the shared mishap deck 4 Mishaps + 1 Calamity; unused mishaps → `box`.
- Townsfolk: same cards, `zone: hand`, played by `randomPlacement()` each round.
- Succession: crest set = the human seats' crests.
- Round 1, season per calendar, phase `gossip`.

### 5.2 Round state machine
```
placement (gossip happens here; no Ready step) ──(all locked | timer)──▶ resolve (server, atomic)
   ▲                                                                       │
   │                     ┌── funeral(s): dead seats seal wills (timer → random heir)
   └── cleanup/next ◀── reveal (clients animate; all `continue` | timer) ◀┘
                     └── season end events; last round → ended (final reveal, scoring)
```
Choice cards create `pendingChoices` during resolve; resolution pauses at that step until answered (or defaults on timeout), then continues — the round log records both halves.

### 5.3 Resolution order (global, simultaneous)
1. Every pile is shuffled (`rng`) and revealed.
2. **Voids** across all piles: Broken Door (discard one Protect in its pile), Protect and Palisade (all attacks in pile; Winter variant: one), Snare (next attack), Night Patrol (one attack here + each neighbor), Curfew (pending from last round: every attack anywhere), Cloak of Plain Cloth (pending), Deep Forest (pending: everything in pile has no effect), Bad Batch (heals in pile), Rotten Beam (pending: protects in pile). Silver Dagger and Sneak Attack ignore Protect/Palisade only.
3. **Wounds**: each surviving attack → wound cards/tokens on the pile owner (Calamity 2, Hunting Bow 2, Sneak Attack 2, Grindstone +1 pending).
4. **Heals**: Heal, Hearty Stew (2), Bumper Crop (1 + gold), Panacea (all), A Round on the House (everyone 1); Slow Poison antidote consumes a heal in that pile.
5. **Deaths**: wounds ≥ threshold → mark dead (funeral after the round).
6. **Gold**: job cards bank 1 (+Market Fair, +Trestle Market pending); then gold signatures clockwise from the Crier: Cutpurse, Paste Gems, Gleaning, Thumb on the Scale, King's Commission, Miller's Toll, Physician's Fee, Cordwood, Bumper Crop, False Colors (choice), Iron Strongbox (choice → shield), Snare bounty, Sunday Best/Blackmail → scoring cards on the owner. Iron Strongbox shields apply to every loss.
7. **Words**: Inquest / Appraisal / Tracks in the Snow computed from the true state (Townsfolk piles: no effect); Strong Ale → `revealHand(seat, 5s)` event.
8. **Pending**: Grindstone, Curfew, Cloak, Trestle Market, Rotten Beam, Deep Forest, Slow Poison, Snare(persistent) recorded on the pile for next round; expired ones discarded.
9. Locked tracks (dead trades) ignore all gold changes. Every living seat, bots included, is eligible to win.
9b. **Alms** (one per envelope): the placer names a trade; at the gold step, if that trade is last or second-to-last among trades held by living seats, it gains 5.
9c. Optional leader rules behind `settings.leaderRules` (off, no lobby toggle): the Reeve's tithe (each track pays floor(gold/8) after every round) and the Reckoning (the richest living trade is unmasked at the start of the final round).
10. Season events (only when `settings.seasonRules` — the optional Turning Year variant — is on): Market Fair (+1 per wares in Harvest), Reeve's Tax at the end of Harvest, and the Hungry Winter (a Protect voids one Attack). Off by default: every round plays the same.

### 5.4 Persistence
The engine's state is serializable JSON and is stored whole in `games.snapshot` (jsonb; ~60–150 KB for a 12-seat game) as the single source of truth, with `games.version` for optimistic concurrency (`UPDATE … WHERE version = loaded`; a lost race returns 409 and the client refetches). Round logs are appended to `rounds` and every player op to `game_events` for the playtest export. The per-card `cards`/`seats` tables in §3 were dropped from v1 in favour of this snapshot-only design; §3 below is superseded by `migrations/*_init.sql`.

### 5.5 Projection (`projectFor`)
Public: seats (names, crests, alive, wounds, tokens, revealed trades, scoring/pending cards, pile counts, lock/ready flags), gold board, calendar, phase & deadline, current round log (after resolve), succession status, chat is separate.
Private to caller: own trade, own hand, own placements this round, own heir, own grave pool (if dead), pending choices addressed to them, Strong Ale reveal payloads (public to all for 5 s, then dropped from state).
Never: other hands, `placed_by_seat`, absent trades, other heirs.

## 6. Card catalog (keys)

Basics: `heal`, `protect`, `job:<trade>`; mishaps `mishap:<slug>` (24, 1 wound), `calamity:<slug>` (12, 2 wounds); signatures `sig:<slug>` (36). The catalog carries `name`, `type`, `wounds`, `text`, `art` (image id) and an `effect` handler key. Adding a card = one catalog entry + one handler.

## 7. Client

- **Auth**: `AuthProvider` with `{ user, loading }`; routes `/login`, `/signup`, `/reset`; guarded routes.
- **Lobby**: `/` create/join; `/room/:code` seat list, settings, ready, start.
- **Table**: `/game/:id` — `useGame(id)` subscribes to `game:<id>` and refetches `state` on `state_changed`; `useChat(id)` subscribes/publishes `chat:<id>`.
- **Animation**: `engine/scenes.ts` turns `roundLog.events` into an ordered list of scenes (one per pile, then wounds, deaths, the ledger, truth cards, pendings, season events). The server stores the current scene index (`revealStep`) and advances it in lockstep: every human clicks Next (`continue`), or skips the rest (`skip`), or the per-scene timer (`revealStepSeconds`, default 20 s) expires. `RevealPlayer` renders the current scene with Framer Motion; "Faster" only changes the local stagger.
- **Placement**: `dnd` via pointer events (no library), tap-select fallback; keyboard: 1–9 select card, seat letters to place.
- **Assets**: `public/cards/<art>.webp` at 420×560; card back for face-down.

## 8. Security & fairness
- Game tables have no client policies; only the function (admin key from function env) reads them.
- The function verifies membership and phase for every op; placements are validated against the caller's hand.
- Chat channel RLS restricts subscribe/publish to seated users; presence exposes user ids only to members.
- No secrets in the SPA except the anon key. The Ludo.ai key is never stored in the repo.
- Rate: one `place` per seat per round; `state` is cheap (single row + projection).

## 9. Build, deploy, test

```bash
# backend
npx -y @insforge/cli db migrations up --all
npm run build:function        # esbuild engine + handler → functions/dist/game.js
npx -y @insforge/cli functions deploy game --file functions/dist/game.js
# frontend
cd web && npm run build && npx -y @insforge/cli deployments deploy .   # env: VITE_INSFORGE_URL, VITE_INSFORGE_ANON_KEY
# tests
npm run test:engine           # node: 2,000 random games, invariants + snapshot determinism
```

Invariants checked by the simulation: hand sizes = piles × remaining rounds; every seat holds exactly 4 mishaps + 1 calamity at setup; no card duplicated across zones; gold never negative; wounds ≥ 0; dead seats never place; game always terminates; projection never contains another seat's hand or `placed_by_seat`.

## 10. Art pipeline
Ludo.ai batch (Western Cartoon, `card-art`, 3:4) → `art/full/*.webp` → `sips` downscale to 420 px → `web/public/cards/`. `engine/cards.ts` maps each card key to its art id; missing art falls back to a typed placeholder card.
