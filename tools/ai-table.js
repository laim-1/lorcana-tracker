// node tools/ai-table.js [games] [levels...]  -> win-rate table, row level vs column level (seats and decks alternate)
// Personalities: "normal:aggro", "normal:quester", "normal:control" etc. are accepted as levels.
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js");
const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
const fs = require('fs'), OLDP = __dirname + '/.engine-old.js'; const O = fs.existsSync(OLDP) ? require(OLDP) : null; // baseline: `git show HEAD:js/engine.js > tools/.engine-old.js`
const choose = (st, lv) => lv.startsWith('old-') ? O.aiChoose(st, lv.slice(4)) : E.aiChoose(st, lv);
const D = E.STARTER_DECKS.map(d => E.deckFromList(pool, d.list));
const args = process.argv.slice(2); const N = +args[0] || 40; const L = args.slice(1).length ? args.slice(1) : ["easy", "normal", "hard"];
function game(a, b, g) { // a plays seat (g%2), b the other; returns true if a wins
  const k = g >> 1, sa = g % 2, decks = [], d0 = D[(k * 7) % D.length], d1 = D[(k * 7 + 11) % D.length]; decks[sa] = g % 2 ? d1 : d0; decks[1 - sa] = g % 2 ? d0 : d1; // each deck pair played both ways
  const st = E.newGame({ decks, seed: 1000 + g * 31, first: k % 2 }); st.human = [false, false];
  const lv = []; lv[sa] = a; lv[1 - sa] = b;
  for (const i of [0, 1]) E.mulligan(st, i, E.aiMulligan(st, i));
  let n = 0; while (st.winner == null && n++ < 3000) { const pi = st.pending ? st.pending.pi : st.active; const x = choose(st, lv[pi]); if (!x) break; E.act(st, x) }
  if (st.winner == null) STALL++; return st.winner === sa ? 1 : st.winner == null ? 0.5 : 0;
}
let STALL = 0; const t0 = Date.now(), rows = [];
for (const a of L) { const r = [a]; for (const b of L) { if (a === b) { r.push("-"); continue } let w = 0; for (let g = 0; g < N; g++) w += game(a, b, g); r.push(Math.round(100 * w / N) + "%") } rows.push(r) }
const w = Math.max(...L.map(x => x.length)) + 2; console.log("row vs col, " + N + " games each (" + ((Date.now() - t0) / 1000).toFixed(0) + "s, " + STALL + " stalled)");
console.log("".padEnd(w) + L.map(x => x.padStart(w)).join("")); for (const r of rows) console.log(r[0].padEnd(w) + r.slice(1).map(x => String(x).padStart(w)).join(""));
