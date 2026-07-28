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
let theme, gridColor;
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  comboCount = 0;
  bestCombo = 0;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  gameStarted = true;
  next = randomPiece();
  spawn();
  updateHUD();
  startScreen.classList.add('hidden');
  overlay.classList.add('hidden');
  overlayNameForm.classList.add('hidden');
  overlayHighscores.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  gameStarted = false;
  theme = getStoredTheme();
  applyTheme();
  renderHighScoresList(startHsList, -1);
  renderStats(startBestComboEl, startMaxLinesEl);
  overlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP') { togglePause(); return; }
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

themeToggle.addEventListener('change', () => {
  theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme();
  if (gameStarted) draw();
});

showStartScreen();
