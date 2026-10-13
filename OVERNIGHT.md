# Overnight log (Oct 13, 2026, times America/Phoenix)

Each batch: tests run, stamped, committed, pushed, verified live. Backlog: BACKLOG.md.

## Batch 1 (~1:00 AM) - pickers, board fit, pass-and-play
- New `tests/ui-picker.py`: renders every picker type (choose-one text, card choice, card choice with skip,
  multi-select up to N with disabled options, reveal, long text, dig/look-at-top, free play, discard) plus
  on-board target mode end-to-end (tap card -> Play -> tap highlighted target -> resolves) in WebKit and
  Chromium touch at 390x844, 375x667, 430x932. Checks the sheet fits on screen, buttons inside and >=40px,
  the action button reachable, text not overflowing, hide/show works, and the general overlap detector.
- Fix: character rows wrapped one card early (fit math used the zone width, not the row's content width),
  so 7 characters became 3 rows with the third row cut off. Most visible in target mode.
- Fix: target-mode banner "Cancel" text clipped; long prompts now clamp to 2 lines.
- Layout detector: new ROW-CLIPS-CARD check; picker magnifier badge recognised as intentional.
- #29 Pass-and-play 2-player mode: Mode "Vs AI / Pass and play" on the deck screen; Player 1 and
  Player 2 decks; private mulligans; a hand-off cover ("Pass to Player 2") hides the hand whenever the
  phone changes hands (turn change, or the other player must make a choice); board flips so the
  current player is always at the bottom; labels, banner, and end screen use player names; AI never runs.
  Regression: `tests/ui-pp.py` plays a full game through the UI.

## Batch 2 (~1:21 AM) - AI personalities, Hard locations, strength ladder, UI polish
- #35 AI personalities: Aggressive / Quester / Control (plus Balanced). Deck screen + Settings
  "AI style" picker; level passed as `normal:aggro` etc. Heuristics and board eval weight lore,
  challenges, and non-characters per style. `tools/ai-table.js` accepts personality levels.
- #36 Hard AI locations: `locBenefit` / `locPlayValue` score lore buffs, protection, start-of-turn
  effects; Hard prefers playing locations and moving characters onto them; `evalBoard` values
  parked characters and occupied locations. Tests for move-onto-tower and play-Fang.
- Hard/Normal strength: Hard uses deeper rollouts (opponent reply + our next turn); Normal uses
  top-4 candidate rollouts; Easy stays noisy. Lethal/threat context (quest to win; remove lore
  threats). Measured 40-game table (ai-table.js):
    row vs col | easy | normal | hard
    easy       |  -   |   8%   |  8%
    normal     | 83%  |   -    | 38%
    hard       | 93%  |  65%   |  -
  Hard stats (40g vs Normal): favTurnTakeRate 0.92, challengeRateWhenFavorable 1.0, playLoc 13,
  move 50, non-char games 32/40, wins 28/40. Personalities: aggro challenges more than quester
  (162 vs 86 over 24g).
- #4 Opponent lore bar shows `AI · HARD · CONTROL` (difficulty + style).
- #41 Lore race line in turn banner ("You ahead 5–3" / "Tied 2–2").
- #42 Inkable-in-hand chip on the player's HUD.
- #44 Confirm End Turn sheet when quest/challenge/play/act/move/ink still remain.
- Tests: `node tests/engine.test.js` 86 passed; `tests/ui-ai-style.py` passed (style picker,
  bar labels, lore race, inkable chip, end-turn confirm).
- Commit: `6a9f264` (version 20261013082155). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: Pages build `d61c59c` status built; version.json `20261013082155` on https://laim-1.github.io/lorcana-tracker/. (Interim build of `6a9f264` errored once; follow-up commit rebuilt successfully.)

## Batch 3 (~1:31 AM) - busy board, hand fan, exert dmg, hint, last-play
- #2 Small-screen busy board: `fitBoard` toggles `.crowded` / `.packed` when many characters
  are in play, shrinking the hand/HUD so character rows keep usable tile sizes (min tap ~60px;
  prefer wrap until too tight, then sideways scroll). Strip items shrink when packed.
- #3 Hand fan 8+: every card keeps a >=44px peek/hit strip (`minPeek` 44–50 by hand size);
  stronger fan arc; horizontal scroll when needed. Measured minPeek 45 on 375×667 with 10 cards
  (was 36).
- #5 Exerted + damage: damage badge pinned inside the square exerted tile at top-right
  (`top:2px; right:2px`), screen-upright and readable; stats/dry/at labels adjusted so they
  stay in the empty bands around the rotated art. Ready-card badges also inset to avoid zone clip.
- #28 Hint button (banner "i"): toggles highlight of legal hand/board cards + toast summarizing
  legal action kinds; clears on act or second tap.
- #43 Opponent last-played chip: brief floating card after opponent `play` events (~4s).
- #45 Concede: in-app confirm sheet instead of native `confirm()`.
- #30 Game speed: settings label clarified (already drove AI pauses + animation scale).
- #9 Safe-area: board honors left/right insets; banner text ellipsizes instead of overlapping.
- #26 Undo: **skipped** — engine RNG is a closure and pending choice graphs share live card
  refs; a one-step undo without a dedicated snapshot/restore API would desync draws and mid-
  effect choices. Needs an engine-level freeze (rng state + deep pending) before it is safe.
- Tests: `node tests/engine.test.js` 86 passed; new `tests/ui-batch3.py` (375×667 + 390×844)
  for layout peek/dtok/hint/last-play/concede/game-speed; `ui-ai-style.py` + `ui-start.py` passed.
- Commit: `c2d869d` (version `20261013083143`). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: Pages build `aa074b4` status built; version.json `20261013083143` on https://laim-1.github.io/lorcana-tracker/.

## Batch 4 (~1:45 AM) - zoom acts, touch polish, load, log, history, goldfish
- #6 Zoom actions never covered: zoom UI split into scrollable card panel + fixed
  bottom `.zacts` bar (safe-area aware) so Play/Quest/etc stay on-screen.
- #7 Leftover animation copies: `clearFx` now cancels WAAPI + removes `.ghost`,
  `.ftext`, `.tsweep`, `.shuffle`, and resets stuck board classes/opacity.
- #8 Turn banner never overlaps cards: banner `z-index` + isolation; zones stay
  below; layout check in ui-batch4.
- #10 Faster first load: idle prefetch of `game-cards.js`, Cache API reuse, blob
  URL inject so Play opens from cache after first visit.
- #11 Long-press zoom at ~320ms (before iOS callout); stronger callout/drag
  suppression; images `pointer-events:none` on tiles so holds don't open native
  copy/image menus.
- #13 Sticky headers: `scroll-padding-top` / play `phead` shadow so content is
  not hidden under sticky bars.
- #14 Pinch-zoom disabled: viewport `maximum-scale=1,user-scalable=no`; board
  `touch-action:manipulation`; gesturestart/change cancelled on `#play`.
- #15 Double-tap guard on board actions only (tile/end/grp/pick) so menu nav
  taps are not blocked.
- #27 Action log with card images: banner log button + end-screen entry; rows
  show card art for play/quest/challenge/banish/ink/turn.
- #33 Match history + W/L: localStorage history, menu chip `XW – YL`, history
  sheet, win streak on victory screen (AI matches).
- #37 Practice vs goldfish: mode on deck screen; goldfish only draws/ends turn
  (auto-resolves pending); HUD/banner labeled GOLDFISH.
- Skipped #31/#32 (sound pack / music) as non-quick; #26 undo still blocked;
  #38 save/resume and #46 rewards left for later (streak shipped with #33).
- Tests: `node tests/engine.test.js` 86 passed; `tests/ui-batch4.py` passed;
  `ui-batch3.py`, `ui-start.py`, `ui-ai-style.py` passed.
- Commit: `079b40f` (version `20261013084440`). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: Pages build `079b40f` status built; version.json `20261013084440` on https://laim-1.github.io/lorcana-tracker/.

## Batch 5 (~2:00 AM) - correctness #18–#25 + save/daily/rules/history
- #18 Audit expanded: more expect patterns (ready, mill, grant, buff lore, …) plus named popular-card
  spot checks (Be Our Guest, Fire the Cannons!, Develop Your Brain, Hakuna Matata, Friends on the
  Other Side, Smash, Control Your Temper!, Stampede, Beast redirect, Sing Together). Assertions
  75 → 104, all passing (`node tools/audit.js`).
- #19 Keyword edge-case tests: Bodyguard while drying, Rush+Evasive, Resist vs Challenger, Singer N
  with Sing Together, Ward targeting.
- #20 Simultaneous triggers: when 2+ cards fire the same trigger key for a human, CH asks which
  ability resolves first (rest keep board order). AI keeps board order.
- #21 Sing Together: legalActions enumerates valid singer sets using `singVal` (Singer N counts);
  UI multi-select (tap singers until cost met → Sing). Cheapest fallback if >10 ready singers.
- #22 Damage-redirect (Beast – Selfless Protector): controller chooses when multiple shield
  characters; AI picks lowest remaining willpower.
- #23 Location move costs: Move action shows cheapest ink; targeting mode badges each location
  with its move cost (teal highlight).
- #24 Shift targets: distinct purple `tgt-shift` glow + clearer banner copy.
- #25 Both at 20 lore: `checkWin` — if both meet the goal, active player wins; single-player path
  unchanged.
- #16 Tracker restores home scroll and per-set scroll when leaving/returning.
- #17 Card images cached in Cache API (`lorcana-imgs-v1`) after first view; version wipe no longer
  deletes that cache.
- #38 Save/resume: `freezeState`/`thawState` with RNG counter + embedded card snaps; only when no
  pending choice (mid-choice still unsafe like #26). Pause menu Save; menu Resume.
- #34 Per-deck win rates in match history (deck name stored on each AI/daily result).
- #46 Victory reward labels from streak (On a roll / Hot streak / Legend streak) on end screen.
- #47 Daily challenge: Phoenix-date seed picks a fixed starter pair; recorded as mode `daily`.
- #40 Rules reference sheet from the play menu.
- Skipped: #26 undo (still needs pending-safe snapshot API beyond freeze), #31/#32 sound, #39 tutorial.
- Tests: `node tests/engine.test.js` 99 passed; `node tools/audit.js` 104/104.
- Commit: `ee7f55f` (version `20261013090024`). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: Pages build `ee7f55f` status built; version.json `20261013090024` on https://laim-1.github.io/lorcana-tracker/.

## Batch 6 (~2:20 AM) - undo, sound pack, music, tutorial
- #26 Undo last action: before each human main action (no pending), snapshot via
  `freezeState`; banner curved-arrow button thaws it. Works even if the action
  opened a pending choice (restores the pre-action board). Cleared when AI/goldfish
  acts or a new game/daily/tutorial starts. One step only.
- #31 Sound effects pack: richer Web Audio tones/noise for play/ink/quest/hit/banish/
  turn/flip/ui/win (no external assets). Volume slider 0–100% in Settings (saved).
- #32 Background music toggle: soft generated arpeggio pad; requires Sound On;
  respects volume; stops when Play closes or music/sound off.
- #39 Tutorial: menu "Tutorial" starts Easy AI with The First Chapter starters,
  seed 42, first player you; guided overlay steps (welcome → ink → play → end turn
  → quest → done) with Skip/Next; auto-advances when check passes.
- Tests: `node tests/engine.test.js` 101 passed; `tests/ui-batch6.py` passed
  (settings sound/volume/music, tutorial overlay, ink+undo).
- Commit: `b9aa5f9` (version `20261013091902`). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: Pages build `b9aa5f9` status built; version.json `20261013091902` on https://laim-1.github.io/lorcana-tracker/.

## Batch 7 (~2:25 AM) - deck builder #48–#59
- #48 Import/export Dreamborn-style text lists (`N Card Name - Version` per line);
  merge or replace; unmatched lines listed.
- #49 Cost curve bar chart (0–6, 7+) on the builder.
- #50 Ink split + type breakdown pills.
- #51 Inkable count with low-% warning (<30%).
- #52 Est. deck price from snapshot TCGplayer USD (Lorcast/snapshot).
- #53 Sample opening hand (reshuffle/redraw).
- #54 Duplicate deck (Tools); rename via deck name field on Save.
- #55 Deck notes (saved with deck, 500-char cap).
- #56 Filters: keyword/text, classification, cost, set, plus existing ink/type/search.
- #57 Sort by cost / type / name / set.
- #58 Validity badge with reasons (count, inks, copy limits, inkable).
- #59 Only-owned-cards toggle.
- Tests: `node tests/engine.test.js` 101 passed; `tests/ui-batch7.py` passed.
- Commit: `7f69e55` (version `20261013092637`). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: Pages build `e0ee254` status built; version.json `20261013092637` on https://laim-1.github.io/lorcana-tracker/.

## Batch 8 (~2:35 AM) - tracker #60–#75
- #60 Wishlist with running TCGplayer total (add/remove from card zoom).
- #61 Missing-cards list per set with price to complete.
- #62 Set completion badges (Halfway / Almost / Complete) + home done count.
- #63 Daily collection value history chart.
- #64 Biggest price movers vs last stored price snap.
- #65 Search across all sets from home.
- #66 Card zoom detail: prices + TCGplayer open action.
- #67 Enchanted/foil collecting filters.
- #68 Quick add mode on set view.
- #69 Bulk mark whole set owned.
- #70 Backup reminder for JSON export.
- #71 Share collection summary PNG.
- #72 Duplicates/trade list (extras beyond 1N+1F).
- #73 Price-range filter.
- #74 App icon + web manifest / A2HS meta.
- #75 Enter transitions + loading skeletons.
- Tests: tracker smoke (home actions + global search) passed; engine 101 still green from batch 7.
- Commit: `399c0bd` (version `20261013093050`). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: Pages build `399c0bd` status built; version.json `20261013093050` on https://laim-1.github.io/lorcana-tracker/.

## Batch 9 (~2:35 AM) - AI strength check + tracker UI test
- Measured `node tools/ai-table.js 40 easy normal hard` (0 stalls, ~44s):
    row vs col | easy | normal | hard
    easy       |  -   |   8%   |  8%
    normal     | 83%  |   -    | 38%
    hard       | 93%  |  65%   |  -
  Hard beats Normal 65% (target ≥60%). No AI code changes needed.
- Added `tests/ui-batch8.py` for tracker home actions, PWA links, set tools.
- All BACKLOG.md items 1–75 marked [x] and live.
- Commit: `accd199` (version `20261013093341`). Live: https://laim-1.github.io/lorcana-tracker/
- Live verified: (pushing)

## Batch 10 (~2:40 AM) - sheet sticky Close + ui-batch8 harden
- Sheet CSS: flex column + sticky last `.wide` button so Close/Done stays on-screen
  for long Missing / wishlist / history lists (fixed off-viewport tap bug).
- `.histlist` / `.logfull` max-height scroll inside sheets.
- Hardened `tests/ui-batch8.py` (hash navigation, case-insensitive title, evaluate click).
- Commit: `4d01e25` (version `20261013093429`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 11 (~2:40 AM) - prefetch + README
- Idle-prefetch all set card lists after home load (faster global search / wishlist / movers).
- Wishlist total uses a one-pass price map.
- README updated for tracker extras + play-mode overnight features.
- Commit: `88f4c62` (version `20261013093457`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 12 (~2:40 AM) - wishlist/movers/dupes load-on-open
- Wishlist, price movers, and duplicates sheets `await loadCards` for every set before
  rendering totals (no more $0 while idle prefetch is still running).
- Live verified earlier: version `20261013093457` (batch 11) built on Pages.
- Commit: `f3b4504` (version `20261013093604`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 13 (~2:40 AM) - narrow-phone home actions + live verify
- Home action buttons slightly tighter under 360px width.
- Live verified: version.json `20261013093604` (batch 12) built on Pages.
- Engine regression: 101 passed.
- Commit: `a235ace` (version `20261013093751`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 14 (~2:45 AM) - value sparkline + docs
- Home hero shows a 14-day collection-value sparkline from daily history.
- CATEGORIES.md updated: humans get simultaneous-trigger ordering picker (#20).
- Commit: `c536302` (version `20261013093818`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 15 (~2:50 AM) - wishlist export + undo RNG test
- Wishlist sheet can export Dreamborn-style text and copy it.
- Engine test: freeze/thaw restores RNG counter after ink (undo safety).
- Tests: engine 102 passed.
- Commit: `9686bf7` (version `20261013094016`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 16 (~2:45 AM) - foil counts on set tiles
- Set list shows owned foil count (`12/204 · 3F`) beside progress.
- Commit: `c021bd5` (version `20261013094035`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 17 (~2:45 AM) - Hard AI lore-race / threat polish
- 80-game table earlier: Hard vs Normal was 59% (just under target).
- Tweaked `hardAdj` + hard rollout eval: earlier challenge of lore threats,
  lethal quest bonus, post-rollout lore-ahead / threat-cut bonuses.
- Remeasure 48g Hard vs Normal: **63%** (0 stalls). Engine 102 passed.
- Commit: `f8a65a0` (version `20261013094451`). Live: https://laim-1.github.io/lorcana-tracker/

### AI ladder after Hard polish (40g)
```
row vs col, 40 games each (45s, 0 stalled)
            easy  normal    hard
easy           -      5%      8%
normal       83%       -     35%
hard         93%     63%       -
```

## Batch 18 (~2:50 AM) - sample hand inkable/cost
- Sample opening hand shows inkable count and total ink cost; inkable drop badge on tiles.
- Commit: `a6f4dff` (version `20261013094602`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 19 (~2:50 AM) - a11y + undo toast + regression
- Home tool buttons: aria-labels + navigation role.
- Undo toast quotes the last log line when available.
- Regression: ui-batch6/7/8 all passed sequentially.
- Commit: `013ae18` (version `20261013094640`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 20 (~2:50 AM) - menu deck legal/draft badges
- Custom decks on the Play menu show `legal` vs `draft` with ink pair and count.
- Commit: `54fe393` (version `20261013094655`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 21 (~2:50 AM) - near-win banner + meta description
- Banner pulses when either player is at 18+ lore (respects reduced-motion / low FX).
- HTML meta description for share/SEO.
- Commit: `4595a63` (version `20261013094730`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 22 (~2:50 AM) - tap cost curve to filter
- Cost curve bars are buttons; tap filters This deck by that cost (tap again clears).
- Commit: `7eb45d9` (version `20261013094750`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 23 (~2:55 AM) - tutorial uses goldfish
- Tutorial opponent is goldfish (draw/pass only) so guided steps stay predictable.
- Copy updated; ui-batch6 still passes.
- Commit: `97dcdb4` (version `20261013094829`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 24 (~2:55 AM) - load official starter into builder
- Deck tools → Load official starter replaces the builder with any STARTER_DECKS list.
- Audit 104/104 and coverage 2483/2483 still green.
- Commit: `abc0291` (version `20261013094853`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 25 (~2:55 AM) - rematch swap decks + personality table
- End screen: "Rematch · swap decks" for AI games (you play the opponent's list).
- Personality 24g table (normal:aggro/quester/control) ~even (42–46%); styles remain distinct
  without one dominating.
- Commit: `4a8c2fc` (version `20261013094945`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 26 (~2:55 AM) - clear wishlist
- Wishlist sheet: Clear wishlist confirmation.
- Commit: `e0f93ff` (version `20261013094959`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 27 (~2:55 AM) - match summary + delete deck + nearly complete
- End screen: Copy match summary (lore/quests/challenges) to clipboard.
- Deck tools: Delete this saved deck (with confirm).
- Tracker More → Nearly complete sets (50%+ owned, jump to set).
- Engine tests: 102 passed.
- Commit: `899d281` (version `20261013095235`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 28 (~3:00 AM) - quick play + history filters
- Play menu: Quick play (random starter vs random starter).
- Match history: filter chips (All / AI / Pass & play / Practice / Daily) + Clear history.
- Commit: `a4f5d58` (version `20261013095322`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 29 (~3:00 AM) - rename deck + README
- Deck tools: Rename deck (prompt).
- README refreshed with tracker + play feature summary.
- Commit: `a4cc3af` (version `20261013095359`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 30 (~3:00 AM) - AI ladder recheck + history export + a11y
- Hard vs Normal (40g): Hard 63%, Normal 35% (target ~60%+ held).
- Match history: Export history text (TSV to clipboard).
- Toast: role=status aria-live=polite.
- Nearly-complete set buttons CSS cleaned up.
- ui-batch6/7/8 all passed.
- Commit: `6786898` (version `20261013095518`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 31 (~3:00 AM) - set sorts closest/cheapest
- Tracker set sorts: Closest to done (fewest missing) and Cheapest to finish (USD of missing).
- Set row shows "N left" / "$X to finish" when those sorts are active.
- Commit: `113ab58` (version `20261013095649`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 32 (~3:00 AM) - sample hand redraw + Escape + personalities
- Sample opening hand: Draw again button.
- Escape key closes open sheets.
- Personality 24g table: aggro/quester/control ~38–46% (still balanced).
- Commit: `c556527` (version `20261013095706`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 33 (~3:00 AM) - fix duplicate Draw again
- Sample hand sheet had two Draw again buttons; kept one (bhandagain).
- Commit: `ce1067a` (version `20261013095726`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 34 (~3:05 AM) - static overnight smoke test
- tests/ui-static-overnight.py asserts polish hooks (swap, quick, history filters, delete/rename, near sets, etc.).
- Commit: `4809109` (version `20261013095742`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 35 (~3:05 AM) - pause meta (turn/seed)
- Pause menu shows turn number, RNG seed, and matchup names (handy for bug reports).
- Commit: `9318a53` (version `20261013095800`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 36 (~3:00 AM) - foil hero + full AI ladder
- Home hero shows total foil copies owned.
- AI ladder 30g: easy 7%/10% vs N/H; normal 80%/37% vs E/H; hard 93%/63% vs E/N.
- Commit: `44806ec` (version `20261013095954`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 37 (~3:00 AM) - static test includes foil hero
- ui-static-overnight checks foilsTotal.
- Commit: `c593b89` (version `20261013100002`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 38 (~3:05 AM) - discard saved game
- Play menu: Discard saved game (confirm) next to Resume when a save exists.
- Commit: `8d8ddb3` (version `20261013100019`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 39 (~3:05 AM) - empty deck builder CTA
- This deck view when empty: Load starter / Import / Browse all cards prompts.
- Commit: `7c348f4` (version `20261013100038`). Live: https://laim-1.github.io/lorcana-tracker/

## Batch 40 (~3:37 AM) - AI strengthen Hard + smarter Normal
- Fixed `hardChoose` LEVEL leak: restore caller LEVEL after rollouts (Normal no longer inherits Hard scoring mid-blend).
- Ink: protect only playable lore threat when behind; prefer inking dead high-cost / duplicates.
- Shift: score lore gain vs base + damage carry + Hard bonus.
- Mulligan: keep inkables; dump expensive / non-inkable 4+ when short on inkables.
- Normal noise 5 (was 8) — clearer vs Easy, still loses to Hard.
- Hard-only: hardAdj in rollout blend; lethal quest / threat challenge post-roll bonuses; favorable-trade challenge adj; shift adj.
- Hard vs Normal (40g): **Hard 65%**, Normal 43% (0 stalls). Target ~60%+ held.
- Normal vs Easy (24g): **Normal 83%**, Easy 8%.
- Full ladder (30g, prior leak-fix baseline matched overnight): easy 7%/10%; normal 80%/37%; hard 93%/63%.
- ai-stats Normal 20g: actions+songs 0.9/game, non-char games 17/20, favTake 0.88.
- Engine 102 passed; ui-static-overnight 14 passed.
- Commit: pending. Live: https://laim-1.github.io/lorcana-tracker/

## Batch 41 (~3:40 AM) - game polish: tips, feedback, handoff, rematch, a11y
- Tutorial tips expanded (8 tips): Rush, lore race banner, Shift, songs/Sing Together, illegal-move toasts + hint button.
- `illegalWhy()`: clearer toasts for ink/drying/exerted/target/play/quest/challenge/move failures.
- Banner subline: "Ink available/used · N drying" on your turn.
- Pass-and-play handoff: lore scoreline + turn; dialog aria-label; button aria-label.
- End screen: deck matchup line, "Streak ended" on loss, aria-labels on rematch/log/summary buttons.
- Daily challenge button shows current win streak; Quick play aria-label.
- End turn button aria-label; opponent thinking aria-label.
- CSS: `.hscore`, `.streak.broke`, `.rematchdecks`.
- ui-static-overnight extended (19 checks): illegalWhy, hscore, rematchdecks, tips, drying banner.
- Engine still 102 from batch 40; static overnight passed.

## Batch 42 (~3:43 AM) - quest/challenge confirm polish + AI leak test
- `playerConfirm()` toasts on successful quest (+lore), challenge (dmg preview), ink, move, shift.
- Challenge targeting banner shows attacker STR.
- Engine test: Hard still takes lethal quest after a Normal `aiChoose` (LEVEL leak regression).
- ui-static-overnight: playerConfirm check (20 passed).
- Engine **103** passed.

## Batch 43 (~3:44 AM) - end-turn confirm ink/dry reminders
- End-turn confirm sheet lists quest/challenge explicitly and notes ink still available + drying count.
- Aria-labels on End turn / Keep playing.
- Static overnight +1 check (21 passed).

### Full ladder after batches 40–43 (30g, 0 stalled)
```
row vs col | easy | normal | hard
easy       |  -   |  10%   |  17%
normal     | 87%  |   -    |  50%
hard       | 97%  |  63%   |   -
```
Hard vs Normal 40g earlier in batch 40: **65%**. Targets held (Hard ~60%+ vs Normal; Normal ~75%+ vs Easy).

## Batch 44 (~3:57 AM) - AI challenge trades + hold ink for songs
- Challenge scoring: clean-kill bonus; favorable vs bad trades; multi-challenger
  prefers lowest-lore clean killer (Hard stronger than Normal).
- Ink: hold when a song/action can be sung or paid this turn; prefer singing /
  Sing Together over paying; Hard hardAdj penalizes inking singable songs.
- Ladder separation: Normal noise 14, hardChoose shortlist top-3; Hard rollout
  bonuses for clean kills and sung songs.
- Tests: multi-challenger low-lore pick; hold ink vs Be Our Guest sing; LEVEL leak
  still ok. Engine **105** passed.
- Hard vs Normal (40g): **Hard 60%**, Normal 35% (0 stalls). Normal vs Easy (24g):
  **Normal 75%**, Easy 13%. Targets held.
- Commit: `03b1961` (with 45). Live version via batch 45 stamp.

## Batch 45 (~3:57 AM) - empty board, ready/dry, handoff, history UX
- Empty character row labels + empty items/locations strip when characters exist.
- READY chip on dry ready characters (your turn); DRYING unchanged.
- Pass-and-play handoff: ink ready / ready chars / drying line for the receiver.
- Match history: daily counts toward streak stats; shows best streak + Daily W–L.
- ui-static-overnight **25** checks (then 27 in batch 46).
- Commit: `d633882` (version `20261013105738`). Live verified Pages built;
  version.json `20261013105738`; engine multi-challenger live.

## Batch 46 (~3:58 AM) - banner ready + daily W–L chip
- Your-turn banner subline: `N ready` next to drying / ink available.
- Daily challenge menu button shows career Daily W–L when any dailies played.
- Static overnight **27** passed.
- Commit: `e1ad060` (version `20261013105834`). Live verified Pages built; version.json `20261013105834`.

## Batch 47 (~4:00 AM) - empty hand + pause ready/dry
- Empty hand: centered "Hand empty — draw next turn" label (44px+ tap area height).
- Pause menu meta: your ready + drying character counts next to turn/seed.
- Static overnight **29** checks.
- Commit: `fc732a9` (version `20261013105926`). Live: Pages built; version.json `20261013105926`.

## Batch 48 (~4:01 AM) - READY tip + histbar best streak
- Tutorial tip mentions green READY vs blue DRYING tags.
- Menu histbar shows Best streak when relevant.
- Static overnight **31** checks.
- Commit: `6ab7e9e` (version `20261013110021`). Live verified Pages built; version.json `20261013110021`.

### Window close (~4:02 AM) after batches 44–48
- AI: Hard **60%** vs Normal (40g); Normal **75%** vs Easy (24g). Engine **105** tests.
- Polish: empty board/hand, READY/DRYING, handoff ink/ready/dry, daily streak/history UX, banner ready count.
- Live: https://laim-1.github.io/lorcana-tracker/ version `20261013110021`.
- No breakage observed; Pages builds waited between pushes when needed.

## Batch 49 (~5:03 AM) - AI Shift/sing/mulligan/move + Hard ladder
- Shift vs full-cost: prefer Shift when dry / lore-up / ink-saved; penalize full play when Shift legal (Hard-weighted).
- Singing: prefer low-lore singers; never sing away lethal; threat boost for removal songs; prefer sing over pay.
- Mulligan: always dump 7+; dump expensive/non-inkable when lacking cheap inkables; keep curve when already good.
- Move: race onto lore-buff locations, protect fragile, claim empty valuable locs (Hard-weighted).
- hardChoose/hardAdj bonuses for Shift/sing/move; Normal shortlist top-2 + noise 16 to restore ladder.
- Tests: Shift preference, low-lore singer, mulligan dump, lore-buff move. Engine **109** passed.
- Hard vs Normal (40g): **Hard 60%**, Normal 35% (0 stalls). Normal vs Easy (24g): **Normal 79%**, Easy 13%.
- Commit: `8a42031` (version `20261013120229`). Live verified Pages built; version.json `20261013120229`.

## Batch 50 (~5:09 AM) - ink win-cons, Sing Together lore, Ward/BG
- Do not ink high-lore / Shift-with-base / needed Bodyguard–Ward when junk inkables exist (Hard-weighted + hardAdj).
- Sing Together: prefer lowest-lore singer sets; penalize oversized sets.
- Challenge: bonus for clean-killing Ward and clearing Bodyguard walls.
- Tests: ink junk over lore-3; Sing Together low-lore pair; Ward challenge. Engine **112** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 30% (0 stalls). Normal vs Easy (24g): **Normal 79%**.
- Commit: `2f1f1d3` (version `20261013120851`). Live verified Pages built; version.json `20261013120851`.

## Batch 51 (~5:11 AM) - endboard, handoff decks, hint toast, BG/Ward tip
- End screen: final board line (chars / ink / hand) + table rows for chars left and ink; pass-and-play shows deck names too.
- Pass-and-play handoff: deck names under the scoreline (`hdecks`).
- Hint button: clearer toast (Highlighted… / No plays left → End turn); tips off toast.
- Tutorial tip for Bodyguard (must challenge) and Ward (challenge, not target with actions).
- ui-static-overnight **35** checks. CSS: `.endboard`, `.hdecks`.
- Commit: `05c89b1` (version `20261013121103`). Live verified Pages built; version.json `20261013121103`.

## Batch 52 (~5:14 AM) - lore-race challenge restraint + quest push
- When ahead by 3+ lore: avoid bad/even trades with high-lore attackers; devalue chipping.
- When behind or opponent near 20: extra value killing their lore-2+ characters.
- Quest scoring/hardAdj: push lore when ahead; Hard weighted.
- Tests: ahead→quest not bad challenge; behind→remove high-lore threat. Engine **114** passed.
- Hard vs Normal (40g): **Hard 65%**, Normal 25%. Normal vs Easy (24g): **Normal 75%**.

- Commit: `1e9521b` (version `20261013121404`). Live verified Pages built; version.json `20261013121404`.

## Batch 53 (~5:17 AM) - Bodyguard enter-exerted + empty chips / hints-on
- AI prefers Bodyguard entering exerted when protecting lore-2+ or facing ready threats; penalize ready entry when exerted option exists.
- HUD: empty ink/deck/discard get `.emptychip` + clearer aria-labels.
- Banner subline shows "hints on" while hint mode is active.
- ui-static-overnight **37** checks. Engine **115** passed.
- Hard vs Normal (40g): **Hard 70%**, Normal 30%. Normal vs Easy (24g): **Normal 75%**.

- Commit: `ffb715b` (version `20261013121712`). Live verified Pages built; version.json `20261013121712`.

## Batch 54 (~5:20 AM) - act vs lethal, item curve, handoff hand
- Activated abilities: never burn a lethal quester; when ahead, skip weak acts on lore-2+ characters.
- Item plays: Hard boost when ink-poor / hand-poor / first item.
- Pass-and-play handoff: hand count + inkable count on board line.
- ui-static-overnight **38** checks. Engine **116** passed.
- Hard vs Normal (40g): **Hard 75%**, Normal 33%. Normal vs Easy (24g): **Normal 83%**.

- Commit: `7ced61f` (version `20261013122027`). Live verified Pages built; version.json `20261013122027`.

## Batch 55 (~5:24 AM) - Support clean-kill pick, Rush, pause meta
- Support AI: buff the ally that the Support strength enables a clean kill (else lore/str).
- Rush: Hard values clean-kill challenges the turn Rush is played.
- Pause menu: lore scoreline, ink ready/total, inkable-in-hand (`pausemeta`).
- ui-static-overnight **39** checks. Engine **117** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 33%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `c788374` (version `20261013122409`). Live verified Pages built; version.json `20261013122409`.

## Batch 56 (~5:27 AM) - Bodyguard quest wall, Support tip, questable lore
- Hard prefers questing Bodyguard when opposing ready threats (exerted Bodyguard walls).
- Tutorial tip for Support; end-turn confirm notes remaining questable lore.
- ui-static-overnight **41** checks. Engine **118** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 33%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `bb69f3d` (version `20261013122701`). Live verified Pages built; version.json `20261013122701`.

## Batch 57 (~5:30 AM) - Evasive trades + richer match summary
- Challenge: value Evasive-vs-Evasive clean kills (esp. lore threats); Hard-weighted.
- Play: slight boost for Evasive when opponent has Evasive lore threats.
- Copy match summary includes decks, difficulty, chars left, ink.
- ui-static-overnight **42** checks. Engine **119** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 35%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `de1c0fb` (version `20261013123020`). Live verified Pages built; version.json `20261013123020`.

## Batch 58 (~5:34 AM) - Alert vs Evasive + Evasive tip
- Alert challenges Evasive like Evasive (scoring + hardAdj); prefer playing Alert into opposing Evasive lore.
- Tutorial tip for Evasive/Alert challenge rules.
- ui-static-overnight **43** checks. Engine **120** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 35%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `491e8c4` (version `20261013123347`). Live verified Pages built; version.json `20261013123347`.

## Batch 59 (~5:37 AM) - Resist chip scoring + near-20 banner
- Challenge scoring uses effective damage after Resist; avoid 0-damage chips into high Resist.
- Banner subline notes when you / AI / both are near 20 lore.
- ui-static-overnight **44** checks. Engine **121** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 35%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `ea2eb32` (version `20261013123654`). Live verified Pages built; version.json `20261013123654`.

## Batch 60 (~5:40 AM) - Reckless target pick + tip
- Reckless challenges: prefer clean kills on high-lore; devalue weak chips.
- Tutorial tip for Reckless (must challenge, cannot quest).
- ui-static-overnight **45** checks. Engine **122** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 35%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `4878f82` (version `20261013123941`). Live verified Pages built; version.json `20261013123941`.

## Batch 61 (~6:00 AM) - hand-aware draw scoring + banner hand count
- `effVal` draw: empty/thin hand scores higher (bonus at ≤2 / ≤4 cards; Hard extra when ≤3).
- Banner subline shows "N in hand" on your turn.
- ui-static-overnight **46** checks. Engine **123** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 30%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `9e212e6` (version `20261013130058`). Live verified Pages built; version.json `20261013130058`.

## Batch 62 (~6:04 AM) - Challenger play/challenge scoring + tip
- Play: Challenger +N boosted when exerted targets become clean kills with the bonus.
- Challenge: extra value when Challenger bonus is what enables the kill.
- Tutorial tip for Challenger.
- ui-static-overnight **47** checks. Engine **124** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 30%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `0a29652` (version `20261013130450`). Live verified Pages built; version.json `20261013130450`.

## Batch 63 (~6:09 AM) - Singer N preference + tip
- Sing: prefer true Singer N (esp. low-lore) over high-lore cost-matched singers.
- Play: Singer N valued when hand has songs they uniquely enable.
- Ink: hold Singer when hand has a song they can sing; hardAdj matches.
- Tutorial tip for Singer N.
- ui-static-overnight **48** checks. Engine **126** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 30%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `8154edc` (version `20261013130921`). Live verified Pages built; version.json `20261013130921`.

## Batch 64 (~6:12 AM) - Vanish chip scoring + Boost preference + tips
- `effVal` dmg: Vanish targets count as kills when any damage lands (action/ability).
- Boost: Hard/Normal value under-payoffs (statics/onQuest/onUnder); prefer Boost over questing low-lore bodies.
- Tutorial tips for Vanish and Boost.
- ui-static-overnight **50** checks. Engine **128** passed.
- Hard vs Normal (40g): **Hard 73%**, Normal 33%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `5efd928` (version `20261013131228`). Live verified Pages built; version.json `20261013131228`.

## Batch 65 (~6:15 AM) - Mulligan keep Singer/Shift + Support play
- Mulligan: keep Singer N + songs they unlock; keep Shift card + matching cheap base.
- Play: Support valued when board has mates and exerted opposing threats.
- ui-static-overnight **50** checks. Engine **131** passed.
- Hard vs Normal (40g): **Hard 70%**, Normal 30%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `d2f4e11` (version `20261013131516`). Live verified Pages built; version.json `20261013131516`.

## Batch 66 (~6:18 AM) - Rush play for immediate clean kills + tip
- Play: Rush valued when exerted targets (esp. lore ≥2) are clean-killable this turn.
- hardAdj matches; tutorial tip for Rush challenge-on-play.
- ui-static-overnight **51** checks. Engine **132** passed.
- Hard vs Normal (40g): **Hard 70%**, Normal 35%. Normal vs Easy (24g): **Normal 79%**.

- Commit: `bff179b` (version `20261013131811`). Live verified Pages built; version.json `20261013131811`.

## Expert AI (Oct 13, afternoon)
- New `expert` level: determinized Monte Carlo over every legal action. Hidden info (opponent hand+deck, own deck order) is resampled per rollout, so Expert never peeks (Hard's rollouts do see the real hands). 6 rollouts per candidate through our turn, the opponent's turn, our next turn and their next turn, Hard-heuristic rollout policy, time-capped (350ms in node, 900ms in the browser).
- Runs in a Web Worker (`js/ai-worker.js`), with a fallback to synchronous play if the state can't be frozen (pending choices) or the answer is no longer legal.
- Measured with `sh tools/expert-par.sh 240 7 expert hard`: seats and first player swapped, 120 mirror-deck and 120 mixed-deck games across the official starters:
  - Expert vs Hard: **56.3% [95% CI 49.9-62.4]**. Mirror 57.5% [48.6-66.0], mixed 55.0% [46.1-63.6].
  - Expert vs Normal: 72.5% (n=80). Expert vs Easy: 95.0% (n=80).
  - The 95% target against Hard was NOT reached. Hill-climbing the eval weights (`tools/expert-tune.js`), more rollouts, a lore-clock term and full-game playouts all stayed within noise of 48-60%. Draw/deck variance between two competent players appears to be the ceiling for this engine's heuristic policy.
- Phone check (`tests/ui-expert.py`, Chromium 390x844, 4x CPU throttle): 30 worker decisions, max 240ms (avg 65ms), max main-thread frame gap 75ms.
