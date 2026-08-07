'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Trazo de rectángulo redondeado (sin depender de ctx.roundRect)
function roundRectPath(context, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + rad, y);
  context.arcTo(x + w, y, x + w, y + h, rad);
  context.arcTo(x + w, y + h, x, y + h, rad);
  context.arcTo(x, y + h, x, y, rad);
  context.arcTo(x, y, x + w, y, rad);
  context.closePath();
}

// Patrón 6x6 dibujado sobre cada bloque en la skin "pixel art".
// 0 = color base, 1 = bisel claro, 2 = bisel oscuro, 3 = mota clara
const PIXEL_PATTERN = [
  [1, 1, 1, 1, 1, 2],
  [1, 0, 0, 0, 0, 2],
  [1, 0, 3, 0, 0, 2],
  [1, 0, 0, 0, 3, 2],
  [1, 0, 0, 0, 0, 2],
  [2, 2, 2, 2, 2, 2],
];
const PIXEL_TINTS = [
  null,
  'rgba(255,255,255,0.32)',
  'rgba(0,0,0,0.38)',
  'rgba(255,255,255,0.16)',
];

// Cada skin define su paleta (índices 1-8, igual que PIECES) y cómo se pinta
// un bloque. `block()` recibe la esquina superior izquierda ya en píxeles.
const SKINS = {
  retro: {
    label: 'Retro',
    ghostAlpha: 0.2,
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#ffca28'],
    block(context, px, py, size, color, alpha) {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, Math.round(size * 0.13));
      context.restore();
    },
  },

  neon: {
    label: 'Neon',
    ghostAlpha: 0.28,
    colors: [null, '#00f0ff', '#fff200', '#c400ff', '#00ff6a', '#ff0055', '#0d6bff', '#ff8a00', '#ff00d4'],
    block(context, px, py, size, color, alpha) {
      const pad = size * 0.1;
      const w = size - pad * 2;
      context.save();
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.strokeStyle = color;
      context.lineWidth = Math.max(1.5, size * 0.07);
      // dos pasadas: halo amplio + trazo nítido
      context.shadowBlur = size * 0.6;
      context.strokeRect(px + pad, py + pad, w, w);
      context.shadowBlur = size * 0.22;
      context.strokeRect(px + pad, py + pad, w, w);
      context.shadowBlur = 0;
      context.globalAlpha = alpha * 0.22;
      context.fillStyle = color;
      context.fillRect(px + pad, py + pad, w, w);
      context.restore();
    },
  },

  pastel: {
    label: 'Pastel',
    ghostAlpha: 0.45,
    colors: [null, '#9adcea', '#f9e79f', '#cdb4f0', '#a8e6a3', '#f5a9a9', '#a9c6f5', '#f7c894', '#e8b7d4'],
    block(context, px, py, size, color, alpha) {
      const pad = size * 0.08;
      const w = size - pad * 2;
      context.save();
      context.globalAlpha = alpha;
      roundRectPath(context, px + pad, py + pad, w, w, size * 0.3);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.10)';
      context.lineWidth = 1;
      context.stroke();
      // brillo suave en la mitad superior
      context.globalAlpha = alpha * 0.5;
      roundRectPath(context, px + pad * 2.5, py + pad * 2.5, w - pad * 5, w * 0.32, size * 0.16);
      context.fillStyle = '#ffffff';
      context.fill();
      context.restore();
    },
  },

  pixel: {
    label: 'Pixel art',
    ghostAlpha: 0.3,
    colors: [null, '#3cbcfc', '#fcd800', '#b048b8', '#58d854', '#e84058', '#4868fc', '#f87858', '#c0c0d0'],
    block(context, px, py, size, color, alpha) {
      const u = size / PIXEL_PATTERN.length;
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      for (let r = 0; r < PIXEL_PATTERN.length; r++) {
        for (let c = 0; c < PIXEL_PATTERN[r].length; c++) {
          const tint = PIXEL_TINTS[PIXEL_PATTERN[r][c]];
          if (!tint) continue;
          context.fillStyle = tint;
          context.fillRect(px + c * u, py + r * u, u, u);
        }
      }
      context.restore();
    },
  },
};

