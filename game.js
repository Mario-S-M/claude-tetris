'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#ffca28', // 8 - anillo (reto)
];

const NEON_COLORS = [
  null,
  '#00fff2', // I - cyan neon
  '#faff00', // O - yellow neon
  '#ff00ff', // T - magenta neon
  '#00ff66', // S - green neon
  '#ff2255', // Z - red neon
  '#2266ff', // J - blue neon
  '#ff8800', // L - orange neon
  '#ffea00', // 8 - anillo (reto)
];

const PASTEL_COLORS = [
  null,
  '#a8dadc', // I - pastel teal
  '#ffe8a3', // O - pastel yellow
  '#d7bde2', // T - pastel purple
  '#b8e6b8', // S - pastel green
  '#f7b7b7', // Z - pastel red
  '#aecbfa', // J - pastel blue
  '#ffd9a8', // L - pastel orange
  '#fff3b0', // 8 - anillo (reto)
];

const PIXEL_COLORS = [
  null,
  '#00e5e5', // I - 8-bit cyan
  '#e5e500', // O - 8-bit yellow
  '#a000e5', // T - 8-bit purple
  '#00b300', // S - 8-bit green
  '#e50000', // Z - 8-bit red
  '#0058f8', // J - 8-bit blue
  '#f87000', // L - 8-bit orange
  '#f8d800', // 8 - anillo (reto)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // anillo 3x3 (reto)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const HIGHSCORES_KEY = 'tetris_highscores';
const BEST_COMBO_KEY = 'tetris_best_combo';
const MAX_LINES_KEY = 'tetris_max_lines';
const MAX_HIGHSCORES = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const resumeBtn = document.getElementById('resume-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const pauseControlsPanel = document.getElementById('pause-controls-panel');
const startLevelInput = document.getElementById('start-level-select');
const startLevelValue = document.getElementById('start-level-value');
const skinSelect = document.getElementById('skin-select');

const startScreen = document.getElementById('start-screen');
const startHsList = document.getElementById('start-highscores-list');
const startBestComboEl = document.getElementById('start-best-combo');
const startMaxLinesEl = document.getElementById('start-max-lines');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const overlayNameForm = document.getElementById('overlay-highscore-form');
const nameInput = document.getElementById('player-name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const overlayHighscores = document.getElementById('overlay-highscores');
const overlayHsList = document.getElementById('overlay-highscores-list');
const overlayBestComboEl = document.getElementById('overlay-best-combo');
const overlayMaxLinesEl = document.getElementById('overlay-max-lines');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme, gridColor, startLevel;
let currentSkin;
let comboCount, bestCombo;
let gameStarted = false;

function getStoredTheme() {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return 'dark';
}

function applyTheme() {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    // ignore write failures (e.g. private browsing)
  }
}

function getStoredStartLevel() {
  try {
    const stored = parseInt(localStorage.getItem('startLevel'), 10);
    if (Number.isInteger(stored) && stored >= 1 && stored <= 15) return stored;
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return 1;
}

function storeStartLevel(value) {
  try {
    localStorage.setItem('startLevel', String(value));
  } catch (e) {
    // ignore write failures (e.g. private browsing)
  }
}

function getHighScores() {
  try {
    const stored = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    if (Array.isArray(stored)) return stored;
  } catch (e) {
    // localStorage unavailable or corrupt data - fall back to empty list
  }
  return [];
}

function saveHighScores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch (e) {
    // ignore write failures (e.g. private browsing)
  }
}

function getStoredSkin() {
  try {
    const stored = localStorage.getItem('tetris_skin');
    if (stored === 'retro' || stored === 'neon' || stored === 'pastel' || stored === 'pixel') return stored;
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return 'retro';
}

function applySkin() {
  skinSelect.value = currentSkin;
  try {
    localStorage.setItem('tetris_skin', currentSkin);
  } catch (e) {
    // ignore write failures (e.g. private browsing)
  }
}

function isTopScore(s) {
  if (s <= 0) return false;
  const scores = getHighScores();
  if (scores.length < MAX_HIGHSCORES) return true;
  return s > scores[scores.length - 1].score;
}

function insertHighScore(name, s) {
  const scores = getHighScores();
  const entry = { name, score: s };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, MAX_HIGHSCORES);
  saveHighScores(trimmed);
  return trimmed.indexOf(entry);
}

function getBestCombo() {
  try {
    const v = parseInt(localStorage.getItem(BEST_COMBO_KEY), 10);
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
}

function saveBestCombo(v) {
  try {
    localStorage.setItem(BEST_COMBO_KEY, String(v));
  } catch (e) {
    // ignore write failures
  }
}

function getMaxLines() {
  try {
    const v = parseInt(localStorage.getItem(MAX_LINES_KEY), 10);
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
}

function saveMaxLines(v) {
  try {
    localStorage.setItem(MAX_LINES_KEY, String(v));
  } catch (e) {
    // ignore write failures
  }
}

function resetRecords() {
  try {
    localStorage.removeItem(HIGHSCORES_KEY);
    localStorage.removeItem(BEST_COMBO_KEY);
    localStorage.removeItem(MAX_LINES_KEY);
  } catch (e) {
    // ignore removal failures
  }
  renderHighScoresList(startHsList, -1);
  renderStats(startBestComboEl, startMaxLinesEl);
}

function renderHighScoresList(listEl, highlightIndex) {
  const scores = getHighScores();
  listEl.innerHTML = '';
  if (!scores.length) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin registros aún';
    listEl.appendChild(li);
    return;
  }
  scores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'highscore-row' + (i === highlightIndex ? ' highlight' : '');
    const rank = document.createElement('span');
    rank.className = 'hs-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'hs-name';
    name.textContent = entry.name;
    const sc = document.createElement('span');
    sc.className = 'hs-score';
    sc.textContent = entry.score.toLocaleString();
    li.append(rank, name, sc);
    listEl.appendChild(li);
  });
}

function renderStats(comboEl, maxLinesEl) {
  comboEl.textContent = getBestCombo();
  maxLinesEl.textContent = getMaxLines();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const RING_CHANCE = 0.08; // ~1 de cada 12-13 piezas
  const type = Math.random() < RING_CHANCE ? 8 : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    comboCount++;
    if (comboCount > bestCombo) bestCombo = comboCount;
    updateHUD();
  } else {
    comboCount = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  switch (currentSkin) {
    case 'neon':
      drawBlockNeon(context, x, y, colorIndex, size, alpha);
      break;
    case 'pastel':
      drawBlockPastel(context, x, y, colorIndex, size, alpha);
      break;
    case 'pixel':
      drawBlockPixel(context, x, y, colorIndex, size, alpha);
      break;
    default:
      drawBlockRetro(context, x, y, colorIndex, size, alpha);
  }
}

function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  const color = NEON_COLORS[colorIndex];
  const px = x * size + 2;
  const py = y * size + 2;
  const s = size - 4;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = size * 0.6;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,0.7)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  context.restore();
}

