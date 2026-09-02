# A Million Ways to Die in Medieval — Online Edition
## Product Requirements Document (v1.0)

**Status:** Draft for build · **Owner:** Huey Ly · **Companion docs:** `TECH_SPEC.md`, `rules/` (tabletop rulebook 1.5)

---

## 1. Summary

A browser-based, real-time multiplayer edition of *A Million Ways to Die in Medieval* — a social-deduction card game in which every player secretly runs a medieval trade, earns gold for that trade on a public board, and quietly arranges "accidents" for the neighbors. Nobody ever sees who placed which card. The online edition reproduces the tabletop rules faithfully, automates all bookkeeping (shuffling, resolution, gold, wounds, scoring), animates every reveal, and adds the things only software can do well: a hidden-information server, instant truth-card resolution, timers, and reconnection.

The physical edition will be printed later; this product is also the playtest engine for it.

## 2. Goals

1. **Faithful:** implement rulebook 1.5 exactly, including all 12 trades, 36 signature cards, the 60-card mishap deck, seasons, wounds-cost-gold, Townsfolk, funerals, wills, and haunting.
2. **Fun at a distance:** the gossip phase must feel like a table — voice/text chat, visible reactions, a shared reveal that everyone watches at the same moment.
3. **Legible:** a first-time player can play without reading the rulebook; every card explains itself on hover and every effect is animated when it resolves.
4. **Fair by construction:** hidden information (hands, roles, who-placed-what, heirs) never reaches a client that shouldn't have it. Anonymity is enforced by the server, not the UI.
5. **Playtest-ready:** every game produces a complete log the designer can review to tune the game.

### Non-goals (v1)
Ranked ladders, friends lists, cosmetics/monetization, native mobile apps, AI opponents beyond the rulebook's random Townsfolk, voice chat (use an external call; text chat is built in).

## 3. Audience

- Board-game groups playing remotely (3–12 people who already know each other).
- The designer's playtest circle.
- Later: strangers in public lobbies (P2).

## 4. Success metrics

| Metric | Target for v1 |
|---|---|
| Complete a 5-seat, 6-round game without a rules bug or desync | 100% of playtests |
| Time from "create room" to first placement | < 3 minutes |
| Average placement phase (5 seats) | ≤ 90 seconds |
| Players who could explain the gold/identity mechanic after one game | ≥ 80% |
| Reconnect and resume mid-game | works within 10 seconds |

## 5. The game in one screen

A round table. One seat per player (and per Townsfolk). In front of every seat, a face-down **pile**. At the bottom, **your hand**. On the side, the **gold board** (12 trade tracks), the **calendar** (season and round), and **gossip chat**.

