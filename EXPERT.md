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
| 20 | v3 per-action + big net (805 KB: 16-dim card embeddings x 5 zones + 75 features, 256-128 MLP, 1.42M rows) | 160 | 68.1% [60.6-74.8] | 65.0% | 71.3% | heavily oversubscribed run (time cap cut rollouts); rerun clean |
| 21 | v3 per-action + big net (bigI, 862 KB), clean run, 7 shards on 8 cores | 240 | 67.9% [61.8-73.5] | 65.8% | 70.0% | big net is worse than the 16 KB MLP; dropped |
| 22 | **expert2 + move prior (pw2h), clean confirmation** | 240 | **78.3% [72.7-83.1]** | 84.2% | 72.5% | avg 165ms; best config |
| 23 | expert2 + move prior + big net | 240 | 77.9% [72.3-82.7] | 80.0% | 75.8% | no gain over #22 and 50x the weights |
| 24 | v3 per-action + small retrained net (small.json) | 240 | 67.9% [61.8-73.5] | 67.5% | 68.3% | dropped |
| 25 | **shipped: expert2 + prior with hard per-decision cap (Web Worker: soft 540ms, hard 900ms; node: 500/900)** | 160 | **78.8% [71.8-84.4]** | 78.8% | 78.8% | avg 187ms, max 1131ms node (was 7400ms uncapped); pooled with #22: 315/400 = 78.8% [74.5-82.5] |
- Phone check (tests/ui-expert.py, 390x844, 4x CPU throttle): 31 worker decisions, max 511ms, avg 157ms, max frame gap 75ms.
- **Round 3 takeaways:** whole-turn planning plus a tiny learned move prior (23 weights) gave +5 points (73.8% to 78.8%). The 860 KB big value net and a retrained small net did not beat the 16 KB v3 MLP, so they were not shipped.

## Round 4: ISMCTS, rollout policy, mulligan, deck knowledge (in progress)
- `ismcts` level: information-set MCTS over our own turn. Each iteration samples a new determinization, descends a shared action-keyed tree with PUCT (move prior softmax mixed 50/50 with uniform, top-W=6 + End), expands one action, then greedy-finishes the turn, rolls `ph` phases with Hard-greedy play, and scores with the 16 KB value net. Final pick = max(Q - sel/sqrt(N)). ~450 iterations per 400ms decision.
| 26 | ismcts first try (most-visited pick, no root widening) | 7 | 0/7 | | | prior too peaked; only 2 root children explored |
| 27 | ismcts c=1, mix .5, sel .3, ph 3 | 28 | 60.7% [42.4-76.4] | 64.3% | 57.1% | |
| 28 | ismcts ph 1 / sel 0,c 2 / W4 mix .25 / ph 2 | 28 each | 75.0% / 42.9% / 60.7% / 75.0% | | | most-visited pick is bad; short rollouts better |
| 29 | ismcts ph1 sel .6 / ph2 sel .6 / ph1 W8 sel .3 (same 56 games) | 56 each | 78.6% / 76.8% / 78.6% | | | |
| 30 | expert2 shipped config on the same 56 games | 56 | 76.8% [64.2-85.9] | 82.1% | 71.4% | ISMCTS on par so far |
| 31 | ismcts ph1 sel 1 W8 / ph0 (value net right after our turn) / ph1 sel .6 W8 + expert mulligan | 56 each | 73.2% / 73.2% / 71.4% | | | all within noise of #29 |
| 32 | expert2 + expert mulligan (Monte Carlo redraw scoring with own decklist, `expertMulligan`) | 56 | 71.4% [58.5-81.6] | 71.4% | 71.4% | vs 76.8% without on same games; no gain |
| 33 | expert2 + Hard-level rollouts (TP.adj=1, hardAdj in rollout greedy) | 56 | 69.6% [56.7-80.1] | 64.3% | 75.0% | avg 296ms (vs 165); overlapped with an external 7-shard ismcts 240 run (oversubscribed), so rerun clean |