const DEFAULT_SKIN = 'retro';

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

const MIN_LEVEL = 1;
const MAX_LEVEL = 15;

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
const gameOverBox = document.getElementById('gameover-box');
const pauseMenu = document.getElementById('pause-menu');
const menuMain = document.getElementById('menu-main');
const menuControls = document.getElementById('menu-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const startLevelValue = document.getElementById('start-level-value');
const startLevelDown = document.getElementById('start-level-down');
const startLevelUp = document.getElementById('start-level-up');
const startLevelValue2 = document.getElementById('start-level-value-2');
const skinSelect = document.getElementById('skin-select');
const startScreen = document.getElementById('start-screen');
const startRecords = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const resetStartBtn = document.getElementById('reset-start');
const resetOverlayBtn = document.getElementById('reset-overlay');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo, started;
let theme, skin, gridColor, startLevel;
let pendingRecord = null;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    // localStorage unavailable (e.g. private browsing)
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // ignore write failures (e.g. private browsing)
  }
}

function getStoredTheme() {
  const stored = storageGet('theme');
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

function getStoredSkin() {
  const stored = storageGet('skin');
  return stored && SKINS[stored] ? stored : DEFAULT_SKIN;
}

// El color de la rejilla vive en CSS y depende de tema + skin, así que se
// vuelve a leer cada vez que cambia cualquiera de los dos.
function readGridColor() {
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
}

function applyTheme() {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  readGridColor();
  storageSet('theme', theme);
}

function applySkin() {
  for (const name of Object.keys(SKINS)) {
    document.body.classList.toggle(`skin-${name}`, name === skin);
  }
  skinSelect.value = skin;
  readGridColor();
  storageSet('skin', skin);
}

function buildSkinOptions() {
  for (const [name, def] of Object.entries(SKINS)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = def.label;
    skinSelect.appendChild(option);
  }
}

// Repinta ambos canvas sin esperar al siguiente frame del loop
// (necesario con el juego en pausa o terminado).
function redrawAll() {
  if (!current) return;
  draw();
  drawNext();
}

function getStoredStartLevel() {
  const stored = parseInt(storageGet('startLevel'), 10);
  if (stored >= MIN_LEVEL && stored <= MAX_LEVEL) return stored;
  return MIN_LEVEL;
}

// El nivel inicial se puede ajustar desde dos sitios (pantalla de inicio y
// menú de pausa); ambos steppers muestran siempre el mismo valor.
const LEVEL_STEPPERS = [
  { value: startLevelValue, down: levelDownBtn, up: levelUpBtn },
  { value: startLevelValue2, down: startLevelDown, up: startLevelUp },
];

function setStartLevel(value) {
  startLevel = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, value));
  for (const stepper of LEVEL_STEPPERS) {
    stepper.value.textContent = startLevel;
    stepper.down.disabled = startLevel === MIN_LEVEL;
    stepper.up.disabled = startLevel === MAX_LEVEL;
  }
  storageSet('startLevel', startLevel);
  // en la pantalla de inicio el HUD refleja el nivel con el que se empezará.
  // Solo se toca `levelEl`: en el arranque el resto del estado (score, lines,
  // combo) todavía no existe y `updateHUD()` fallaría.
  if (!started) {
    level = startLevel;
    levelEl.textContent = level;
  }
}

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

/* ---------- Records en localStorage ---------- */

function readStore(key, fallback) {
  const raw = storageGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback; // JSON corrupto
  }
}

function writeStore(key, value) {
  storageSet(key, JSON.stringify(value));
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
    level = startLevel + Math.floor(lines / 10);
    dropInterval = speedFor(level);
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
  const def = SKINS[skin];
  def.block(context, x * size, y * size, size, def.colors[colorIndex], alpha ?? 1);
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
  const ghostAlpha = SKINS[skin].ghostAlpha;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

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
  refreshRecordViews();

  pauseMenu.classList.add('hidden');
  gameOverBox.classList.remove('hidden');
  overlay.classList.remove('hidden');

  if (qualifies) {
    nameInput.value = String(readStore(LAST_NAME_KEY, '') || '');
    nameInput.focus();
    nameInput.select();
  }
}

