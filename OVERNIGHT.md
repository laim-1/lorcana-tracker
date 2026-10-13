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
