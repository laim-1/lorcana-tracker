/* Expert AI runs here so the board never freezes while it searches. Receives a frozen game state, answers with one action. */
self.window = self; const V = (self.location.search.match(/v=([^&]+)/) || [])[1] || "";
importScripts("../data/game-cards.js?v=" + V, "./engine.js?v=" + V, "../data/expert-weights.js?v=" + V);
const E = self.LorcanaEngine; let pool = null;
self.onmessage = ev => { const { id, fr, level, ms } = ev.data; let a = null, err = null;
  try { if (!pool) pool = self.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard);
    if (ms) { E.setExpert(ms); E.setTP({ ms: Math.round(ms * 0.6), hard: ms }) } const st = E.thawState(fr, pool);
    /* Expert = whole-turn planner (expert2) + learned move prior when the prior is loaded. */
    const lv = self.LORCANA_EXPERT_PRIOR ? String(level).replace(/^expert(?=:|$)/, "expert2") : level; a = E.aiChoose(st, lv) } catch (e) { err = String(e && e.message || e) }
  self.postMessage({ id, a, err }) };
