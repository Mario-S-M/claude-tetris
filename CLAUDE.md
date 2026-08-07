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

- **`index.html`** — DOM structure: two `<canvas>` elements (`#board` 300×600, `#next-canvas` 120×120), a sidebar panel, a `#start-screen` overlay (shown on load) and a hidden `#overlay` holding **two mutually exclusive boxes**: `#pause-menu` and `#gameover-box`. Only one is visible at a time; the other carries the `hidden` class.
- **`style.css`** — Dark/retro arcade theme + per-skin overrides; layout via flexbox.
- **`game.js`** — All game logic (~900 lines, `'use strict'`, ES6+).

### game.js internals

| Concern | Key identifiers |
|---|---|
| Board state | `board` — `ROWS×COLS` matrix; `0` = empty, `1–8` = piece color index |
| Pieces | `PIECES` — array of matrix shapes indexed 1–7 (standard tetrominoes) plus `8` (3×3 ring/"anillo" challenge piece with a hollow center, spawned rarely — `RING_CHANCE = 0.08` in `randomPiece()`) |
| Skins | `SKINS` — `retro` / `neon` / `pastel` / `pixel`, each with `label`, `colors` (indexed like `PIECES`), `ghostAlpha`, and a `block(ctx, px, py, size, color, alpha)` renderer. `applySkin()` sets a `body.skin-<name>` class so CSS can override `--board-bg` / `--grid-color`; persisted in `localStorage` under `skin` |
| Active piece | `current` / `next` — `{ type, shape, x, y }` objects |
| Collision | `collide(shape, ox, oy)` — boundary + board overlap check |
| Rotation | `rotateCW(shape)` — transpose + reverse; `tryRotate()` applies wall kicks `[0, ±1, ±2]` |
| Game loop | `loop(ts)` via `requestAnimationFrame`; `dropAccum` + `dropInterval` drive gravity |
| Line clear | `clearLines()` — splice + unshift on `board`; updates score, lines, level, `dropInterval`; returns rows cleared |
| Scoring | `LINE_SCORES = [0,100,300,500,800]` × level; hard drop +2/cell, soft drop +1/row |
| Combo | `combo` — streak of consecutive locks that cleared lines (reset on a lock with no clear); `maxCombo` is the run's peak. Tracked in `lockPiece()`, shown in the sidebar; **does not affect scoring** |
| Speed | `speedFor(level)` → `max(100, 1000 − (level−1) × 90)` ms |
| Pause menu | `pause()` / `resume()` / `togglePause()`; `showMenuView('main' \| 'controls')` swaps the two views inside `#pause-menu`; `handleMenuKey()` owns all keys while paused (game input is blocked) |
| Start level | `startLevel` (`MIN_LEVEL`–`MAX_LEVEL`), set via `setStartLevel()`, persisted in `localStorage`; applies on the next `init()`. In-game level is `startLevel + floor(lines / 10)`. Two steppers share the state — one on `#start-screen`, one in `#pause-menu` — kept in sync by `LEVEL_STEPPERS` |
| Ghost piece | `ghostY()` projects landing row; drawn at the active skin's `ghostAlpha` |
| Rendering | `draw()` clears canvas, draws grid → board → ghost → current piece (returns early when `current` is `null`, i.e. the start screen); `drawNext()` for sidebar. `drawBlock()` only resolves the color and delegates to the active skin's `block()`; `redrawAll()` repaints both canvases outside the loop (theme/skin changes while paused or game over) |
| Records | `localStorage`: `tetris-records` (top `MAX_RECORDS = 5`, `{name, score, lines, level, combo, date}`), `tetris-stats` (`{bestCombo, maxLines}`, updated every game over regardless of top-5), `tetris-last-name`. `loadRecords()` sanitizes/sorts/trims; `renderRecords(container, highlightIndex)` builds the table via DOM APIs (never `innerHTML` — names are user input) |
| Storage | Two layers: `storageGet` / `storageSet` wrap raw `localStorage` with try/catch (private browsing); `readStore` / `writeStore` add JSON on top. **Never call `localStorage` directly** |
| Entry point | `showStartScreen()` on load (empty board + records); `init()` resets state and starts the loop, called from the Jugar / Reiniciar buttons and Enter/Space on the start screen. Theme, skin and start level are applied **once at startup**, not inside `init()` |

### Game flow

```
startup: buildSkinOptions() → theme/skin/startLevel → showStartScreen()
showStartScreen()          ← current = null, records rendered, started = false
  └─ Jugar / Enter / Space → init()
init()  (started = true)
  └─ createBoard() → spawn() → requestAnimationFrame(loop)
       loop(ts): accumulate dt → gravity drop or lockPiece()
                 lockPiece(): merge() → clearLines() → combo/maxCombo → spawn()
                 draw() every frame
spawn() collision on entry → endGame()
       endGame(): updateStats() → qualifiesForTop(score)
                  ? show #name-form, set pendingRecord
                  : records only
       submit / Reiniciar → savePendingRecord(name) → highlight new row
```

The `keydown` handler dispatches in a **fixed order** — changing it breaks things:

```
1. target is <input>       → return          (typing a name)
2. gameOver                → return
3. paused                  → handleMenuKey() (BEFORE the focus guard: the pause
                                              menu focuses its own buttons)
4. !started                → handleStartKey() (Enter/Space play, ←/→ set level)
5. target is SELECT/BUTTON → return          (panel controls own their keys)
6. otherwise               → game input + P/Esc to pause
```

## Key tuning constants (top of game.js)

| Constant | Default | Note |
|---|---|---|
| `COLS` / `ROWS` | `10` / `20` | Change canvas `width`/`height` in `index.html` to match (`COLS×BLOCK`, `ROWS×BLOCK`) |
| `BLOCK` | `30` (px) | Cell size in pixels |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points for 1–4 lines cleared |
| `MIN_LEVEL` / `MAX_LEVEL` | `1` / `15` | Range of the start-level steppers |
| `MAX_RECORDS` | `5` | Size of the local high-score table |
| `MAX_NAME` | `12` | Max characters for a player name |
| `DEFAULT_SKIN` | `'retro'` | Skin used when nothing is stored. Adding a key to `SKINS` is enough — the `<select>` is built from it by `buildSkinOptions()`; add matching `body.skin-<name>` CSS if the board colors should change too |
