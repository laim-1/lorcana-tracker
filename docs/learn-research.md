# Learn mode research notes

Sources read before authoring the curriculum (Oct 19, 2026):

- Disney Lorcana Comprehensive Rules v2.3.0, effective 2026-10-16: https://files.disneylorcana.com/CRUpdate_EN_Oct-2026.pdf
  (prior v2.0.1: https://files.disneylorcana.com/Disney-Lorcana-Comprehensive-Rules-020526-EN-Edited.pdf; searchable mirror https://lorcana.gg/rules/comprehensive-rules/)
- Official resources hub (Tournament Rules, FAQ, Learn to Play): https://www.disneylorcana.com/en-US/resources
- Strategy: Frank Karsten, Lorcana beginner tips (curve, spend your ink): https://ultimateguard.com/de/blog/lorcana-beginners-guide-5-tips-become-better-frank-karsten
- Strategy: Cardboard Champions intermediate tips (tempo, who is the beatdown): https://cardboardchampions.co.uk/how-to-win-lorcana-intermediate-tips/
- Tempo vs value (cards, ink, lore are the three resources): https://www.reddit.com/r/Lorcana/comments/16tppg9/what_is_tempo_tempo_vs_value_learning_lorcana/
- Community "Quiz Time" rules puzzles (trigger order, game state check at 20 lore): https://www.reddit.com/r/Lorcana/comments/1mx1vsf/quiz_time/
- Ready Set Draw "Lorcana Lessons" ep. 4 (mulligan: about 4 of 7 cards playable on turns 1-3): https://www.youtube.com/watch?v=tVT_HTwfzP4

## Rules used in lessons (rule numbers cited in js/learn-data.js)

| Concept | CR | Note |
|---|---|---|
| 20 lore wins | 1.11.3 | |
| Ink a card, inkwell symbol, once per turn | 4.2.1.1, 4.2.3 | inked card enters ready (4.2.1.3) |
| Paying costs by exerting ink | 4.3.2.4 | |
| Drying / dry | 5.1.1.11-12 | drying characters can't quest, challenge or exert to sing |
| Start of turn: Ready, Set (location lore), Draw | 3.2.1.1, 3.2.2.2, 3.2.3.1 | starting player skips first draw |
| Quest | 4.5.1 | |
| Challenge exerted characters; locations can be challenged | 4.6.4.2 | locations have no strength, deal nothing back |
| Damage stays, banish at willpower | 1.9 | |
| Songs: sing with cost >= song cost | 5.4.4.2 | singing is an alternate cost; ink stays free |
| Items usable the turn played | 5.5.4 | |
| Move to a location (doesn't exert) | 4.7.3 | |
| Alert / Bodyguard / Challenger / Evasive / Reckless / Resist / Rush / Shift / Singer / Sing Together / Support / Ward | 8.2-8.15 | Reckless: can't quest, can't end turn while it can challenge (8.7.2-3). Shift onto dry = dry (8.10.4), onto exerted = exerted (8.10.2), keeps damage (8.10.6). |
| Mulligan | 2.2.2 | any number to bottom, draw back to 7, shuffle |
| Deck: 60+ cards, up to 2 inks, max 4 copies | Tournament Rules / CR 2.1 | |

Awareness only (no card data in app yet): set 14 Hyperia City adds the Adventurous keyword (CR 8.16: can't challenge; can't end turn while it can quest). Not taught until card data exists.

## Puzzle design rules
- Puzzles are real engine boards. `tools/validate-learn.js` brute-forces every legal line (no end turn) and fails if
  the puzzle is unsolvable, already solved, or if any winning line skips the intended key moves.
- Patterns used: exact lethal (count lore), order-dependent lethal (Scout Ahead before passing the rival), survive (rival's
  next-turn max lore < 20), Bodyguard/Ward routing, location bonus to win a fight, sing-to-save-ink.
