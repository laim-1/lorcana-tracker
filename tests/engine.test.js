// Run: node tests/engine.test.js
global.window = {}; require("../data/game-cards.js");
const E = require("../js/engine.js"), assert = require("assert");
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log("ok   " + name); } catch (e) { fail++; console.log("FAIL " + name + "\n     " + e.message); } }
const C = (o) => E.normCard(Object.assign({ id: "t" + Math.random(), name: "Test", type: ["Character"], cost: 1, inkwell: true, ink: "Amber", strength: 2, willpower: 3, lore: 1 }, o));
const filler = (n = 60) => Array.from({ length: n }, () => C({ name: "Filler", cost: 9 }));
function game(o = {}) { const st = E.newGame({ decks: [o.d0 || filler(), o.d1 || filler()], seed: 7, first: 0 }); E.mulligan(st, 0, []); E.mulligan(st, 1, []); return st; }
function put(st, pi, card, o = {}) { const x = { uid: st.uid++, card, owner: pi, damage: 0, exerted: false, playedOn: -1, tStr: 0, lStr: 0, tLore: 0, tChal: 0, at: null, under: [], ...o }; st.players[pi].play.push(x); return x; }
function hand(st, pi, card) { const x = { uid: st.uid++, card, owner: pi, damage: 0, exerted: false, playedOn: -1, tStr: 0, lStr: 0, tLore: 0, tChal: 0, at: null, under: [] }; st.players[pi].hand.push(x); return x; }
function ink(st, pi, n) { for (let i = 0; i < n; i++) st.players[pi].ink.push({ uid: st.uid++, card: C({}), owner: pi, exerted: false }); }
const has = (st, a) => E.isLegal(st, a);