Each round:
1. **Gossip** happens while cards are placed — there is no separate Ready step.
2. **Placement:** drag (or tap-assign) exactly one card from your hand onto every seat's pile, including your own and any grave. The Townsfolk's cards are dealt automatically. Ghosts may haunt one card from their grave pool. *Lock in* when done; the phase ends when everyone has locked in or the timer expires (unlocked players get a random legal placement — the rulebook's Townsfolk behavior).
3. **Reveal:** the server shuffles every pile and resolves the whole round with the global order (voids → wounds → heals → deaths → gold → words → pending). The client plays it back as an animation: every pile flips, effects pop, wounds land, the gold board moves, truth cards read out their answers. Nobody can tell who placed what.
4. **Funerals** (if any): the dead player's role flips face-up, their remaining hand becomes their grave pool, and they privately seal a will by choosing a living heir.
5. **Cleanup:** the next round begins. (Season events — Market Fair, Reeve's Tax, Hungry Winter — are an optional host setting, off by default.)

Game end: the final reveal (all envelopes open at once), scoring (wounds −1 each, scoring cards, wills), a winner, and a full replay log.

## 6. Functional requirements

### 6.1 Accounts (P0)
- Email + password sign-up and sign-in (InsForge Auth); email verification if the project requires it; password reset.
- Display name and avatar (profile); a per-user "crest" color chosen per game.
- Sessions survive refresh; a signed-in user rejoins their game automatically.

### 6.2 Lobby (P0)
- Create a room → 6-character join code + shareable link.
- Join by code. Host sees the seat list; players can pick a crest color and mark ready.
- Host settings: Townsfolk count (auto-fill to 4 seats; optional extras), gossip timer, placement timer, private/public.
- Start requires 3–12 humans; the app fills to 4 seats with Townsfolk per the rulebook table (rounds, seasons, job cards kept, death threshold).

### 6.3 Game engine (P0) — server-authoritative
- Dealing: envelopes (trades) shuffled and dealt to seats; unused trades stay hidden; job cards trimmed to the table's count; 4 Mishaps + 1 Calamity per seat from the shared mishap deck; 3 signature cards per trade; crests for the succession.
- Placement validation: exactly one card per pile; ghost haunts one card from their own grave pool; Townsfolk dealt at random.
- Resolution: the global simultaneous order from the rulebook's online recommendation, with every card's text implemented (see `TECH_SPEC.md §6`).
- Truth cards auto-resolve: Inquest, Appraisal, Tracks in the Snow announce the true answer; Strong Ale shows the drunk's hand to everyone for 5 seconds.
- Choice cards (Iron Strongbox, Gleaning/Paste Gems ties, False Colors): the pile's owner gets a modal; timeout → default (own... first eligible track). Townsfolk choices → the Crier.
- Funerals, wills (heir from the succession; unique crests), graves as mandatory piles, haunting, ghost chat.
- Season events, final reveal, scoring, shared victories via wills, "nobody wins" if everyone dies.
- AFK rule: any player who fails to act by the deadline is auto-played (random legal placement / random heir); after two consecutive AFK rounds the seat converts to Townsfolk.

### 6.4 Table UI (P0)
- Seats arranged around an oval; your seat at the bottom; crest colors; wound cards stack in front of each seat; scoring cards and pending cards visible on the pile.
- Hand: sorted by type, hover to zoom with rules text, right-click/long-press for full card.
- Placement: drag-and-drop with a snap-to-pile; tap-to-select then tap a seat on touch; a per-seat "assigned" chip; *Lock in* button; countdown.
- Reveal animation (Framer Motion): staggered pile flips, wound tokens, gold marker glides, camera-pan to the pile being resolved, effect banners ("Night Patrol voids an attack!").
- Gold board with 12 tracks, calendar strip with season rule reminders.
- Gossip chat with timestamps; ghost messages styled as whispers; system messages for truth-card answers.
- Funeral modal: role reveal ceremony; heir picker (living crests).
- End screen: final reveal ceremony (envelopes open), scoring table, wills opened, replay log, "play again" with the same room.

### 6.5 Rules reference (P0)
- In-app rulebook (the 1.5 rules) and card gallery; a "?" on every card.

### 6.6 Playtest tooling (P1)
- Full game log export (JSON) with every placement (identified) for post-game analysis — designer only, after the game ends.
- Room option: "reveal placements at game end" for playtests.

### 6.7 Later (P2)
Public lobbies, spectators, sound design, achievements, print-and-play export from the same card data.

## 7. UX principles

- **The reveal is the show.** Everyone sees the same animation at the same time; nothing resolves silently.
- **Never leak by accident.** Placement UI shows *where* you placed, never what others placed; pile counts are visible (a haunted pile runs one card heavy, just like the table).
- **Cards teach the game.** Rules text on every card; effect banners name the card and the rule.
- **Ghosts stay in the room.** Dead players keep chat and the haunt control; their seat becomes the grave with a visible pool count.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Hidden-information leaks through API | All game state is projected per user by the server; clients never read raw tables. |
| Rules-engine bugs in 36 signature cards | Deterministic engine with a simulation test that plays thousands of random games and checks invariants. |
| Slow placement at 12 seats | Drag with snapping, keyboard shortcuts, "fill remaining with jobs" helper. |
| Players lying about truth cards | Impossible online — the server answers. |
| Balance unknowns (attack economy, Thief power) | Log export + designer dashboard (P1). |

## 9. Open questions

1. Should the placement deadline auto-play or pause the game? (v1: auto-play, host can extend.)
2. Voice chat integration (Discord link in the room) — v1 links out only.
3. Public lobbies and moderation — deferred.
