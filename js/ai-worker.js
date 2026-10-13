/* Expert AI runs here so the board never freezes while it searches. Receives a frozen game state, answers with one action. */
self.window = self; const V = (self.location.search.match(/v=([^&]+)/) || [])[1] || "";
importScripts("../data/game-cards.js?v=" + V, "./engine.js?v=" + V);
const E = self.LorcanaEngine; let pool = null;
self.onmessage = ev => { const { id, fr, level, ms } = ev.data; let a = null, err = null;
  try { if (!pool) pool = self.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
    if (ms) E.setExpert(ms); const st = E.thawState(fr, pool); a = E.aiChoose(st, level) } catch (e) { err = String(e && e.message || e) }
  self.postMessage({ id, a, err }) };
