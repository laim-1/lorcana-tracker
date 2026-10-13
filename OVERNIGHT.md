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
