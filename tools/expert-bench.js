// node tools/expert-bench.js N [lvA] [lvB] [ms] [max] [depth] -> A vs B over N games; mirror + mixed, seats/first swapped, 95% CI
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js");
const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
const D = E.STARTER_DECKS.map(d => E.deckFromList(pool, d.list)), names = E.STARTER_DECKS.map(d => d.name);
const [N0, A = "expert", B = "hard", ms = 350, mx = 900, dp = 3, only] = process.argv.slice(2); const N = +N0 || 20; E.setExpert(+ms, +mx, +dp, process.env.XO ? JSON.parse(process.env.XO) : null, process.env.EW ? JSON.parse(process.env.EW) : null); const [SI, SK] = (process.env.SHARD || '0/1').split('/').map(Number);
const res = { mirror: [0, 0], mixed: [0, 0] }, perDeck = {}; let tms = 0, tn = 0, tmax = 0, stall = 0;
for (let g = 0; g < N; g++) { if (g % SK !== SI) continue;
  const kind = only || (g % 4 < 2 ? "mirror" : "mixed"), k = g >> 2, sa = g % 2; // sa = A's seat; first player = seat 0 alternates via k
  const da = (k * 5) % D.length, db = kind === "mirror" ? da : (k * 5 + 7) % D.length;
  const decks = []; decks[sa] = D[da]; decks[1 - sa] = D[db];
  const st = E.newGame({ decks, seed: 5000 + g * 37, first: (k + g) % 2 }); st.human = [false, false];
  const lv = []; lv[sa] = A; lv[1 - sa] = B; for (const i of [0, 1]) E.mulligan(st, i, E.aiMulligan(st, i));
  let n = 0; while (st.winner == null && n++ < 3000) { const pi = st.pending ? st.pending.pi : st.active; const t = Date.now(); const x = E.aiChoose(st, lv[pi]); if (lv[pi] === A) { const d = Date.now() - t; tms += d; tn++; tmax = Math.max(tmax, d) } if (!x) break; E.act(st, x) }
  const w = st.winner === sa ? 1 : st.winner == null ? 0.5 : 0; if (st.winner == null) stall++;
  res[kind][0] += w; res[kind][1]++; const key = kind + ":" + names[da] + (kind === "mixed" ? " v " + names[db] : ""); (perDeck[key] = perDeck[key] || [0, 0])[0] += w; perDeck[key][1]++;
  if (process.env.V) console.error(g, kind, w, (tms / tn).toFixed(0) + "ms");
}
const ci = (w, n) => { const p = w / n, z = 1.96, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return `${(100 * p).toFixed(1)}% [${(100 * (c - h)).toFixed(1)}-${(100 * (c + h)).toFixed(1)}] n=${n}` };
if (process.env.RAW) { console.log(JSON.stringify({ res, tms, tn, tmax, stall, perDeck })); process.exit(0) }
const all = [res.mirror[0] + res.mixed[0], res.mirror[1] + res.mixed[1]];
console.log(JSON.stringify({ A, B, all: ci(...all), mirror: res.mirror[1] ? ci(...res.mirror) : null, mixed: res.mixed[1] ? ci(...res.mixed) : null, avgMs: +(tms / tn).toFixed(1), maxMs: tmax, stall }));
if (process.env.DECKS) for (const [k, v] of Object.entries(perDeck)) console.log(k, v[0] + "/" + v[1]);
