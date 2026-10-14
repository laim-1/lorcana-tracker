// node tools/selfplay.js N seedBase out.jsonl -> per-turn-start features for both seats + final winner label (1 = that seat won)
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js"); const fs = require("fs");
const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
const D = E.STARTER_DECKS.map(d => E.deckFromList(pool, d.list));
const [N, SB, OUT] = [+process.argv[2], +process.argv[3], process.argv[4]]; const LV = (process.env.LV || "hard,normal").split(",");
if (process.env.LW) { E.setLearned(JSON.parse(fs.readFileSync(process.env.LW))); E.setExpert(+(process.env.MS || 150), 0, 0, { leaf: 1000 }) }
const out = fs.createWriteStream(OUT);
for (let g = 0; g < N; g++) { const s = SB + g; const r = E.newGame({ decks: [D[(s * 7) % D.length], D[(s * 13 + 3) % D.length]], seed: 90000 + s, first: s % 2 }); r.human = [false, false];
  for (const i of [0, 1]) E.mulligan(r, i, E.aiMulligan(r, i)); const lv = [LV[s % LV.length], LV[(s >> 1) % LV.length]]; const rows = []; let last = -1, n = 0;
  while (r.winner == null && n++ < 3000) { if (!r.pending && r.turnNo !== last) { last = r.turnNo; for (const pi of [0, 1]) rows.push([pi, E.feats(r, pi)]) } const pi = r.pending ? r.pending.pi : r.active; const x = E.aiChoose(r, lv[pi]); if (!x) break; E.act(r, x) }
  if (r.winner == null) continue; for (const [pi, f] of rows) out.write(JSON.stringify([r.winner === pi ? 1 : 0, f.map(v => +v.toFixed(4))]) + "\n") }
out.end();
