'use strict';

// ── State ──
let gameMode       = null;   // 'prefecture' | 'country'
let missLimit      = 1;
let questions      = [];
let currentIdx     = 0;
let correctCount   = 0;
let missCount      = 0;
let topoCache      = {};
let isTransitioning = false;

// ── Screen ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Mode Select ──
function selectMode(mode) {
  gameMode = mode;
  document.getElementById('settingsModeLabel').textContent =
    mode === 'prefecture' ? '都道府県モード（47問）' : '国モード（約70問）';
  showScreen('screenSettings');
}

// ── Miss Limit ──
function selectMissLimit(n) {
  missLimit = n;
  document.querySelectorAll('.miss-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.n) === n);
  });
}

// ── Game Start ──
async function startGame() {
  showScreen('screenGame');
  const loading = document.getElementById('loadingMsg');
  const content = document.getElementById('gameContent');
  loading.style.display = 'flex';
  content.style.display = 'none';

  try {
    const topo     = await loadTopo(gameMode);
    const objName  = gameMode === 'prefecture' ? 'japan' : 'countries';
    const dataList = gameMode === 'prefecture' ? PREFECTURES : COUNTRIES;
    const features = topojson.feature(topo, topo.objects[objName]).features;

    questions = dataList
      .map(item => {
        const feature = features.find(f => Number(f.id) === item.id);
        return feature ? { ...item, feature } : null;
      })
      .filter(Boolean)
      .sort(() => Math.random() - 0.5);

    if (questions.length === 0) throw new Error('no questions');

    currentIdx   = 0;
    correctCount = 0;
    missCount    = 0;

    loading.style.display = 'none';
    content.style.display = 'flex';
    showQuestion(0);
  } catch (e) {
    loading.innerHTML =
      '<span style="color:var(--ng);font-size:14px;text-align:center;padding:16px">データ読み込み失敗。<br>通信状況を確認してください。</span>';
  }
}

async function loadTopo(mode) {
  if (topoCache[mode]) return topoCache[mode];
  const url = mode === 'prefecture'
    ? 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.topojson'
    : 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('fetch failed');
  const data = await resp.json();
  topoCache[mode] = data;
  return data;
}

// ── Question ──
function showQuestion(idx) {
  isTransitioning = false;
  updateHUD();
  renderSilhouette(questions[idx].feature);
  clearInput();
  hideFeedback();
  // フォーカスは少し遅延（アニメーション後）
  setTimeout(() => document.getElementById('answerInput').focus(), 100);
}

function updateHUD() {
  document.getElementById('hudProgress').textContent = `${currentIdx + 1} / ${questions.length}`;
  document.getElementById('hudCorrect').textContent  = correctCount;
  const missEl = document.getElementById('hudMiss');
  missEl.textContent = `${missCount} / ${missLimit}`;
  missEl.style.color = missCount > 0 ? 'var(--ng)' : '';
}

// ── Silhouette ──
function renderSilhouette(feature) {
  requestAnimationFrame(() => {
    const container = document.getElementById('silhouetteContainer');
    const w = container.clientWidth  || 300;
    const h = container.clientHeight || 260;
    container.innerHTML = '';

    const pad = Math.min(w, h) * 0.07;
    const svg = d3.select(container).append('svg')
      .attr('width', w).attr('height', h);

    const proj = d3.geoMercator()
      .fitExtent([[pad, pad], [w - pad, h - pad]], feature);
    const path = d3.geoPath().projection(proj);

    svg.append('path')
      .datum(feature)
      .attr('d', path)
      .attr('fill', 'var(--ink)')
      .attr('opacity', 0)
      .transition().duration(280)
      .attr('opacity', 1);
  });
}

// ── Input ──
function clearInput() {
  const el = document.getElementById('answerInput');
  el.value = '';
  el.style.borderColor = '';
}

function hideFeedback() {
  document.getElementById('feedback').style.display = 'none';
}

function normalizeInput(str) {
  return str
    .trim()
    // 全角英数→半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .toLowerCase()
    .replace(/\s+/g, '');
}

// ── Submit ──
function submitAnswer() {
  if (isTransitioning) return;
  const raw = document.getElementById('answerInput').value;
  if (!raw.trim()) return;

  const norm    = normalizeInput(raw);
  const q       = questions[currentIdx];
  const correct = q.answers.some(a => normalizeInput(a) === norm);

  if (correct) onCorrect();
  else         onWrong(q);
}

function onCorrect() {
  correctCount++;
  isTransitioning = true;
  document.getElementById('answerInput').style.borderColor = 'var(--ok)';
  updateHUD();
  setTimeout(advance, 550);
}

function onWrong(q) {
  missCount++;
  isTransitioning = true;
  document.getElementById('answerInput').style.borderColor = 'var(--ng)';

  const fb = document.getElementById('feedback');
  fb.textContent = `正解：${q.name}`;
  fb.style.display = 'block';

  updateHUD();

  const delay = missCount >= missLimit ? 1800 : 1800;
  setTimeout(() => {
    if (missCount >= missLimit) endGame(false);
    else advance();
  }, delay);
}

function advance() {
  if (currentIdx + 1 >= questions.length) {
    endGame(true);
  } else {
    currentIdx++;
    showQuestion(currentIdx);
  }
}

// ── End ──
function endGame(isWin) {
  showScreen('screenResult');
  const key  = `mapquiz_best_${gameMode}`;
  const prev = parseInt(localStorage.getItem(key) || '0', 10);
  const best = Math.max(prev, correctCount);
  localStorage.setItem(key, String(best));

  const total    = questions.length;
  const modeName = gameMode === 'prefecture' ? '都道府県' : '国';

  document.getElementById('resultTitle').textContent  = isWin ? 'クリア！🎉' : 'ゲームオーバー';
  document.getElementById('resultTitle').className    = 'result-title ' + (isWin ? 'correct' : 'wrong');
  document.getElementById('resultMode').textContent   = modeName + 'モード';
  document.getElementById('resultScore').textContent  = correctCount;
  document.getElementById('resultTotal').textContent  = total;
  document.getElementById('resultBest').textContent   = best;
}

function goTitle() {
  showScreen('screenTitle');
}

function retryGame() {
  startGame();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // ミス上限ボタン初期化
  selectMissLimit(1);

  // Enter キーで回答
  document.getElementById('answerInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAnswer();
  });

  // best score をタイトルに反映
  updateTitleBest();
});

function updateTitleBest() {
  const prefBest    = localStorage.getItem('mapquiz_best_prefecture') || '—';
  const countryBest = localStorage.getItem('mapquiz_best_country')    || '—';
  const el = document.getElementById('titleBestScores');
  if (el) el.innerHTML =
    `都道府県ベスト: <strong>${prefBest}</strong> &nbsp;|&nbsp; 国ベスト: <strong>${countryBest}</strong>`;
}
