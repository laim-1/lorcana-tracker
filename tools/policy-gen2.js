// node tools/policy-gen.js N seedBase out.jsonl -> Expert's decisions: [chosenIndex, [actionFeatures...]] for move-prior training
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js"); const fs = require("fs");
globalThis.LorcanaEngine = E; require("../data/expert-weights.js"); E.setExpert(+(process.env.MS || 300));
const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
const D = E.STARTER_DECKS.map(d => E.deckFromList(pool, d.list)); const [N, SB, OUT] = [+process.argv[2], +process.argv[3], process.argv[4]];
const out = []; for (let g = 0; g < N; g++) { const s = SB + g; const r = E.newGame({ decks: [D[(s * 7) % D.length], D[(s * 11 + 5) % D.length]], seed: 70000 + s, first: s % 2 }); r.human = [false, false];
  for (const i of [0, 1]) E.mulligan(r, i, E.aiMulligan(r, i)); const lv = s % 2 ? ["expert2", "hard"] : ["hard", "expert2"]; let n = 0;
  while (r.winner == null && n++ < 3000) { const pi = r.pending ? r.pending.pi : r.active; const x = E.aiChoose(r, lv[pi]);
    if (!x) break; if (!r.pending && lv[pi] === "expert2") { const A = E.legalActions(r); if (A.length > 1) { const k = A.findIndex(b => JSON.stringify(b) === JSON.stringify(x)); if (k >= 0) out.push(JSON.stringify([k, A.map(a => E.aFeat(r, a).map(v => +v.toFixed(3)))])) } } E.act(r, x) }
  if (g % 10 === 9) fs.writeFileSync(OUT, out.join("\n") + "\n") }
fs.writeFileSync(OUT, out.join("\n") + "\n");
