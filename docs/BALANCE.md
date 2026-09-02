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
