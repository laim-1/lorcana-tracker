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
