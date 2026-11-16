'use strict';

/* ================= Settings ================= */
const CHARS = '01{}[]()<>/\\|!@#$%^&*+-=~?:;.,ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const FONT_SIZE = 11;
const LINE_HEIGHT = 13;

const GRAY = [110, 110, 110];
const GREEN = [0, 255, 65];

const HOVER_RADIUS = 0.09;      // share of the screen's shorter side
const HOVER_FADE_IN = 0.8;      // 0-1, higher = faster
const HOVER_FADE_OUT = 0.3;

const FLICKER_PER_FRAME = 120;  // characters that change every frame
const WORD_CHANCE = 0.25;       // chance per frame that a green word appears
const WORD_MIN = 4;             // shortest word, in characters
const WORD_MAX = 10;            // longest word, in characters
const WORD_LIFE = 2;            // seconds a word stays lit
const WORD_RISE = 0.3;          // seconds it takes to fade in

const COLOR_STEPS = 64;         // smoothness of the gray-to-green blend
const MAX_DPR = 2;              // cap pixel density to keep phones fast

/* ================= Setup ================= */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// Every shade between gray and green, built once.
const palette = Array.from({ length: COLOR_STEPS + 1 }, (_, step) => {
  const t = step / COLOR_STEPS;
  const [r, g, b] = GRAY.map((v, i) => Math.round(v + (GREEN[i] - v) * t));
  return `rgb(${r},${g},${b})`;
});

let width = 0, height = 0;
let originX = 0, originY = 0;   // where the canvas sits on the screen
let cols = 0, rows = 0, cellW = 7;
let radius = 0, radiusSq = 0, falloff = 0;
let sizeKey = '';
let glyphs = [];                // the character in every cell
let hover = new Float32Array(0); // 0-1 green amount from the pointer
let flashAt = new Float64Array(0); // when a cell's green word started (0 = none)

const pointer = { x: -9999, y: -9999 };

/* ================= Helpers ================= */
const randomChar = () => CHARS[(Math.random() * CHARS.length) | 0];
const ease = (t) => t * t * (3 - 2 * t);

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const box = canvas.getBoundingClientRect();

  const key = `${box.width}x${box.height}x${dpr}`;
  if (key === sizeKey) return;
  sizeKey = key;

  width = box.width;
  height = box.height;
  originX = box.left;
  originY = box.top;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = `${FONT_SIZE}px "Courier New", monospace`;
  ctx.textBaseline = 'top';

  cellW = ctx.measureText('M').width;
  cols = Math.ceil(width / cellW);
  rows = Math.ceil(height / LINE_HEIGHT);

  glyphs = Array.from({ length: cols * rows }, randomChar);
  hover = new Float32Array(cols * rows);
  flashAt = new Float64Array(cols * rows);

  radius = Math.max(60, Math.min(window.innerWidth, window.innerHeight) * HOVER_RADIUS);
  radiusSq = radius * radius;
  falloff = 1 / (2 * (radius * 0.45) ** 2);
}

/* Change a few random characters and sometimes light up a short green word. */
function scramble(now) {
  for (let k = 0; k < FLICKER_PER_FRAME; k++) {
    glyphs[(Math.random() * glyphs.length) | 0] = randomChar();
  }

  if (Math.random() < WORD_CHANCE) {
    const length = Math.min(cols, WORD_MIN + ((Math.random() * (WORD_MAX - WORD_MIN + 1)) | 0));
    const row = (Math.random() * rows) | 0;
    const col = (Math.random() * (cols - length + 1)) | 0;
    for (let n = 0; n < length; n++) {
      const i = row * cols + col + n;
      glyphs[i] = randomChar();
      flashAt[i] = now;
    }
  }
}

/* Green amount (0-1) of a cell that is part of a word: fade in, then fade out. */
function wordLevel(i, now) {
  const start = flashAt[i];
  if (!start) return 0;

  const age = now - start;
  if (age >= WORD_LIFE) {
    flashAt[i] = 0;
    return 0;
  }
  return age < WORD_RISE
    ? ease(age / WORD_RISE)
    : 1 - ease((age - WORD_RISE) / (WORD_LIFE - WORD_RISE));
}

/* ================= Drawing ================= */
function draw(ms) {
  const now = ms / 1000;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  scramble(now);

  let lastStep = -1; // only change the color when it really changes

  for (let r = 0; r < rows; r++) {
    const y = r * LINE_HEIGHT;
    const dy = y + LINE_HEIGHT / 2 - pointer.y;

    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = c * cellW;
      const dx = x + cellW / 2 - pointer.x;
      const distSq = dx * dx + dy * dy;

      // Smooth glow around the pointer
      const target = distSq < radiusSq ? Math.exp(-distSq * falloff) : 0;
      let h = hover[i];
      h += (target - h) * (target > h ? HOVER_FADE_IN : HOVER_FADE_OUT);
      hover[i] = h < 0.002 ? 0 : h;

      const level = Math.max(hover[i], wordLevel(i, now));
      const step = Math.round(level * COLOR_STEPS);
      if (step !== lastStep) {
        ctx.fillStyle = palette[step];
        lastStep = step;
      }
      ctx.fillText(glyphs[i], x, y);
    }
  }

  requestAnimationFrame(draw);
}

/* ================= Input ================= */
function setPointer(e) {
  pointer.x = e.clientX - originX;
  pointer.y = e.clientY - originY;
}

function clearPointer() {
  pointer.x = pointer.y = -9999;
}

window.addEventListener('pointermove', setPointer);
window.addEventListener('pointerdown', setPointer);
window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') clearPointer(); });
window.addEventListener('pointercancel', clearPointer);
document.documentElement.addEventListener('pointerleave', clearPointer);

/* ================= Start ================= */
resize();
new ResizeObserver(resize).observe(canvas); // also covers rotating the phone
requestAnimationFrame(draw);
