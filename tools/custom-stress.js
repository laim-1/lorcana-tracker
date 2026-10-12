// AI-vs-AI games with decks drawn only from per-card-defined (custom) cards of the given sets: node tools/custom-stress.js 1,2 [games]
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js");
const sets = (process.argv[2] || "").split(",").filter(Boolean), G = +process.argv[3] || 40;
const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
const custom = pool.filter(c => c.custom && (!sets.length || sets.includes(String(c.set))));
const filler = pool.filter(c => c.type === "character" && c.inkable && c.cost <= 4);
let rng = 1; const r = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
function deck() { const d = []; for (let i = 0; i < 36; i++) d.push(custom[Math.floor(r() * custom.length)]); for (let i = 0; i < 24; i++) d.push(filler[Math.floor(r() * filler.length)]); return d; }
let err = 0, wins = [0, 0], turns = 0;
for (let g = 0; g < G; g++) {
  const st = E.newGame({ decks: [deck(), deck()], seed: 500 + g, first: g % 2 }); st.ai = ["normal", g % 3 ? "hard" : "easy"];
  E.mulligan(st, 0, E.aiMulligan(st, 0)); E.mulligan(st, 1, E.aiMulligan(st, 1));
  try { let n = 0; while (st.winner == null && n < 4000) { const a = E.aiChoose(st); if (!a) { const L = E.legalActions(st); throw new Error("no action; legal=" + L.length + " pending=" + JSON.stringify(st.pending) + " phase=" + st.phase + " last=" + st.log.slice(-3).join(" / ")); } E.act(st, a); n++; } if (st.winner == null) throw new Error("did not finish"); if (!st.players.every(p => Number.isFinite(p.lore))) throw new Error("NaN lore"); wins[st.winner]++; turns += st.turnNo; }
  catch (e) { err++; console.log("game", g, "ERROR", e.stack.split("\n").slice(0, 3).join(" | ")); }
}
console.log(`custom cards: ${custom.length}, games: ${G}, errors: ${err}, wins: ${wins}, avg turns: ${(turns / Math.max(1, G - err)).toFixed(1)}`);
process.exit(err ? 1 : 0);
