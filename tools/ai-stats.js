// node tools/ai-stats.js [games] [level]  -> AI behaviour stats (seat 0 = level under test vs Normal)
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js");
const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
const N = +process.argv[2] || 40, LV = process.argv[3] || "normal";
const decks = (global.STARTER_LISTS || null);
function deckFor(i) { const D = E.STARTER_DECKS; if (D) { const d = D[i % D.length]; return E.deckFromList(pool, d.list) } const P = [["Amber","Amethyst"],["Ruby","Sapphire"],["Emerald","Steel"],["Amber","Steel"],["Amethyst","Ruby"],["Emerald","Sapphire"]]; return E.buildDeck(pool.filter(c=>c.status!=="partial"), P[i % 6]) }
function run(level) {
  const tot = { games: 0, challenge: 0, quest: 0, playChar: 0, playAction: 0, playSong: 0, playItem: 0, playLoc: 0, act: 0, move: 0, ink: 0, favorableTurns: 0, favorableTaken: 0, gamesWithFav: 0, gamesChallenged: 0, gamesNonChar: 0, wins: 0 };
  for (let g = 0; g < N; g++) {
    const st = E.newGame({ decks: [deckFor(g), deckFor(g + 3)], seed: 100 + g, first: g % 2 }); st.human = [false, false];
    E.mulligan(st, 0, E.aiMulligan(st, 0)); E.mulligan(st, 1, E.aiMulligan(st, 1));
    let steps = 0, fav = 0, chal = 0, nonchar = 0, lastTurn = -1, turnFav = false, turnTook = false;
    while (st.winner == null && steps++ < 4000) {
      const pi = st.pending ? st.pending.pi : st.active; const lvl = pi === 0 ? level : "normal";
      if (pi === 0 && !st.pending && st.turnNo !== lastTurn) { if (turnFav) { tot.favorableTurns++; if (turnTook) tot.favorableTaken++ } lastTurn = st.turnNo; turnFav = false; turnTook = false }
      if (pi === 0 && !st.pending) { const A = E.legalActions(st); if (A.some(a => a.t === "challenge" && (() => { const at = E.find(st, a.uid).inst, d = E.find(st, a.target).inst; return d.card.type === "character" && E.strOf(at) >= (E.wilOf(d) - d.damage) && E.strOf(d) < (E.wilOf(at) - at.damage) })())) { turnFav = true; fav = 1 } }
      const a = E.aiChoose(st, lvl); if (!a) break;
      if (pi === 0 && !st.pending) {
        if (a.t === "challenge") { tot.challenge++; chal = 1; turnTook = true }
        else if (a.t === "quest") tot.quest++; else if (a.t === "act") { tot.act++; nonchar = 1 } else if (a.t === "move") tot.move++; else if (a.t === "ink") tot.ink++;
        else if (a.t === "play") { const c = E.find(st, a.uid).inst.card; if (c.type === "character") tot.playChar++; else { nonchar = 1; if (c.type === "item") tot.playItem++; else if (c.type === "location") tot.playLoc++; else if (c.type === "song") tot.playSong++; else tot.playAction++ } }
      }
      E.act(st, a);
    }
    tot.games++; if (fav) { tot.gamesWithFav++; if (chal) tot.gamesChallenged++ } if (nonchar) tot.gamesNonChar++; if (st.winner === 0) tot.wins++;
  }
  return tot;
}
const r = run(LV); console.log(JSON.stringify({ level: LV, ...r, challengeRateWhenFavorable: +(r.gamesChallenged / Math.max(1, r.gamesWithFav)).toFixed(2), favTurnTakeRate: +(r.favorableTaken / Math.max(1, r.favorableTurns)).toFixed(2) }));
if (require.main === module && process.argv.includes("--json")) {}
module.exports = { run };