function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  const color = PASTEL_COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  const radius = Math.min(6, s / 4);
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  drawRoundedRectPath(context, px, py, s, s, radius);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.4)';
  drawRoundedRectPath(context, px, py, s, Math.max(4, s * 0.35), radius);
  context.fill();
  context.restore();
}

function drawRoundedRectPath(context, x, y, w, h, radius) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, radius);
    return;
  }
  // manual rounded rect fallback for browsers without roundRect().
  // Clamp the radius so it never exceeds half of either dimension —
  // otherwise the curve/line segments below overlap and self-intersect
  // (this matters for short rects, e.g. the pastel highlight strip).
  radius = Math.max(0, Math.min(radius, w / 2, h / 2));
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  const color = PIXEL_COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  // pixelated dither pattern: checkered darker cells to fake a low-res texture
  const cell = Math.max(3, Math.floor(s / 4));
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let iy = 0; iy < s; iy += cell) {
    for (let ix = 0; ix < s; ix += cell) {
      if (((ix / cell) + (iy / cell)) % 2 === 0) {
        context.fillRect(px + ix, py + iy, cell, cell);
      }
    }
  }
  context.strokeStyle = 'rgba(0,0,0,0.45)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (currentSkin === 'neon') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (currentSkin === 'neon') {
    nextCtx.fillStyle = '#000000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (bestCombo > getBestCombo()) saveBestCombo(bestCombo);
  if (lines > getMaxLines()) saveMaxLines(lines);
  renderStats(overlayBestComboEl, overlayMaxLinesEl);

  if (isTopScore(score)) {
    overlayNameForm.classList.remove('hidden');
    overlayHighscores.classList.add('hidden');
    nameInput.value = '';
    nameInput.focus();
  } else {
    overlayNameForm.classList.add('hidden');
    overlayHighscores.classList.remove('hidden');
    renderHighScoresList(overlayHsList, -1);
  }
  overlay.classList.remove('hidden');
}

