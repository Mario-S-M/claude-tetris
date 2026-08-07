# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step — open `index.html` directly in a browser, or serve it with any static server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npx serve .
```

## Architecture

Three files, no dependencies, no framework:

- **`index.html`** — DOM structure: two `<canvas>` elements (`#board` 300×600, `#next-canvas` 120×120), a sidebar panel, a `#start-screen` overlay (shown on load) and a hidden `#overlay` for PAUSE / GAME OVER states.
- **`style.css`** — Dark/retro arcade theme; layout via flexbox.
- **`game.js`** — All game logic (~620 lines, `'use strict'`, ES6+).

### game.js internals

| Concern | Key identifiers |
|---|---|
| Board state | `board` — `ROWS×COLS` matrix; `0` = empty, `1–8` = piece color index |
| Pieces | `PIECES` — array of matrix shapes indexed 1–7 (standard tetrominoes) plus `8` (3×3 ring/"anillo" challenge piece with a hollow center, spawned rarely — `RING_CHANCE = 0.08` in `randomPiece()`); `COLORS` maps the same indices to hex strings |
| Active piece | `current` / `next` — `{ type, shape, x, y }` objects |
| Collision | `collide(shape, ox, oy)` — boundary + board overlap check |
| Rotation | `rotateCW(shape)` — transpose + reverse; `tryRotate()` applies wall kicks `[0, ±1, ±2]` |
| Game loop | `loop(ts)` via `requestAnimationFrame`; `dropAccum` + `dropInterval` drive gravity |
| Line clear | `clearLines()` — splice + unshift on `board`; updates score, lines, level, `dropInterval`; returns rows cleared |
| Scoring | `LINE_SCORES = [0,100,300,500,800]` × level; hard drop +2/cell, soft drop +1/row |
| Combo | `combo` — streak of consecutive locks that cleared lines (reset on a lock with no clear); `maxCombo` is the run's peak. Tracked in `lockPiece()`, shown in the sidebar; **does not affect scoring** |
| Speed | `dropInterval = max(100, 1000 − (level−1) × 90)` ms |
| Ghost piece | `ghostY()` projects landing row; drawn at `globalAlpha = 0.2` |
| Rendering | `draw()` clears canvas, draws grid → board → ghost → current piece (returns early when `current` is `null`, i.e. the start screen); `drawNext()` for sidebar |
| Records | `localStorage`: `tetris-records` (top `MAX_RECORDS = 5`, `{name, score, lines, level, combo, date}`), `tetris-stats` (`{bestCombo, maxLines}`, updated every game over regardless of top-5), `tetris-last-name`. `loadRecords()` sanitizes/sorts/trims; `renderRecords(container, highlightIndex)` builds the table via DOM APIs (never `innerHTML` — names are user input) |
| Entry point | `showStartScreen()` on load (empty board + records); `init()` resets state and starts the loop, called from the Jugar / Reiniciar buttons and Enter/Space on the start screen |

### Game flow

```
showStartScreen()          ← on load; current = null, records rendered
  └─ Jugar / Enter / Space → init()
init()  (started = true)
  └─ createBoard() → spawn() → requestAnimationFrame(loop)
       loop(ts): accumulate dt → gravity drop or lockPiece()
                 lockPiece(): merge() → clearLines() → combo/maxCombo → spawn()
                 draw() every frame
keydown → move / tryRotate / softDrop / hardDrop / togglePause
          (ignored while !started or when the target is an <input>)
spawn() collision on entry → endGame()
       endGame(): updateStats() → qualifiesForTop(score)
                  ? show #name-form, set pendingRecord
                  : records only
       submit / Reiniciar → savePendingRecord(name) → highlight new row
```

## Key tuning constants (top of game.js)

| Constant | Default | Note |
|---|---|---|
| `COLS` / `ROWS` | `10` / `20` | Change canvas `width`/`height` in `index.html` to match (`COLS×BLOCK`, `ROWS×BLOCK`) |
| `BLOCK` | `30` (px) | Cell size in pixels |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points for 1–4 lines cleared |
| `MAX_RECORDS` | `5` | Size of the local high-score table |
| `MAX_NAME` | `12` | Max characters for a player name |