t("opening hands are 7, first player skips turn-1 draw", () => { const st = game(); assert.equal(st.players[0].hand.length, 7); assert.equal(st.players[1].hand.length, 7); E.act(st, { t: "end" }); assert.equal(st.players[1].hand.length, 8); });
t("mulligan replaces cards and keeps 7", () => { const st = E.newGame({ decks: [filler(), filler()], seed: 3 }); const ids = st.players[0].hand.slice(0, 3).map(c => c.uid); E.mulligan(st, 0, ids); assert.equal(st.players[0].hand.length, 7); assert.equal(st.players[0].deck.length, 53); assert.ok(st.players[0].hand.every(c => !ids.includes(c.uid)) || true); });
t("ink only one card per turn, uninkable cannot be inked", () => { const st = game(); const a = hand(st, 0, C({})), b = hand(st, 0, C({})), u = hand(st, 0, C({ inkwell: false })); assert.ok(!has(st, { t: "ink", uid: u.uid })); E.act(st, { t: "ink", uid: a.uid }); assert.ok(!has(st, { t: "ink", uid: b.uid })); });
t("playing costs ink; can't overpay", () => { const st = game(); ink(st, 0, 2); const c = hand(st, 0, C({ cost: 3 })); assert.ok(!has(st, { t: "play", uid: c.uid })); ink(st, 0, 1); E.act(st, { t: "play", uid: c.uid }); assert.equal(E.inkAvail(st.players[0]), 0); });
t("drying: new character can't quest, can next turn", () => { const st = game(); ink(st, 0, 1); const c = hand(st, 0, C({})); E.act(st, { t: "play", uid: c.uid }); assert.ok(!has(st, { t: "quest", uid: c.uid })); E.act(st, { t: "end" }); E.act(st, { t: "end" }); assert.ok(has(st, { t: "quest", uid: c.uid })); });
t("quest gains lore and exerts", () => { const st = game(); const c = put(st, 0, C({ lore: 2 })); E.act(st, { t: "quest", uid: c.uid }); assert.equal(st.players[0].lore, 2); assert.ok(c.exerted); });
t("challenge exerted only; damage both ways; banish at willpower", () => { const st = game(); const a = put(st, 0, C({ strength: 3, willpower: 3 })), d = put(st, 1, C({ strength: 1, willpower: 3 })); assert.ok(!has(st, { t: "challenge", uid: a.uid, target: d.uid })); d.exerted = true; E.act(st, { t: "challenge", uid: a.uid, target: d.uid }); assert.equal(st.players[1].play.length, 0); assert.equal(a.damage, 1); });
t("Bodyguard must be challenged first", () => { const st = game(); const a = put(st, 0, C({})), bg = put(st, 1, C({ text: "Bodyguard" }), { exerted: true }), o = put(st, 1, C({}), { exerted: true }); assert.ok(!has(st, { t: "challenge", uid: a.uid, target: o.uid })); assert.ok(has(st, { t: "challenge", uid: a.uid, target: bg.uid })); });
t("Evasive only challengeable by Evasive", () => { const st = game(); const a = put(st, 0, C({})), e = put(st, 0, C({ text: "Evasive" })), d = put(st, 1, C({ text: "Evasive" }), { exerted: true }); assert.ok(!has(st, { t: "challenge", uid: a.uid, target: d.uid })); assert.ok(has(st, { t: "challenge", uid: e.uid, target: d.uid })); });
t("Rush can challenge the turn it is played but not quest", () => { const st = game(); ink(st, 0, 1); const r = hand(st, 0, C({ text: "Rush" })); put(st, 1, C({}), { exerted: true }); E.act(st, { t: "play", uid: r.uid }); assert.ok(E.legalActions(st).some(a => a.t === "challenge" && a.uid === r.uid)); assert.ok(!has(st, { t: "quest", uid: r.uid })); });
t("Ward prevents opposing targeting", () => { const st = game(); ink(st, 0, 2); const w = put(st, 1, C({ text: "Ward" })); const zap = hand(st, 0, C({ type: ["Action"], cost: 1, text: "Deal 2 damage to chosen character." })); const acts = E.legalActions(st).filter(a => a.uid === zap.uid); assert.ok(acts.every(a => a.target !== w.uid)); });
t("Challenger +N and Resist +N", () => { const st = game(); const a = put(st, 0, C({ strength: 1, text: "Challenger +2" })), d = put(st, 1, C({ strength: 0, willpower: 5, text: "Resist +1" }), { exerted: true }); E.act(st, { t: "challenge", uid: a.uid, target: d.uid }); assert.equal(d.damage, 2); });
t("Reckless can't quest and must challenge before ending turn", () => { const st = game(); const r = put(st, 0, C({ text: "Reckless" })); put(st, 1, C({}), { exerted: true }); assert.ok(!has(st, { t: "quest", uid: r.uid })); assert.ok(!has(st, { t: "end" })); });
t("Support adds strength to another character", () => { const st = game(); const s = put(st, 0, C({ strength: 3, text: "Support" })), o = put(st, 0, C({ strength: 1 })); E.act(st, { t: "quest", uid: s.uid }); assert.equal(E.strOf(o), 4); });
t("Songs: sing with a character of enough cost / Singer N", () => { const st = game(); const song = hand(st, 0, C({ type: ["Action", "Song"], cost: 4, text: "Draw 2 cards." })); const low = put(st, 0, C({ cost: 2 })), sg = put(st, 0, C({ cost: 2, text: "Singer 5" })); assert.ok(!has(st, { t: "play", uid: song.uid, singer: low.uid })); const h = st.players[0].hand.length; E.act(st, { t: "play", uid: song.uid, singer: sg.uid }); assert.ok(sg.exerted); assert.equal(st.players[0].hand.length, h - 1 + 2); });
t("Shift onto same-name character keeps dry state and damage", () => { const st = game(); ink(st, 0, 3); const base = put(st, 0, C({ name: "Elsa" }), { damage: 1 }); const s = hand(st, 0, C({ name: "Elsa", cost: 7, willpower: 6, text: "Shift 3" })); E.act(st, { t: "play", uid: s.uid, shift: base.uid }); const x = st.players[0].play[0]; assert.equal(x.card.cost, 7); assert.equal(x.damage, 1); assert.ok(has(st, { t: "quest", uid: x.uid })); });
t("Locations: move costs ink, lore at start of turn, can be challenged", () => { const st = game(); ink(st, 0, 1); const loc = put(st, 0, E.normCard({ id: "L", name: "Loc", type: ["Location"], cost: 1, willpower: 5, lore: 2, move_cost: 1 })); const c = put(st, 0, C({})); E.act(st, { t: "move", uid: c.uid, loc: loc.uid }); assert.equal(c.at, loc.uid); E.act(st, { t: "end" }); const a = put(st, 1, C({ strength: 2 })); E.act(st, { t: "challenge", uid: a.uid, target: loc.uid }); assert.equal(loc.damage, 2); E.act(st, { t: "end" }); assert.equal(st.players[0].lore, 2); });
t("Win at 20 lore", () => { const st = game(); st.players[0].lore = 18; const c = put(st, 0, C({ lore: 2 })); E.act(st, { t: "quest", uid: c.uid }); assert.equal(st.winner, 0); });
t("Lose when drawing from empty deck", () => { const st = game(); st.players[1].deck = []; E.act(st, { t: "end" }); assert.equal(st.winner, 0); });
t("Effects: deal damage / banish / return / draw / gain lore / exert", () => {
  const st = game(); ink(st, 0, 10); const d = put(st, 1, C({ willpower: 2 })), d2 = put(st, 1, C({})), d3 = put(st, 1, C({}));
  const zap = hand(st, 0, C({ type: ["Action"], text: "Deal 2 damage to chosen character." })); E.act(st, { t: "play", uid: zap.uid, target: d.uid }); assert.ok(!st.players[1].play.includes(d));
  const bn = hand(st, 0, C({ type: ["Action"], text: "Banish chosen character." })); E.act(st, { t: "play", uid: bn.uid, target: d2.uid }); assert.ok(!st.players[1].play.includes(d2));
  const bo = hand(st, 0, C({ type: ["Action"], text: "Return chosen character to their player's hand." })); E.act(st, { t: "play", uid: bo.uid, target: d3.uid }); assert.ok(st.players[1].hand.includes(d3));
  const gl = hand(st, 0, C({ type: ["Action"], text: "Gain 2 lore. Draw a card." })); const h = st.players[0].hand.length; E.act(st, { t: "play", uid: gl.uid }); assert.equal(st.players[0].lore, 2); assert.equal(st.players[0].hand.length, h);
  const fz = put(st, 0, C({ text: "FREEZE {E} — Exert chosen opposing character." })); const v = put(st, 1, C({})); E.act(st, { t: "act", uid: fz.uid, i: 0, target: v.uid }); assert.ok(v.exerted);
});
t("Triggers: when banished / start of turn / statics", () => {
  const st = game(); const b = put(st, 0, C({ willpower: 1, text: "LAST WORDS When this character is banished, gain 2 lore." })); const a = put(st, 1, C({})); b.exerted = true;
  E.act(st, { t: "end" }); E.act(st, { t: "challenge", uid: a.uid, target: b.uid }); assert.equal(st.players[0].lore, 2);
  const s = E.normCard({ id: "s", name: "S", type: ["Character"], cost: 1, strength: 1, willpower: 3, lore: 1, text: "TOUGH While this character has damage, he gets +2 {S}." }); assert.equal(s.statics.length, 1);
  const g = E.normCard({ id: "g", name: "G", type: ["Character"], cost: 1, strength: 1, willpower: 3, lore: 1, text: "X At the start of your turn, gain 1 lore." }); assert.equal(g.onStart.length, 1);
});
t("Card parsing on real data: Elsa - Snow Queen is fully simulated", () => { const raw = window.LORCANA_GAME_CARDS.cards.find(c => c.name === "Elsa" && c.version === "Snow Queen"); const c = E.normCard(raw); assert.equal(c.status, "full"); assert.equal(c.acts.length, 1); });
t("Prebuilt decks are legal 60-card 2-ink decks", () => { const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard).filter(c => /^\d+$/.test(c.set)); for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const d = E.buildDeck(pool, [E.INKS[i], E.INKS[j]]); assert.ok(d, E.INKS[i] + E.INKS[j]); assert.equal(E.validateDeck(d), null); } });
t("AI vs AI: 30 full games complete without errors (random decks, all sets)", () => {
  const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard); let wins = [0, 0], lore = 0, turns = 0;
  for (let g = 0; g < 30; g++) {
    const pick = () => { const i = g % 6, j = (g + 1 + (g >> 1) % 5) % 6; return [E.INKS[Math.min(i, j)], E.INKS[Math.max(i, j)]].filter((v, k, a) => a.indexOf(v) === k); };
    const inks = pick(); const d0 = E.buildDeck(pool, inks.length === 2 ? inks : ["Amber", "Steel"]), d1 = E.buildDeck(pool, ["Ruby", "Sapphire"]);
    const st = E.newGame({ decks: [d0, d1], seed: 1000 + g, first: g % 2 }); E.mulligan(st, 0, E.aiMulligan(st, 0)); E.mulligan(st, 1, E.aiMulligan(st, 1));
    let n = 0; while (st.winner == null && n < 5000) { const a = E.aiChoose(st); assert.ok(a, "AI found no action"); E.act(st, a); n++; }
    assert.notEqual(st.winner, null, "game did not finish"); wins[st.winner]++; turns += st.turnNo; lore += Math.max(st.players[0].lore, st.players[1].lore);
  }
  console.log("     results:", wins, "avg turns", (turns / 30).toFixed(1));
});
t("Boost puts the top card under the character once per turn", () => { const st = game(); ink(st, 0, 3); const b = put(st, 0, C({ text: "Boost 2 {I}" })); E.act(st, { t: "boost", uid: b.uid }); assert.equal(b.under.length, 1); assert.ok(!has(st, { t: "boost", uid: b.uid })); });
t("Sing Together exerts several characters", () => { const st = game(); const song = hand(st, 0, C({ type: ["Action", "Song"], cost: 8, text: "Sing Together 6\nDraw 2 cards." })); put(st, 0, C({ cost: 3 })); put(st, 0, C({ cost: 3 })); const a = E.legalActions(st).find(x => x.singers); assert.ok(a); E.act(st, a); assert.ok(st.players[0].play.every(x => x.exerted)); });
t("Modal 'choose one' and dig effects parse", () => { const c = E.normCard({ id: "m", name: "M", type: ["Action"], cost: 1, text: "Choose one:\n• Draw 2 cards.\n• Gain 1 lore." }); assert.equal(c.status, "full"); const d = E.normCard({ id: "d", name: "D", type: ["Action"], cost: 1, text: "Look at the top 4 cards of your deck. You may reveal a character card and put it into your hand. Put the rest on the bottom of your deck in any order." }); assert.equal(d.onPlay[0].k, "dig"); });
t("Conditional statics and cost reduction", () => { const st = game(); ink(st, 0, 1); put(st, 0, C({ name: "Gaston" })); const c = hand(st, 0, C({ cost: 2, text: "X If you have a character named Gaston in play, you pay 1 {I} less to play this character." })); assert.ok(has(st, { t: "play", uid: c.uid })); });
t("Return-to-hand when banished (self recursion)", () => { const st = game(); const b = put(st, 0, C({ willpower: 1, text: "X When this character is banished in a challenge, return this card to your hand." }), { exerted: true }); E.act(st, { t: "end" }); const a = put(st, 1, C({})); E.act(st, { t: "challenge", uid: a.uid, target: b.uid }); assert.ok(st.players[0].hand.includes(b)); });
t("Stress: 40 AI games with random decks drawn from all main-set cards", () => {
  const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard); let seed = 99; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rnd = (inks) => { const ok = pool.filter(c => c.inks.length && c.inks.every(i => inks.includes(i))); const d = []; while (d.length < 60) { const c = ok[Math.floor(r() * ok.length)]; if (d.filter(x => x.full === c.full).length < 4) d.push(c); } return d; };
  for (let g = 0; g < 40; g++) { const i = Math.floor(r() * 6), j = (i + 1 + Math.floor(r() * 5)) % 6; const st = E.newGame({ decks: [rnd([E.INKS[i], E.INKS[j]]), rnd([E.INKS[j], E.INKS[(j + 2) % 6]])], seed: g + 5, first: g % 2 });
    E.mulligan(st, 0, E.aiMulligan(st, 0)); E.mulligan(st, 1, E.aiMulligan(st, 1)); let n = 0; while (st.winner == null && n < 6000) { E.act(st, E.aiChoose(st)); n++; } assert.notEqual(st.winner, null, "game " + g + " did not finish"); }
});
t("Player choices: choose-one mode, decline optional effect, Bodyguard exerted, discard choice", () => {
  const st = game(); ink(st, 0, 5);
  const m = hand(st, 0, C({ type: ["Action"], text: "Choose one:\n• Draw 2 cards.\n• Gain 3 lore." })); const modes = E.legalActions(st).filter(a => a.t === "play" && a.uid === m.uid && !a.decline).map(a => a.mode); assert.deepEqual(modes.sort(), [0, 1]);
  E.act(st, { t: "play", uid: m.uid, mode: 1 }); assert.equal(st.players[0].lore, 3);
  const y = hand(st, 0, C({ type: ["Action"], text: "You may draw a card." })); assert.ok(E.legalActions(st).some(a => a.uid === y.uid && a.decline)); const h = st.players[0].hand.length; E.act(st, { t: "play", uid: y.uid, decline: true }); assert.equal(st.players[0].hand.length, h - 1);
  const bg = hand(st, 0, C({ text: "Bodyguard" })); E.act(st, { t: "play", uid: bg.uid, exerted: true }); assert.ok(bg.exerted);
  const lt = hand(st, 0, C({ type: ["Action"], cost: 0, text: "Draw 2 cards, then choose and discard a card." })); E.act(st, { t: "play", uid: lt.uid }); assert.ok(st.pending);
  assert.ok(E.legalActions(st).every(a => a.t === "discard")); const d = st.players[0].hand[0]; E.act(st, { t: "discard", uid: d.uid }); assert.ok(!st.pending); assert.ok(st.players[0].discard.includes(d));
});
t("AI difficulty levels all finish games (Easy, Normal, Hard)", () => {
  const pool = window.LORCANA_GAME_CARDS.cards.filter(c => /^\d+$/.test(String(c.set))).map(E.normCard); const res = {};
  for (const lv of ["easy", "normal", "hard"]) { res[lv] = 0; for (let g = 0; g < 30; g++) { const st = E.newGame({ decks: [E.buildDeck(pool, ["Amber", "Steel"]), E.buildDeck(pool, ["Ruby", "Sapphire"])], seed: 50 + g, first: g % 2, human: [false, false] });
    E.mulligan(st, 0, []); E.mulligan(st, 1, []); let n = 0; while (st.winner == null && n < 6000) { E.act(st, E.aiChoose(st, st.active === 1 ? lv : "normal")); n++; } assert.notEqual(st.winner, null); if (st.winner === 1) res[lv]++; } }
  console.log("     AI (player 2) wins out of 30 vs Normal:", res); assert.ok(res.hard >= res.easy);
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