function showMenuView(view) {
  menuMain.classList.toggle('hidden', view !== 'main');
  menuControls.classList.toggle('hidden', view !== 'controls');
  (view === 'main' ? resumeBtn : controlsBackBtn).focus();
}

function pause() {
  if (!started || paused || gameOver) return;
  paused = true;
  cancelAnimationFrame(animId);
  gameOverBox.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  overlay.classList.remove('hidden');
  showMenuView('main');
}

function resume() {
  if (!paused || gameOver) return;
  paused = false;
  overlay.classList.add('hidden');
  // el botón enfocado se quedaría activo y reaccionaría a Space/Enter en el juego
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  lastTime = performance.now();
  dropAccum = 0;
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (paused) resume();
  else pause();
}

function moveMenuFocus(dir) {
  const view = menuMain.classList.contains('hidden') ? menuControls : menuMain;
  const items = [...view.querySelectorAll('.menu-btn')];
  if (!items.length) return;
  const idx = items.indexOf(document.activeElement);
  if (idx === -1) {
    items[dir > 0 ? 0 : items.length - 1].focus();
  } else {
    items[(idx + dir + items.length) % items.length].focus();
  }
}

function handleMenuKey(e) {
  const onMain = !menuMain.classList.contains('hidden');
  switch (e.code) {
    case 'KeyP':
    case 'Escape':
      e.preventDefault();
      if (onMain) resume();
      else showMenuView('main');
      break;
    case 'ArrowUp':
    case 'ArrowDown':
      e.preventDefault();
      moveMenuFocus(e.code === 'ArrowDown' ? 1 : -1);
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (!onMain) break;
      e.preventDefault();
      setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
      break;
  }
}

// Teclas en la pantalla de inicio: jugar y ajustar el nivel inicial.
function handleStartKey(e) {
  switch (e.code) {
    case 'Enter':
    case 'Space':
      e.preventDefault();
      init();
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
      break;
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
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = true;
  pendingRecord = null;
  dropInterval = speedFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  nameForm.classList.add('hidden');
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  gameOverBox.classList.add('hidden');
  startScreen.classList.add('hidden');
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = false;
  pendingRecord = null;
  updateHUD();
  draw();
  drawNext();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  gameOverBox.classList.add('hidden');
  startScreen.classList.remove('hidden');
  refreshRecordViews();
}

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return; // escribiendo el nombre
  if (gameOver) return;
  // el menú de pausa enfoca sus propios botones a propósito, así que se
  // atiende antes del guard de foco de abajo
  if (paused) { handleMenuKey(e); return; }
  if (!started) { handleStartKey(e); return; }
  // con el foco en un control del panel (selector de skin, toggle de tema,
  // botón), las teclas pertenecen al control, no al juego
  const tag = e.target.tagName;
  if (tag === 'SELECT' || tag === 'BUTTON') return;
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); pause(); return; }
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

// Reiniciar desde el game over: si la partida entró al top y no se guardó,
// se conserva igualmente con el nombre que hubiera en el campo.
function restartFromGameOver() {
  if (pendingRecord) savePendingRecord(nameInput.value);
  init();
}

restartBtn.addEventListener('click', restartFromGameOver);
menuRestartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resume);
controlsBtn.addEventListener('click', () => showMenuView('controls'));
controlsBackBtn.addEventListener('click', () => showMenuView('main'));
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));
startLevelDown.addEventListener('click', () => setStartLevel(startLevel - 1));
startLevelUp.addEventListener('click', () => setStartLevel(startLevel + 1));

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
  redrawAll();
});

skinSelect.addEventListener('change', () => {
  if (!SKINS[skinSelect.value]) return;
  skin = skinSelect.value;
  applySkin();
  redrawAll();
});

// Arranque: tema, skin y nivel inicial se aplican una sola vez, no en cada
// init(), para que la pantalla de inicio ya se pinte con la skin correcta.
buildSkinOptions();
theme = getStoredTheme();
skin = getStoredSkin();
applyTheme();
applySkin();
setStartLevel(getStoredStartLevel());
showStartScreen();
