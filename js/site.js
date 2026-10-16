'use strict';

/* ------------------------------------------------------------------ *
 *  Maliyet formülleri
 *  Her tablo [eşik seviye, çarpan] çiftlerinden oluşur ve artan sırada
 *  olmalıdır; çarpanlar seviye eşiğe ulaştıkça sırayla uygulanır.
 * ------------------------------------------------------------------ */

const STAR_COUNT = 10;
const STORAGE_KEY = 'starcalc:v2';

const GS_STEPS = [
  [20, 1.3], [30, 1.3], [60, 1.3], [80, 1.3], [90, 1.3], [100, 1.3],
  [150, 1.1], [160, 1.1], [170, 1.1], [180, 1.1], [190, 1.1], [200, 1.1],
  [210, 1.1], [220, 1.1], [230, 1.1], [250, 1.1], [300, 1.1], [350, 1.1],
  [400, 1.1], [450, 1.1], [500, 1.1], [550, 1.1],
];

const MAGNET_STEPS = [
  [12, 0.98], [13, 0.98], [14, 0.98], [15, 0.98], [16, 0.98], [17, 0.98],
  [18, 0.98], [19, 0.98], [20, 0.98], [21, 0.98], [22, 0.98], [23, 0.98],
  [70, 1.04], [75, 1.04], [80, 1.06], [85, 1.06], [90, 1.06], [94, 1.06],
  [96, 1.06], [98, 1.05], [100, 1.05], [105, 1.05], [110, 1.05], [115, 1.03],
  [120, 1.05], [125, 1.05], [130, 1.05], [135, 1.05], [140, 1.05], [145, 1.05],
  [150, 1.05], [160, 1.05], [180, 1.05], [190, 1.05], [200, 1.05], [210, 1.05],
  [220, 1.05], [230, 1.035], [250, 1.1], [270, 1.14], [290, 1.15], [300, 1.04],
  [310, 1.1], [330, 1.1], [350, 1.05], [370, 1.1], [390, 1.018], [410, 1.1],
  [430, 1.1], [450, 1.06], [470, 1.1], [490, 1.05], [510, 1.09], [530, 1.09],
  [550, 1.09], [570, 1.09], [590, 1.07], [610, 1.1], [630, 1.1], [650, 1.1],
  [670, 1.07], [690, 1.05], [710, 1.1], [810, 1.1], [910, 1.1], [1010, 1.1],
  [1020, 1.1], [1090, 1.1], [1110, 1.3], [1120, 1.1], [1130, 1.1], [1210, 1.3],
  [1260, 1.18], [1285, 1.18], [1310, 1.32], [1360, 1.32], [1410, 1.32],
  [1460, 1.32], [1510, 1.3], [1560, 1.269], [1610, 1.1], [1660, 1.1],
  [1710, 1.3], [1760, 1.269], [1810, 1.1],
];

const FRAGMENT_STEPS = [
  [60, 1.05], [70, 1.05], [75, 1.05], [80, 1.05], [85, 1.05], [90, 1.05],
  [94, 1.05], [96, 1.05], [98, 1.05], [100, 1.1], [110, 1.05], [115, 1.05],
  [120, 1.05], [125, 1.05], [130, 1.05], [140, 1.05], [150, 1.05], [160, 1.05],
  [170, 1.05], [180, 1.05], [190, 1.05], [200, 1.05], [210, 1.3], [260, 1.3],
  [310, 1.4], [410, 1.4], [510, 1.4], [610, 1.2], [710, 1.1], [810, 1.1],
  [910, 1.1], [1010, 1.1],
];

function applySteps(cost, level, steps) {
  for (const [min, factor] of steps) {
    if (level < min) break;
    cost *= factor;
  }
  return cost;
}

const applyScrapyard = (cost, mul) => Math.floor((cost * 100) / (mul + 100));

function gsCost(level, mul) {
  return applyScrapyard(applySteps(100000 * (level - 10) + 250000, level, GS_STEPS), mul);
}

function magnetCost(level, mul) {
  let cost = applySteps(250 * (level - 10) + 1000, level, MAGNET_STEPS);
  // 1860'tan sonra her 50 seviyede bir ek x1.1
  if (level >= 1860) cost *= Math.pow(1.1, Math.floor((level - 1810) / 50));
  return applyScrapyard(cost, mul);
}

function fragmentCost(level, mul) {
  return applyScrapyard(applySteps(4 + (level - 10), level, FRAGMENT_STEPS), mul);
}

function scrapyardModifier(level) {
  let modifier = level;
  if (level > 200) modifier = (level - 200) * 4 + 300;
  else if (level > 100) modifier = (level - 100) * 2 + 100;
  return modifier - 1;
}

/**
 * Tüm yıldızlar için hedefe kadar toplam maliyeti hesaplar.
 * Seviye başına maliyet bir kez hesaplanır ve yıldızlar arasında paylaşılır.
 */
