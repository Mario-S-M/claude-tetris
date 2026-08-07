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

const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';
const LAST_NAME_KEY = 'tetris-last-name';
const MAX_RECORDS = 5;
const MAX_NAME = 12;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayRecords = document.getElementById('overlay-records');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const startScreen = document.getElementById('start-screen');
const startRecords = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const resetStartBtn = document.getElementById('reset-start');
const resetOverlayBtn = document.getElementById('reset-overlay');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo, started;
let theme, gridColor;
let pendingRecord = null;

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

/* ---------- Records en localStorage ---------- */

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback; // localStorage no disponible o JSON corrupto
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignorar fallos de escritura (p. ej. navegación privada)
  }
}

function sanitizeName(name) {
  const clean = String(name ?? '').trim().slice(0, MAX_NAME);
  return clean || 'ANÓNIMO';
}

function loadRecords() {
  const raw = readStore(RECORDS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && Number.isFinite(Number(r.score)))
    .map(r => ({
      name: sanitizeName(r.name),
      score: Number(r.score),
      lines: Number(r.lines) || 0,
      level: Number(r.level) || 1,
      combo: Number(r.combo) || 0,
      date: typeof r.date === 'string' ? r.date : '',
    }))
    .sort(byScore)
    .slice(0, MAX_RECORDS);
}

function byScore(a, b) {
  return b.score - a.score || b.lines - a.lines;
}

function loadStats() {
  const raw = readStore(STATS_KEY, {});
  return {
    bestCombo: Number(raw && raw.bestCombo) || 0,
    maxLines: Number(raw && raw.maxLines) || 0,
  };
}

function updateStats() {
  const stats = loadStats();
  const merged = {
    bestCombo: Math.max(stats.bestCombo, maxCombo),
    maxLines: Math.max(stats.maxLines, lines),
  };
  writeStore(STATS_KEY, merged);
}

function qualifiesForTop(value) {
  if (value <= 0) return false;
  const records = loadRecords();
  return records.length < MAX_RECORDS || value > records[records.length - 1].score;
}

// Guarda la partida pendiente y devuelve su posición en el top (-1 si no entró).
function savePendingRecord(name) {
  if (!pendingRecord) return -1;
  const entry = { ...pendingRecord, name: sanitizeName(name) };
  const records = loadRecords();
  records.push(entry);
  records.sort(byScore);
  const top = records.slice(0, MAX_RECORDS);
  writeStore(RECORDS_KEY, top);
  writeStore(LAST_NAME_KEY, entry.name);
  pendingRecord = null;
  return top.indexOf(entry);
}

function resetRecords() {
  writeStore(RECORDS_KEY, []);
  writeStore(STATS_KEY, { bestCombo: 0, maxLines: 0 });
  pendingRecord = null;
}

function renderRecords(container, highlightIndex = -1) {
  const records = loadRecords();
  const stats = loadStats();
  container.textContent = '';

  const title = document.createElement('p');
  title.className = 'records-title';
  title.textContent = `TOP ${MAX_RECORDS}`;
  container.appendChild(title);

  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Todavía no hay records';
    container.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'records-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['#', 'NOMBRE', 'SCORE', 'LÍN.', 'COMBO']) {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    records.forEach((rec, i) => {
      const tr = document.createElement('tr');
      if (i === highlightIndex) tr.className = 'highlight';
      if (rec.date) tr.title = rec.date;
      const cells = [
        String(i + 1),
        rec.name,
        rec.score.toLocaleString(),
        String(rec.lines),
        `x${rec.combo}`,
      ];
      for (const value of cells) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  const statsEl = document.createElement('p');
  statsEl.className = 'records-stats';
  statsEl.append(
    'Mejor combo: ',
    Object.assign(document.createElement('b'), { textContent: `x${stats.bestCombo}` }),
    ' · Líneas máximas: ',
    Object.assign(document.createElement('b'), { textContent: String(stats.maxLines) }),
  );
  container.appendChild(statsEl);
}

function refreshRecordViews(highlightIndex = -1) {
  renderRecords(startRecords);
  renderRecords(overlayRecords, highlightIndex);
}

// Doble clic de confirmación en lugar de un confirm() modal.
function setupResetButton(btn) {
  let timer = null;
  const restore = () => {
    clearTimeout(timer);
    timer = null;
    btn.classList.remove('confirming');
    btn.textContent = 'Resetear records';
  };
  btn.addEventListener('click', () => {
    if (!timer) {
      btn.classList.add('confirming');
      btn.textContent = '¿Seguro? Pulsa otra vez';
      timer = setTimeout(restore, 3000);
      return;
    }
    restore();
    resetRecords();
    nameForm.classList.add('hidden');
    refreshRecordViews();
  });
}

/* ---------- Juego ---------- */

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
    updateHUD();
  }
  return cleared;
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
  const cleared = clearLines();
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  updateHUD();
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
  comboEl.textContent = combo > 0 ? `x${combo}` : '—';
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

  if (!current) return; // pantalla de inicio: tablero vacío

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
  if (!next) return;
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
  updateStats();

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent =
    `${score.toLocaleString()} pts · ${lines} líneas · combo máx. x${maxCombo}`;

  const qualifies = qualifiesForTop(score);
  pendingRecord = qualifies
    ? { score, lines, level, combo: maxCombo, date: new Date().toISOString().slice(0, 10) }
    : null;

  nameForm.classList.toggle('hidden', !qualifies);
  overlayRecords.classList.remove('hidden');
  resetOverlayBtn.classList.remove('hidden');
  refreshRecordViews();
  overlay.classList.remove('hidden');

  if (qualifies) {
    nameInput.value = String(readStore(LAST_NAME_KEY, '') || '');
    nameInput.focus();
    nameInput.select();
  }
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    nameForm.classList.add('hidden');
    overlayRecords.classList.add('hidden');
    resetOverlayBtn.classList.add('hidden');
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = true;
  pendingRecord = null;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  nameForm.classList.add('hidden');
  overlay.classList.add('hidden');
  startScreen.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// Estado inicial: tablero vacío y pantalla de inicio con la tabla de records.
function showStartScreen() {
  cancelAnimationFrame(animId);
  board = createBoard();
  current = null;
  next = null;
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = false;
  updateHUD();
  draw();
  drawNext();
  overlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
  refreshRecordViews();
}

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return; // escribiendo el nombre
  if (!started) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      init();
    }
    return;
  }
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

playBtn.addEventListener('click', init);

restartBtn.addEventListener('click', () => {
  // Si la partida entró al top y no se guardó, se conserva igualmente.
  if (pendingRecord) savePendingRecord(nameInput.value);
  init();
});

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const index = savePendingRecord(nameInput.value);
  nameForm.classList.add('hidden');
  refreshRecordViews(index);
});

setupResetButton(resetStartBtn);
setupResetButton(resetOverlayBtn);

themeToggle.addEventListener('change', () => {
  theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme();
  draw();
});

theme = getStoredTheme();
applyTheme();
showStartScreen();
