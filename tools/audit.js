// node tools/audit.js [--v]  -> correctness audit: plays each main-set card in a fixed scenario and checks
// the outcome against expectations derived from its printed text. Writes AUDIT.md.
global.window = {}; require("../data/game-cards.js"); const E = require("../js/engine.js"), fs = require("fs");
const V = process.argv.includes("--v");
const seen = new Set(), pool = [];
for (const raw of window.LORCANA_GAME_CARDS.cards) { if (!/^\d+$/.test(String(raw.set))) continue; const c = E.normCard(raw); if (seen.has(c.full)) continue; seen.add(c.full); pool.push(c) }
let fid = 0; const F = (o = {}) => E.normCard(Object.assign({ id: "f" + fid++, name: "Filler" + fid, version: "V", type: ["Character"], cost: 2, inkwell: true, ink: "Steel", strength: 1, willpower: 5, lore: 1, text: "" }, o));
const mk = (st, pi, card, o = {}) => ({ grants: [], uid: st.uid++, card, owner: pi, damage: 0, exerted: false, playedOn: -5, turnPlayed: -5, tStr: 0, lStr: 0, tLore: 0, tChal: 0, at: null, under: [], ...o });
function scenario(card) {
  const st = E.newGame({ decks: [Array.from({ length: 40 }, () => F()), Array.from({ length: 40 }, () => F())], seed: 11, first: 0 }); E.mulligan(st, 0, []); E.mulligan(st, 1, []);
  const me = st.players[0], op = st.players[1];
  for (let i = 0; i < 12; i++) me.ink.push(mk(st, 0, F()));
  me.play.push(mk(st, 0, F({ strength: 2 }), { damage: 2 }), mk(st, 0, F({ strength: 2 }), { damage: 1 }));
  op.play.push(mk(st, 1, F({ willpower: 6 }), { exerted: true, damage: 1 }), mk(st, 1, F({ willpower: 6 })), mk(st, 1, F({ willpower: 6, cost: 1 }), { exerted: true }));
  const x = mk(st, 0, card); me.hand.push(x); st.events = []; st.human = [false, false]; return { st, x }
}
const snap = st => st.players.map(p => ({ hand: p.hand.length, deck: p.deck.length, lore: p.lore, play: p.play.length, disc: p.discard.length, ink: p.ink.length,
  dmg: p.play.reduce((t, x) => t + x.damage, 0), ex: p.play.filter(x => x.exerted).length, str: p.play.reduce((t, x) => t + E.strOf(x), 0) }));