function calculateTotals({ stars, target, achievementPct, masteryMul, scrapyardLevel }) {
  const totals = { gs: 0, magnet: 0, fragment: 0, levels: 0 };
  const starts = stars.filter((s) => s !== null && s < target);
  if (!starts.length) return totals;

  const from = Math.min(...starts);
  const mul = scrapyardModifier(scrapyardLevel);
  const span = target - from;
  const gs = new Float64Array(span);
  const mag = new Float64Array(span);
  const frag = new Float64Array(span);
  for (let i = 0; i < span; i++) {
    const level = from + i;
    gs[i] = gsCost(level, mul);
    mag[i] = magnetCost(level, mul);
    frag[i] = fragmentCost(level, mul);
  }

  for (const start of starts) {
    for (let i = start - from; i < span; i++) {
      totals.gs += gs[i];
      totals.magnet += mag[i];
      totals.fragment += frag[i];
    }
    totals.levels += target - start;
  }

  const factor = (1 - achievementPct / 100) * masteryMul;
  totals.gs *= factor;
  totals.magnet *= factor;
  totals.fragment *= factor;
  return totals;
}

/* ------------------------------------------------------------------ *
 *  Biçimlendirme
 * ------------------------------------------------------------------ */

const LOCALE = 'tr-TR';
const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const shortFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const SUFFIXES = 'abcdefghijklmnopqrstuvwxyz';

// Oyunun harf notasyonu: 1e6 = a, 1e9 = b, 1e12 = c ...
function formatGame(value) {
  if (value < 1e6) return intFmt.format(value);
  const group = Math.floor(Math.log10(value) / 3) - 2;
  if (group >= SUFFIXES.length) return value.toExponential(2);
  return `${shortFmt.format(value / 10 ** ((group + 2) * 3))} ${SUFFIXES[group]}`;
}

/* ------------------------------------------------------------------ *
 *  Arayüz
 * ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const settingIds = ['arch', 'master17', 'v2', 'target'];

function buildStarGrid() {
  const grid = $('starGrid');
  const tpl = $('starTemplate');
  for (let i = 1; i <= STAR_COUNT; i++) {
    const node = tpl.content.cloneNode(true);
    const input = node.querySelector('input');
    input.id = `inpStar${i}`;
    input.setAttribute('aria-label', `${i}. yıldız seviyesi`);
    node.querySelector('.star-index').textContent = i;
    grid.append(node);
  }
}

const starInputs = () => Array.from({ length: STAR_COUNT }, (_, i) => $(`inpStar${i + 1}`));

function readNumber(el, fallback = null) {
  const raw = el.value.trim();
  if (raw === '') return fallback;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function readState() {
  return {
    stars: starInputs().map((el) => {
      const n = readNumber(el);
      return n === null ? null : Math.floor(n);
    }),
    target: Math.floor(readNumber($('target'), 0)),
    achievementPct: clamp(readNumber($('arch'), 0), 0, 20),
    masteryMul: clamp(readNumber($('master17'), 1), 0, 1),
    scrapyardLevel: Math.max(0, readNumber($('v2'), 0)),
  };
}

function setResult(id, value) {
  const el = $(id);
  el.textContent = formatGame(value);
  el.title = intFmt.format(value);
}

function render() {
  const state = readState();
  const totals = calculateTotals(state);

  setResult('gs', totals.gs);
  setResult('mag', totals.magnet);
  setResult('fragment', totals.fragment);

  const summary = $('summary');
  const filled = state.stars.filter((s) => s !== null);
  if (!state.target) {
    summary.textContent = 'Hesaplamak için hedef yıldız seviyesini girin.';
  } else if (!filled.length) {
    summary.textContent = 'Mevcut yıldız seviyelerini girin.';
  } else if (!totals.levels) {
    summary.textContent = 'Tüm yıldızlar zaten hedef seviyede veya üstünde.';
  } else {
    summary.textContent = '';
  }

  starInputs().forEach((el, i) => {
    const s = state.stars[i];
    el.closest('.star').classList.toggle('is-done', s !== null && state.target > 0 && s >= state.target);
  });

  save();
}

/* --- Kalıcılık (yalnızca bu tarayıcıda) --- */

function save() {
  try {
    const data = {};
    [...starInputs(), ...settingIds.map($)].forEach((el) => (data[el.id] = el.value));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* depolama kullanılamıyor */ }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const [id, value] of Object.entries(data)) {
      const el = $(id);
      if (el && typeof value === 'string') el.value = value;
    }
  } catch { /* yok say */ }
}

function init() {
  buildStarGrid();
  load();

  // Yıldız alanlarına yalnızca rakam girilebilir (yapıştırma dahil).
  $('starGrid').addEventListener('input', (e) => {
    if (e.target.matches('input')) {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
      render();
    }
  });

  $('setAll').addEventListener('input', (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    e.target.value = value;
    starInputs().forEach((el) => (el.value = value));
    render();
  });

  settingIds.forEach((id) => $(id).addEventListener('input', render));

  $('reset').addEventListener('click', () => {
    [...starInputs(), ...settingIds.map($), $('setAll')].forEach((el) => (el.value = ''));
    render();
    starInputs()[0].focus();
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
