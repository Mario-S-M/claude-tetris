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

- **`index.html`** — DOM structure: two `<canvas>` elements (`#board` 300×600, `#next-canvas` 120×120), a sidebar panel, and a hidden overlay for PAUSE / GAME OVER states.
- **`style.css`** — Dark/retro arcade theme; layout via flexbox.
- **`game.js`** — All game logic (~305 lines, `'use strict'`, ES6+).

### game.js internals

| Concern | Key identifiers |
|---|---|
| Board state | `board` — `ROWS×COLS` matrix; `0` = empty, `1–7` = piece color index |
| Pieces | `PIECES` — array of matrix shapes indexed 1–7; `COLORS` maps the same indices to hex strings |
| Active piece | `current` / `next` — `{ type, shape, x, y }` objects |
| Collision | `collide(shape, ox, oy)` — boundary + board overlap check |
| Rotation | `rotateCW(shape)` — transpose + reverse; `tryRotate()` applies wall kicks `[0, ±1, ±2]` |
| Game loop | `loop(ts)` via `requestAnimationFrame`; `dropAccum` + `dropInterval` drive gravity |
| Line clear | `clearLines()` — splice + unshift on `board`; updates score, lines, level, `dropInterval` |
| Scoring | `LINE_SCORES = [0,100,300,500,800]` × level; hard drop +2/cell, soft drop +1/row |
| Speed | `dropInterval = max(100, 1000 − (level−1) × 90)` ms |
| Ghost piece | `ghostY()` projects landing row; drawn at `globalAlpha = 0.2` |
| Rendering | `draw()` clears canvas, draws grid → board → ghost → current piece; `drawNext()` for sidebar |
| Entry point | `init()` resets all state and starts the loop; called on load and on restart button click |

### Game flow

```
init()
  └─ createBoard() → spawn() → requestAnimationFrame(loop)
       loop(ts): accumulate dt → gravity drop or lockPiece()
                 lockPiece(): merge() → clearLines() → spawn()
                 draw() every frame
keydown → move / tryRotate / softDrop / hardDrop / togglePause
spawn() collision on entry → endGame()
```

## Key tuning constants (top of game.js)

| Constant | Default | Note |
|---|---|---|
| `COLS` / `ROWS` | `10` / `20` | Change canvas `width`/`height` in `index.html` to match (`COLS×BLOCK`, `ROWS×BLOCK`) |
| `BLOCK` | `30` (px) | Cell size in pixels |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points for 1–4 lines cleared |
