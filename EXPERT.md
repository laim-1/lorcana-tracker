# Expert AI: results log

All runs are Expert vs Hard, using `sh tools/expert-par.sh N 7 expert hard 350`:
- Seats and first player are swapped.
- Half the games are mirror-deck (the same official starter on both sides) and half are mixed-deck.
- The 95% CI is a Wilson interval.
- The Expert budget is 350ms per decision in node and 900ms in the browser worker.

| # | Candidate | n | All | Mirror | Mixed | Notes |
|---|---|---|---|---|---|---|
| 0 | Hard-style rollouts, determinized (no peeking), 6 reps, hand-tuned eval | 240 | 56.3% [49.9-62.4] | 57.5% | 55.0% | v1 shipped `a205fa8` |
| 1 | Same, eval weights hill-climbed (8 iters) | 240 | 48.8% [42.5-55.0] | 50.8% | 46.7% | within noise; dropped |
| 2 | Flat MC with full-game greedy playouts | 32 | 40.6% | | | dropped |
| 3 | v1 + learned MLP leaf eval (57 features, 205k rows from Hard/Normal self-play) | 120 | 71.7% [63.0-79.0] | 76.7% | 66.7% | big jump |
| 4 | #3, leaf scale 3000 / 300 | 120 | 70.0% / 66.7% | | | scale 1000 kept |
| 5 | #3, shallower rollouts (no 4th phase), 8 reps | 120 | 65.8% | | | 4th phase kept |
| 6 | #3, heuristic root bonuses x0 / x0.3 | 120 | 66.7% / 72.5% | | | x0.3 kept |
| 7 | MLP v3 (66 features incl. hand/curve/challenge, 256k rows) + bonuses x0.3 | 160 | 71.3% [63.8-77.7] | 70.0% | 72.5% | |
| 8 | **#7 confirmation run** | 240 | **68.3% [62.2-73.9]** | 68.3% | 68.3% | shipped |
| 9 | MLP v4 trained on +40k Expert-vs-Hard self-play rows (AlphaZero-lite iter 1); rep-limited (no time cap) | 160 | 71.3% [63.8-77.7] | 72.5% | 70.0% | same as v3 under identical settings (71.3%); model is no longer the bottleneck |
| 10 | Opponent modeled with Hard's real policy in rollouts (top-4 Hard lookahead), top-6 root candidates, 2 reps | 80 | 60.0% [49.0-70.0] | 52.5% | 67.5% | worse and 3x slower; dropped |
| 11 | v3 model, 16 reps, no time cap | 120 | 77.5% [69.2-84.1] | 81.7% | 73.3% | more rollouts help (avg 184ms node) |
| 12 | v3 model, 16 reps, 500ms cap | 120 | 76.7% [68.3-83.3] | 81.7% | 71.7% | avg 146ms, max 777ms node |
| 13 | v3 model, 40 reps, 1000ms cap | 120 | 75.0% [66.6-81.9] | 78.3% | 71.7% | saturates; 16 reps is enough |
| 14 | **v3 model, 16 reps, 500ms cap: confirmation run** | 240 | **73.8% [67.8-78.9]** | 79.2% | 68.3% | shipped (worker cap 900ms) |
| 15 | MLP v5 (32 hidden, +55k rows of Expert-v3-model self-play; AlphaZero-lite iter 2), 16 reps | 240 | 72.1% [66.1-77.4] | 76.7% | 67.5% | no gain over v3 model; not shipped |

## Takeaways
- **Worked:** the learned leaf evaluation (+12 points, 56 to 68%) and more determinized rollouts per candidate (+5 points, to 74%).
- **Didn't help:** hill-climbing the hand weights, full-game playouts, a lore-clock term, modeling the opponent with Hard's own lookahead inside rollouts (slower and worse), and retraining on Expert self-play (AlphaZero-lite iterations 1-2 were flat).
- **Rollouts saturate:** 40 rollouts with a 1s cap scored 75%, no better than 16. The remaining gap looks policy-limited (one action at a time, greedy continuations) plus draw/deck variance. Some matchups stay deck-limited; per-matchup rows come from `DECKS=1 sh tools/expert-par.sh ...`.
- **Next to try:** search over whole-turn action sequences, then a policy prior from a trained move model for progressive widening.

## Round 3: whole-turn planner + big nets (in progress)
- `expert2` = beam search over whole-turn sequences (W=4 prior-ranked actions + End per node, beam 6, depth 8, 6 determinizations, end-of-turn states scored by greedy rollouts + the value net).
- Big self-play run is in progress (`/workspace/big`, 42k games, card-id lists saved for embeddings).
| 16 | expert2 turn planner (W4 B6 D8, 6 dets, 500ms) | 80 | 75.0% [64.5-83.2] | 75.0% | 75.0% | on par with v3 |
| 17 | expert2 wider (W6 B8, 8 dets, 800ms) | 80 | 77.5% [67.2-85.3] | 80.0% | 75.0% | not better than v3 within CI |
- Big value nets: `tools/train-big.py` (torch) trains per-card embeddings summed per zone plus state features into an MLP; `bigEval` in the engine runs inference. Policy data: `tools/policy-gen.js` (Expert's choices).
| 18 | expert2 + learned move prior (softmax imitating Expert, 9.6k decisions, hybrid with heuristic) | 80 | 80.0% [70.0-87.3] | 85.0% | 75.0% | promising |
| 19 | #18, 160 games | 160 | 79.4% [72.5-84.9] | 82.5% | 76.3% | |
