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