function drain(st) { let n = 0; while (st.pending && n++ < 30 && st.winner == null) { const a = E.aiChoose(st, "normal"); if (!a) break; E.act(st, a) } }
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const num = s => NUM[s] ?? +s;
// expectations from a single unconditional sentence
function expect(sent) {
  const s = sent.replace(/\([^)]*\)/g, "").trim();
  if (/\b(if|for each|unless|may|instead|equal to|then|up to|each opponent chooses|chosen opponent|reveal|look at|name a card|until|next|whenever|while|count|this turn,)\b/i.test(s)) return null;
  let m;
  if ((m = s.match(/^(?:you )?draw (a|an|\d+|two|three) cards?\.?$/i))) return { k: "draw", n: num(m[1].toLowerCase()) };
  if ((m = s.match(/^gain (\d+) lore\.?$/i))) return { k: "lore", n: +m[1] };
  if ((m = s.match(/^each opponent loses (\d+) lore\.?$/i))) return { k: "oplore", n: +m[1] };
  if ((m = s.match(/^deal (\d+) damage to chosen (?:opposing )?(?:character|character or location|damaged character)\.?$/i))) return { k: "dmg", n: +m[1] };
  if ((m = s.match(/^deal (\d+) damage to each opposing character\.?$/i))) return { k: "dmgAll", n: +m[1] };
  if ((m = s.match(/^each opponent chooses and discards (a|\d+) cards?\.?$/i))) return { k: "oppDisc", n: num(m[1]) };
  if (/^banish chosen (?:opposing )?(?:damaged |exerted )?(?:character|item|character, item, or location)\.?$/i.test(s)) return /item/.test(s)?null:{ k: "banish" };
  if (/^banish chosen (?:opposing )?character\.?$/i.test(s)) return { k: "banish" };
  if (/^exert chosen (?:opposing )?character\.?$/i.test(s)) return { k: "exert" };
  if (/^return chosen (?:opposing )?character to (?:their|its) player's hand\.?$/i.test(s)) return { k: "bounce" };
  if ((m = s.match(/^remove (?:up to )?(\d+) damage from (?:chosen|each of your|this) characters?\.?$/i))) return { k: "heal" };
  if ((m = s.match(/^chosen character gets \+(\d+) \{S\}\.?$/i))) return { k: "buff", n: +m[1] };
  return null
}
function check(e, b, a, card, from) {
  const self = from === "hand" ? 1 : 0; // the played card itself leaves hand
  switch (e.k) {
    case "draw": return a[0].hand - (b[0].hand - self) === e.n || `hand +${a[0].hand - (b[0].hand - self)} expected +${e.n}`;
    case "lore": return a[0].lore - b[0].lore >= e.n || `lore +${a[0].lore - b[0].lore} expected +${e.n}`;
    case "oplore": return b[1].lore - a[1].lore === Math.min(e.n, b[1].lore) || `opp lore -${b[1].lore - a[1].lore}`;
    case "dmg": return (a[1].dmg - b[1].dmg) + (a[0].dmg - b[0].dmg) >= e.n || a[1].play < b[1].play || a[0].play < b[0].play + (card.type === "character" ? 1 : 0) || `no ${e.n} damage dealt`;
    case "dmgAll": return a[1].dmg - b[1].dmg + 6 * (b[1].play - a[1].play) >= e.n * b[1].play || `opp damage +${a[1].dmg - b[1].dmg}`;
    case "oppDisc": return b[1].hand - a[1].hand === Math.min(e.n, b[1].hand) || `opp hand -${b[1].hand - a[1].hand}`;
    case "banish": return a[1].play < b[1].play || a[0].play < b[0].play + (card.type === "character" ? 1 : 0) || "nothing banished";
    case "exert": return a[1].ex > b[1].ex || a[0].ex > b[0].ex || "nothing exerted";
    case "bounce": return a[1].hand > b[1].hand || a[0].hand > b[0].hand - self || "nothing returned";
    case "heal": return a[0].dmg < b[0].dmg || a[1].dmg < b[1].dmg || "no damage removed";
    case "buff": return a[0].str - b[0].str >= e.n || a[1].str > b[1].str || "no strength buff";
  }
}
const res = { checked: 0, ok: 0, fail: [], err: [] };
const sentences = t => t.split(/(?<=\.)\s+|\n/).map(x => x.trim()).filter(Boolean);
for (const c of pool) {
  const text = (c.text || "").replace(/[’]/g, "'");
  const tests = [];
  if (c.type === "action") for (const s of sentences(text)) { const e = expect(s); if (e) tests.push({ e, how: "play" }) }
  for (const m of text.matchAll(/When you play this character, ([^.]+\.)/gi)) { const e = expect(m[1]); if (e && c.type === "character") tests.push({ e, how: "play" }) }
  for (const m of text.matchAll(/Whenever this character quests, ([^.]+\.)/gi)) { const e = expect(m[1]); if (e) tests.push({ e, how: "quest" }) }
  for (const m of text.matchAll(/(?:^|\n)[A-Z0-9' !?,.\-&]*?\{E\} — ([^.]+\.)(?!\s*Then)/g)) { const e = expect(m[1]); if (e) tests.push({ e, how: "act" }) }
  // abilities with several sentences: skip if another sentence of the same ability changes the same resource
  if (/discard (your hand|a card|cards)|shuffle|for free/i.test(text)) for (let i = tests.length - 1; i >= 0; i--) if (tests[i].e.k === "draw") tests.splice(i, 1);
  if (!tests.length) continue;
  // only test one sentence kind at a time where multiple sentences combine (e.g. draw + lore); check each separately on same run
  try {
    const { st, x } = scenario(c); let b;
    if (tests[0].how === "play") {
      const acts = E.legalActions(st).filter(a => a.t === "play" && a.uid === x.uid && a.shift == null && a.singer == null && !a.singers);
      if (!acts.length) { res.err.push([c.full, "not playable in scenario"]); continue }
      const k = tests[0].e.k, opp = st.players[1].play, mine = st.players[0].play;
      const want = k === "exert" ? opp.filter(y => !y.exerted) : k === "heal" ? mine.filter(y => y.damage) : k === "buff" ? mine : opp;
      const pick = acts.find(a => a.target != null && want.some(y => y.uid === a.target)) || acts[0];
      b = snap(st); E.act(st, pick);
    } else if (tests[0].how === "act") {
      st.players[0].hand.pop(); const y = mk(st, 0, c); st.players[0].play.push(y);
      const k = tests[0].e.k, opp = st.players[1].play, mine = st.players[0].play;
      const want = k === "exert" ? opp.filter(z => !z.exerted) : k === "heal" ? mine.filter(z => z.damage) : k === "buff" ? mine : opp;
      const acts = E.legalActions(st).filter(a => a.t === "act" && a.uid === y.uid);
      if (!acts.length) { res.err.push([c.full, "ability not usable in scenario"]); continue }
      const pick = acts.find(a => a.target != null && want.some(z => z.uid === a.target)) || acts[0];
      b = snap(st); E.act(st, pick);
    } else {
      st.players[0].hand.pop(); const y = mk(st, 0, c); st.players[0].play.push(y); b = snap(st);
      const qa = E.legalActions(st).filter(a => a.t === "quest" && a.uid === y.uid);
      if (!qa.length) { res.err.push([c.full, "cannot quest"]); continue }
      const k = tests[0].e.k, opp = st.players[1].play, mine = st.players[0].play;
      const want = k === "exert" ? opp.filter(z => !z.exerted) : k === "heal" ? mine.filter(z => z.damage) : opp;
      E.act(st, qa.find(a => a.target != null && want.some(z => z.uid === a.target)) || qa[0]); b[0].lore += c.lore || 0;
    }
    drain(st); const a = snap(st);
    for (const t of tests) { res.checked++; const r = check(t.e, b, a, c, t.how === "play" ? "hand" : "play"); if (r === true) res.ok++; else res.fail.push([c.full, t.e.k, r, text.slice(0, 160)]) }
  } catch (e) { res.err.push([c.full, "THROWS " + e.message]) }
}
console.log(JSON.stringify({ cards: pool.length, checked: res.checked, ok: res.ok, fail: res.fail.length, err: res.err.length }));
if (V) { for (const f of res.fail) console.log("FAIL", f.join(" | ")); for (const f of res.err) console.log("ERR ", f.join(" | ")) }
fs.writeFileSync(__dirname + "/../AUDIT.md", `# Ability correctness audit\n\nGenerated by \`node tools/audit.js\`. Each main-set card whose text contains an unconditional, measurable effect (draw N, gain/lose lore, deal N damage, banish, exert, return to hand, remove damage, +N strength) is played (or quests) in a fixed scenario and the resulting state is compared to the printed text.\n\n- Unique main-set cards: ${pool.length}\n- Assertions checked: ${res.checked}\n- Passing: ${res.ok}\n- Failing: ${res.fail.length}\n- Scenario errors: ${res.err.length}\n\n${res.fail.length ? "## Failures\n\n" + res.fail.map(f => `- **${f[0]}** (${f[1]}): ${f[2]}`).join("\n") : ""}\n${res.err.length ? "\n## Scenario errors\n\n" + res.err.map(f => `- **${f[0]}**: ${f[1]}`).join("\n") : ""}\n`);
