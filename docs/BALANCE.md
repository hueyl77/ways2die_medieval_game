# Balance report — 5 seats, 300 games per policy

Generated with `node scripts/balance.ts 300 5 all` (2026-09-02, rules as of PR #5 + Tax Collector + 8-seat cap).
Five human-policy seats, six rounds, death at 3 wounds, every round the same (no season rules).

Three policies:
- **random** — every card placed at random (the bots' behaviour).
- **measured** — one attack a round on a random rival (heavy ones in the last two rounds), Heal/Protect at home when wounded, wares everywhere else. The closest thing here to normal play.
- **sensible** — every attack played as early as possible on rivals; a stress test for coordinated aggression.

## Headline numbers

| | random | measured | sensible (all-in round 1) |
|---|---:|---:|---:|
| deaths per game (of 5) | 3.09 | 2.92 | 3.92 |
| mean death round (of 6) | 3.5 | 3.9 | 1.9 |
| games with nobody alive | 4% | 1% | 22% |
| winner margin (gold) | 5.1 | 5.2 | 4.2 |
| games where a ghost shared the win | 85% | 85% | 77% |
| Alms hit rate | 28% | 36% | 13% |
| Tax Collector, cards seized per play | 2.2 | 1.2 | 0.0 |

## Findings

1. **Lethality is too high.** Around 60% of seats die even under measured play, and if the table opens aggressively four out of five die with the average death in round two and one game in five ending with nobody alive. Cause: each player holds 6 wounds of attacks (4 × 1 + 2) against a 3-wound death, so the table's total offence (30 wounds) is double its total health (15).
2. **Healing trades dominate because survival is the whole game.** Measured play: Apothecary wins 44% of its seats (65% survival), Farmer 28% — Panacea, Hearty Stew and Physician's Fee all cash in on a bloody table. Bottom: City Guard 12%, Woodsman 14%, Carpenter 16% (Carpenter's Palisade only shines in the all-in meta, where it wins 49%).
3. **Alms is a game-decider.** +5 when it lands against an average winner margin of ~5 gold. Hit rate 28–36% is healthy as a catch-up, but the swing is large.
4. **Ghost wins are nearly automatic.** With ~3 deaths a game and unique heirs, some ghost's heir is the winner in 85% of games. "Winning from beyond" is not a meaningful achievement at this lethality.
5. **Tax Collector is weak.** It seizes 1–2 cards per play because attackers dump attacks, not wares, into the pile it lands in.

## What-ifs (measured play unless noted)

| Variant | deaths/game | nobody alive | winner margin | top trade win% | Alms hit |
|---|---:|---:|---:|---:|---:|
| current (4+1 kit, death at 3) | 2.92 | 1% | 5.2 | Apothecary 44% | 36% |
| death at 4 wounds | 1.71 | 0% | 1.8 | Apothecary 57% | 17% |
| kit 3 Mishaps + 1 Calamity, death at 3 | 2.31 | 0% | 3.1 | Apothecary 39% | 44% |
| kit 3+1, random play | 2.63 | 0% | 3.9 | — | 29% |

Raising the death threshold cuts deaths hardest but flattens scores (winner margin 1.8, 14% shared wins) and makes the healers even stronger. Trimming the kit to 3 + 1 keeps games decisive (margin 3.1), stops the wipe-outs, and narrows the healer lead.

## Recommendations

1. **Kit to 3 Mishaps + 1 Calamity** (wares kept = seats × rounds − 12). Preferred over death at 4.
2. **Trim the healers:** Physician's Fee capped at 2, Panacea heals 2 instead of everything (or Hearty Stew heals 1 + 1 gold). Re-run after the kit change before touching these — the kit alone narrows the gap.
3. **Lift the floor:** City Guard (Inquest could also bank 1 gold for the Guard; Night Patrol void two in its own pile), Woodsman (Cordwood +2 always), Miller (Miller's Toll minimum 1).
4. **Alms to +4** if it still decides games after the kit change.
5. **Ghost shares:** consider paying out only when the heir wins outright (no tie), or letting a ghost seal a will only if it died in the first half of the year — either makes the shared win rarer than 85%.
6. Leave Tax Collector alone until people play with intent; against real players who spread wares it should seize 3–4 cards.

Re-run: `node scripts/balance.ts 300 5 all`, with what-ifs `node scripts/balance.ts 300 5 measured 4` (death at 4) and `node scripts/balance.ts 300 5 measured 0 kit3` (3 + 1 kit).

---

## After the balance pass (same day)

Changes made: kit 3 Mishaps + 1 Calamity (24 mishaps, one copy each); Panacea heals 2 and cures a Slow Poison without being spent; Physician's Fee max 2; Cordwood +2; Miller's Toll at least 1; Inquest +1 to the Guard; Night Patrol voids up to two at home and pays 1 per void (max 2); Curfew pays 1 per attack stopped (max 3); A Round on the House heals the wounded and pays the Innkeeper 1 per player served (max 3); Trestle Market +2 to the Carpenter; Alms +4. (A rule forbidding wills from naming the current richest trade was tried and dropped the same day: it cannot be verified at a physical table, where trades are hidden.)

The measured policy now also plays one signature card a round from round 2 (the earlier version hoarded them, which made every "next round" card worthless in the final round and hid the support trades' value).

| | before | after |
|---|---:|---:|
| deaths per game (of 5) | 2.92 | 1.89 |
| games with nobody alive | 1% | 0% |
| ghost shared the win | 85% | 59% |
| winner margin (gold) | 5.2 | 2.1 |
| shared (tied) wins | 9% | 14% |
| Alms hit rate | 36% | 39% (now +4) |
| win rate spread across trades | 12–44% | 18–32% |

Trades, measured play, 300 games: City Guard 32%, Thief 30%, Woodsman 28%, Innkeeper 24%, Apothecary 22%, Tailor 22%, Blacksmith 21%, Farmer 21%, Miller 21%, Jeweler 20%, Hunter 19%, Carpenter 18%. Each trade is seated ~125 times, so ±8% is noise; the City Guard's lead is the one number worth watching (its three cards now pay ~5 gold a game between them) — if it holds up in real play, drop Curfew's fine to max 2.

Open items for human playtests: ghosts still share the win in ~59% of games (a ghost's heir is often the winner simply because few players survive) — if that feels cheap, a printable alternative is to let only the first ghost of the year seal a will; the tighter scoring (2.3-gold margins, 13% ties) may want a third tie-break; Tax Collector still seizes only ~2 cards a play; the Thief remains the only trade that can kill alone.

---

## Five rounds for every table, and the Shuffled Envelope (2026-09-03)

Changes: every year is 5 rounds at every table size (wares kept = seats × 5 − 12, so the printed envelope holds 28 wares and the 8-seat hand is 40 cards); crests are the envelope colours, with 8 crest cards for the succession; a new host setting, `drawMode` (the Shuffled Envelope), turns the envelope into a face-down deck and deals one card per seat into the hand each round.

Measured play, 200 games per cell (at the time: `node scripts/balance.ts 200 <seats> measured 0 nokit [draw]`; drawing is now the default and `full` selects the old hand).

| | 5 seats, full hand | 5 seats, draw | 8 seats, full hand | 8 seats, draw |
|---|---:|---:|---:|---:|
| deaths per game | 1.70 | 2.17 | 0.97 | 1.51 |
| mean death round (of 5) | 3.2 | 3.3 | 3.5 | 3.3 |
| games with nobody alive | 0 | 1 | 0 | 0 |
| shared (tied) wins | 17% | 5% | 32% | 18% |
| ghost shared the win | 56% | 67% | 18% | 26% |
| winner margin (gold) | 1.6 | 2.4 | 0.9 | 1.0 |
| Alms hit rate | 34% | 22% | 17% | 9% |
| Tax Collector, cards seized per play | 1.5 | 2.2 | 4.3 | 4.7 |
| win% per seat, best to worst trade | 37–13% | 36–11% | 36–4% | 30–5% |

For comparison, the six-round 5-seat game after the balance pass: 1.89 deaths, 59% ghost shares, 2.1-gold margin, 14% ties, 39% Alms.

### Findings

1. **Eight seats over five rounds is a gentle year.** Under one death a game, a 0.9-gold winner margin and a third of games tied: 8 players each hold 5 wounds of attacks against 8 × 4 health, spread over 8 piles. The 8-seat table wants either death at 3 or a fourth attack before it is decisive (what-if: `node scripts/balance.ts 200 8 measured 3`).
2. **The Shuffled Envelope is bloodier at every size** (about half a death more per game) because Protects and Heals arrive by luck instead of when they are needed. It also cuts ties sharply and halves the Alms hit rate, since the card is drawn late as often as early. Under measured play it is the more decisive game; whether the luck feels fair is a question for humans.
3. **City Guard and Thief lead every cell** (30–37% of their seats) and Blacksmith and Farmer trail badly at 8 seats (4–8%). Curfew is the largest gold engine at 8 seats (447 gold over 200 games). If the Guard's lead holds in human play, cap Curfew at 2.
4. **Tax Collector finally bites at 8 seats** (4.3–4.7 cards seized per play) because piles are deep in wares.
5. Cutpurse and Blackmail show as zero in the card table because they move gold between tracks; the table sums net deltas.

Open items for human playtests: the 8-seat death threshold; whether the Shuffled Envelope's luck is welcome or resented; the Guard; and the size of the physical envelope (28 wares is the price of five rounds at eight seats).

---

## Drawing from the deck becomes the standard game (2026-09-28)

Changes: `drawMode` is on by default, so every player shuffles their deck each round and draws one card per seat; holding the whole envelope is now the optional Open Envelope variant. Strong Ale used to show an empty hand when drawing (the round's cards were already on the table), so it now makes its victim draw next round's hand at once, face-up.

Measured play, 300 games per cell: `node scripts/balance.ts 300 <seats> measured 0 nokit [full]`.

| | 4 draw | 4 full | 5 draw | 5 full | 6 draw | 6 full | 8 draw | 8 full |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| deaths per game | 1.75 | 1.44 | 2.16 | 1.77 | 1.33 | 0.98 | 1.38 | 1.04 |
| mean death round (of 5) | 3.1 | 3.4 | 3.2 | 3.1 | 3.4 | 3.7 | 3.5 | 3.5 |
| games with nobody alive | 5 | 1 | 2 | 0 | 0 | 0 | 0 | 0 |
| shared (tied) wins | 3% | 7% | 6% | 15% | 10% | 22% | 18% | 30% |
| ghost shared the win | 65% | 55% | 65% | 56% | 33% | 21% | 23% | 20% |
| winner margin (gold) | 2.6 | 2.6 | 2.3 | 1.7 | 1.5 | 1.1 | 1.1 | 0.9 |
| Alms hit rate | 32% | 40% | 22% | 33% | 16% | 25% | 8% | 17% |
| Tax Collector, cards seized per play | 1.5 | 0.9 | 2.2 | 1.5 | 3.1 | 2.6 | 4.7 | 4.2 |

### Findings

1. **Drawing adds about a third of a death per game at every size**, because every Attack in every deck is played by the year's end and Protects and Heals arrive by luck. At 4 seats a game now ends with nobody alive about once in 60.
2. **Ties roughly halve.** The draw breaks the symmetry between players who would otherwise pace their wares the same way.
3. **Alms and the Tax Collector are no longer timed.** Alms lands when it is drawn, so it pays less often (8% at 8 seats); the Tax Collector seizes more because it falls on full piles as often as thin ones.
4. **The choice that remains is where, never whether.** Until the first death there is no grave to dump on, so an Attack drawn in rounds 1 and 2 must hit a living seat, the drawer included. This is the thing to watch in human play: whether being forced to hurt someone feels like drama or like being robbed of a decision.

Open items for human playtests: whether ghosts should also draw (today a ghost picks its haunt from its whole grave pool, so the dead have more choice than the living); whether a player may look through their deck during the year; the 8-seat death threshold from the section above.
