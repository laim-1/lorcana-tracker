// Both seats flagged human: every choice must surface as a picker (pending "ask"/"dig"); pickers are answered randomly. node tools/human-stress.js [games] [sets]
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js");
const G = +process.argv[2] || 60, sets = (process.argv[3] || "").split(",").filter(Boolean);
const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
const custom = pool.filter(c => (c.custom || c.status === "full") && (!sets.length || sets.includes(String(c.set))));
const filler = pool.filter(c => c.type === "character" && c.inkable && c.cost <= 4);
let rng = 7; const r = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
const deck = () => { const d = []; for (let i = 0; i < 40; i++) d.push(custom[Math.floor(r() * custom.length)]); for (let i = 0; i < 20; i++) d.push(filler[Math.floor(r() * filler.length)]); return d; };
let err = 0, asks = 0, kinds = {}, srcs = new Set(), wins = [0, 0];
for (let g = 0; g < G; g++) {
  const st = E.newGame({ decks: [deck(), deck()], seed: 900 + g, first: g % 2, human: [true, true] });
  E.mulligan(st, 0, []); E.mulligan(st, 1, []);
  try { let n = 0; while (st.winner == null && n < 6000) { let a;
      if (st.pending) { const A = E.legalActions(st); if (!A.length) throw new Error("pending with no actions " + JSON.stringify({ ...st.pending, items: undefined, cont: undefined })); asks++; kinds[st.pending.kind || "discard"] = (kinds[st.pending.kind || "discard"] || 0) + 1; if (st.pending.src) srcs.add(st.pending.src); a = A[Math.floor(r() * A.length)]; }
      else a = E.aiChoose(st, "normal");
      if (!a) throw new Error("no action"); E.act(st, a); n++; for (const P of st.players) for (const z of ["hand","deck","discard","play","ink"]) if (P[z].some(y => !y)) throw new Error("undefined card in " + z + " after " + JSON.stringify(a) + " :: " + st.log.slice(-4).join(" / ")); }
    if (st.winner == null) throw new Error("did not finish"); wins[st.winner]++; }
  catch (e) { err++; console.log("game", g, "ERROR", e.stack.split("\n").slice(0, 4).join(" | ")); }
}
console.log(`games ${G}, errors ${err}, picker prompts answered ${asks}`, kinds, `distinct source cards prompting: ${srcs.size}`);
process.exit(err ? 1 : 0);