function submitHighScore() {
  const raw = (nameInput.value || '').trim().slice(0, 12);
  const name = raw || 'JUGADOR';
  const idx = insertHighScore(name, score);
  overlayNameForm.classList.add('hidden');
  overlayHighscores.classList.remove('hidden');
  renderHighScoresList(overlayHsList, idx);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    overlay.classList.remove('overlay-paused');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.add('overlay-paused');
    overlayNameForm.classList.add('hidden');
    overlayHighscores.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  theme = getStoredTheme();
  applyTheme();
  startLevel = getStoredStartLevel();
  if (startLevelInput) {
    startLevelInput.value = startLevel;
    startLevelValue.textContent = startLevel;
  }
  currentSkin = getStoredSkin();
  applySkin();
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  comboCount = 0;
  bestCombo = 0;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  gameStarted = true;
  next = randomPiece();
  spawn();
  updateHUD();
  startScreen.classList.add('hidden');
  overlay.classList.add('hidden');
  overlay.classList.remove('overlay-paused');
  if (pauseControlsPanel) pauseControlsPanel.classList.add('hidden');
  overlayNameForm.classList.add('hidden');
  overlayHighscores.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  gameStarted = false;
  theme = getStoredTheme();
  applyTheme();
  currentSkin = getStoredSkin();
  applySkin();
  startLevel = getStoredStartLevel();
  if (startLevelInput) {
    startLevelInput.value = startLevel;
    startLevelValue.textContent = startLevel;
  }
  renderHighScoresList(startHsList, -1);
  renderStats(startBestComboEl, startMaxLinesEl);
  overlay.classList.add('hidden');
  overlay.classList.remove('overlay-paused');
  startScreen.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  // If a top-5 score is waiting on the name form, save it before restarting
  // so the player can't lose it by clicking Reiniciar instead of Guardar.
  if (!overlayNameForm.classList.contains('hidden')) {
    submitHighScore();
  }
  init();
});

playBtn.addEventListener('click', init);

resetRecordsBtn.addEventListener('click', resetRecords);

saveNameBtn.addEventListener('click', submitHighScore);

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    submitHighScore();
  }
});

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

controlsToggleBtn.addEventListener('click', () => {
  pauseControlsPanel.classList.toggle('hidden');
});

startLevelInput.addEventListener('input', () => {
  const value = parseInt(startLevelInput.value, 10);
  startLevelValue.textContent = value;
  storeStartLevel(value);
});

themeToggle.addEventListener('change', () => {
  theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme();
  if (gameStarted) draw();
});

skinSelect.addEventListener('change', () => {
  currentSkin = skinSelect.value;
  applySkin();
  if (gameStarted) {
    draw();
    drawNext();
  }
});

showStartScreen();
