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
