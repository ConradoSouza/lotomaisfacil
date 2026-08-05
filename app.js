/* Loto+Facil — app multi-loteria (Fase 4)
   Dados: window.LOTO_DB[loteria] = [[concurso, "dd/mm/aaaa", [dezenas]], ...] */
'use strict';

/* ================= Configuração das loterias ================= */
const LOTERIAS = {
  lotofacil: { nome: 'Lotofácil', total: 25, sorteados: 15, apostaMin: 15, apostaMax: 20, premios: [15, 14, 13, 12, 11], cols: 5, fechMax: 20, cor: '#6d3bef', cor2: '#9a6cff' },
  megasena: { nome: 'Mega-Sena', total: 60, sorteados: 6, apostaMin: 6, apostaMax: 15, premios: [6, 5, 4], cols: 10, fechMax: 14, cor: '#1f9d57', cor2: '#4cc98a' },
  quina: { nome: 'Quina', total: 80, sorteados: 5, apostaMin: 5, apostaMax: 15, premios: [5, 4, 3, 2], cols: 10, fechMax: 12, cor: '#6a3ad1', cor2: '#9a6cff' },
  lotomania: { nome: 'Lotomania', total: 100, min: 0, sorteados: 20, apostaMin: 50, apostaMax: 50, premios: [20, 19, 18, 17, 16, 15, 0], cols: 10, fechamento: false, cor: '#f07c00', cor2: '#ff9e33' },
  duplasena: { nome: 'Dupla Sena', total: 50, sorteados: 6, apostaMin: 6, apostaMax: 15, premios: [6, 5, 4, 3], cols: 10, fechMax: 14, cor: '#b3123a', cor2: '#e04e6e' },
  diadesorte: { nome: 'Dia de Sorte', total: 31, sorteados: 7, apostaMin: 7, apostaMax: 15, premios: [7, 6, 5, 4], cols: 8, fechMax: 14, mes: true, cor: '#c58a1a', cor2: '#e6b23f' },
};

/* ================= Estado (recalculado por loteria) ================= */
let L, KEY, DRAWS, N, NUMS, K, EVENS;
let freqAll, atraso, maxAtraso, repHist, repCount, repMean, parHist, somas, somaMin, somaMax, somaAvg, somaSd;
let faixaDefs, faixaTot, co, afinStrength, score, lastDraw, lastSet, premiosRef;
function money(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function moneyShort(v) { v = v || 0; if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi'; if (v >= 1e3) return 'R$ ' + (v / 1e3).toFixed(1).replace('.', ',') + ' mil'; return money(v); }
function premioDe(hits) { return premiosRef && premiosRef.premios && premiosRef.premios[hits]; } // [valor, ganhadores] ou undefined
function ganhou(hits) { return L.premios.includes(hits); } // faixa premiada? (Lotomania: 0 ou 15-20)

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function ball(n, cls = '') { return `<div class="ball ${cls}">${pad(n)}</div>`; }
function bar(label, val, max, cls = '', suffix = '') {
  const p = max ? (val / max * 100) : 0;
  return `<div class="barline"><div class="bl">${label}</div><div class="bt"><div class="bf ${cls}" style="width:${p}%"></div></div><div class="bv">${val}${suffix}</div></div>`;
}
function options(values, sel, labelFn) {
  return values.map(v => `<option value="${v}"${v == sel ? ' selected' : ''}>${labelFn ? labelFn(v) : v}</option>`).join('');
}

/* ================= Cálculo das estatísticas ================= */
function makeFaixas(min, total) {
  const gs = total <= 25 ? 5 : 10, defs = [], end = min + total - 1;
  for (let a = min; a <= end; a += gs) defs.push([a, Math.min(a + gs - 1, end)]);
  return defs;
}
function freqWindow(w) {
  const f = {}; NUMS.forEach(n => f[n] = 0);
  const start = w > 0 ? Math.max(0, N - w) : 0;
  for (let i = start; i < N; i++) DRAWS[i][2].forEach(n => f[n]++);
  return { f, draws: N - start };
}
function minmax(obj) {
  const vals = NUMS.map(n => obj[n]);
  const lo = Math.min(...vals), hi = Math.max(...vals), out = {};
  NUMS.forEach(n => out[n] = hi === lo ? 50 : ((obj[n] - lo) / (hi - lo)) * 100);
  return out;
}
const WEIGHTS = { curta: .20, media: .15, hist: .15, atraso: .20, rep: .10, afin: .10, tend: .10 };
function scoreFrom(sig, w) {
  const nc = minmax(sig.curta), nm = minmax(sig.media), nh = minmax(sig.hist),
    na = minmax(sig.atraso), nr = minmax(sig.repRate), nf = minmax(sig.afin), nt = minmax(sig.tend);
  const den = (w.curta + w.media + w.hist + w.atraso + w.rep + w.afin + w.tend) || 1, s = {};
  NUMS.forEach(n => s[n] = (w.curta * nc[n] + w.media * nm[n] + w.hist * nh[n] + w.atraso * na[n] + w.rep * nr[n] + w.afin * nf[n] + w.tend * nt[n]) / den);
  return s;
}
function computeStats() {
  freqAll = {}; NUMS.forEach(n => freqAll[n] = 0);
  DRAWS.forEach(d => d[2].forEach(n => freqAll[n]++));

  const lastSeen = {}; NUMS.forEach(n => lastSeen[n] = -1);
  DRAWS.forEach((d, i) => d[2].forEach(n => lastSeen[n] = i));
  atraso = {}; NUMS.forEach(n => atraso[n] = (N - 1) - lastSeen[n]);

  maxAtraso = {}; NUMS.forEach(n => maxAtraso[n] = 0);
  { const li = {}; NUMS.forEach(n => li[n] = -1);
    DRAWS.forEach((d, i) => d[2].forEach(n => { const g = i - li[n] - 1; if (g > maxAtraso[n]) maxAtraso[n] = g; li[n] = i; }));
    NUMS.forEach(n => { const g = (N - 1) - li[n]; if (g > maxAtraso[n]) maxAtraso[n] = g; }); }

  repHist = Array(K + 1).fill(0); repCount = {}; NUMS.forEach(n => repCount[n] = 0);
  for (let i = 1; i < N; i++) {
    const prev = new Set(DRAWS[i - 1][2]); let r = 0;
    DRAWS[i][2].forEach(n => { if (prev.has(n)) { r++; repCount[n]++; } });
    repHist[r]++;
  }
  repMean = repHist.reduce((s, v, i) => s + v * i, 0) / Math.max(1, N - 1);

  parHist = Array(K + 1).fill(0);
  DRAWS.forEach(d => parHist[d[2].filter(n => n % 2 === 0).length]++);

  somas = DRAWS.map(d => d[2].reduce((a, b) => a + b, 0));
  somaMin = Math.min(...somas); somaMax = Math.max(...somas);
  somaAvg = somas.reduce((a, b) => a + b, 0) / N;
  somaSd = Math.sqrt(somas.reduce((a, b) => a + (b - somaAvg) ** 2, 0) / N);

  faixaDefs = makeFaixas(NUMS[0], L.total);
  faixaTot = faixaDefs.map(([a, b]) => { let c = 0; for (let n = a; n <= b; n++) c += freqAll[n]; return c; });

  const size = NUMS[NUMS.length - 1] + 1;
  co = Array.from({ length: size }, () => new Array(size).fill(0));
  DRAWS.forEach(d => { const a = d[2]; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { co[a[i]][a[j]]++; co[a[j]][a[i]]++; } });
  afinStrength = {}; NUMS.forEach(n => afinStrength[n] = co[n].reduce((a, b) => a + b, 0));

  const w20 = freqWindow(20), w50 = freqWindow(50), w100 = freqWindow(100);
  const tend = {}, repRate = {};
  NUMS.forEach(n => { tend[n] = w20.f[n] / w20.draws - w100.f[n] / w100.draws; repRate[n] = freqAll[n] ? repCount[n] / freqAll[n] : 0; });
  score = scoreFrom({ curta: w20.f, media: w50.f, hist: freqAll, atraso, repRate, afin: afinStrength, tend }, WEIGHTS);

  lastDraw = DRAWS[N - 1][2].slice(); lastSet = new Set(lastDraw);
}
function scoreColor(v) { return v >= 66 ? 'var(--green)' : v >= 40 ? 'var(--amber)' : 'var(--muted)'; }

/* ================= Painel ================= */
function renderPainel() {
  const first = DRAWS[0], last = DRAWS[N - 1];
  $('painelSub').textContent = `${L.nome} · concursos ${first[0]}–${last[0]} · ${N} sorteios · até ${last[1]}`;
  $('footN').textContent = last[0];
  const cards = [
    { k: 'Concursos', v: N, s: `${first[1]} — ${last[1]}` },
    { k: 'Último', v: '#' + last[0], s: last[1] },
    { k: 'Soma média', v: somaAvg.toFixed(0), s: `min ${somaMin} · máx ${somaMax}` },
    { k: 'Pares / sorteio', v: (parHist.reduce((s, v, i) => s + v * i, 0) / N).toFixed(1), s: `de ${K} dezenas` },
  ];
  $('painelCards').innerHTML = cards.map(c => `<div class="stat"><div class="k">${c.k}</div><div class="v">${c.v}</div><div class="s">${c.s}</div></div>`).join('');
  $('lastInfo').textContent = `#${last[0]} · ${last[1]}`;
  $('lastBalls').innerHTML = last[2].map(n => ball(n)).join('');
  $('lastMes').innerHTML = (L.mes && last[3]) ? `<div style="margin-top:12px;"><span class="tagm" style="background:color-mix(in srgb,var(--gold) 20%,transparent);color:var(--amber);border-color:transparent;font-size:13.5px;padding:6px 13px;">🗓️ Mês da Sorte: <b>${last[3]}</b></span></div>` : '';

  // prêmios do último concurso
  if (premiosRef && premiosRef.premios && Object.keys(premiosRef.premios).length) {
    $('premiosBlock').style.display = '';
    $('painelPremios').innerHTML = L.premios.map(h => {
      const p = premiosRef.premios[h]; if (!p) return '';
      const venceu = p[1] > 0;
      return `<div class="result-line"><span class="k">${h} acertos</span><span class="v">${venceu ? money(p[0]) + ' <span style="color:var(--muted);font-weight:400;">· ' + p[1].toLocaleString('pt-BR') + ' ganhador(es)</span>' : '<span style="color:var(--amber);">Acumulou</span>'}</span></div>`;
    }).join('');
  } else { $('premiosBlock').style.display = 'none'; }

  const hot = [...NUMS].sort((a, b) => freqAll[b] - freqAll[a]).slice(0, 10);
  $('hotList').innerHTML = hot.map(n => bar(pad(n), freqAll[n], freqAll[hot[0]], 'hot')).join('');
  const cold = [...NUMS].sort((a, b) => atraso[b] - atraso[a]).slice(0, 10);
  $('coldList').innerHTML = cold.map(n => bar(pad(n), atraso[n], atraso[cold[0]] || 1, 'cold')).join('');

  renderAutoConf();
  renderRaioX();
}

// Raio-X: como o último resultado se compara ao padrão histórico
function renderRaioX() {
  const last = DRAWS[N - 1][2], soma = last.reduce((a, b) => a + b, 0), pares = last.filter(n => n % 2 === 0).length;
  const modePar = parHist.indexOf(Math.max(...parHist));
  const rep = N > 1 ? last.filter(n => DRAWS[N - 2][2].includes(n)).length : 0;
  const fc = faixaDefs.map(([a, b]) => last.filter(n => n >= a && n <= b).length);
  const sorted = last.slice().sort((a, b) => a - b); let run = 1, maxRun = 1;
  for (let i = 1; i < sorted.length; i++) { if (sorted[i] === sorted[i - 1] + 1) { run++; if (run > maxRun) maxRun = run; } else run = 1; }
  const tag = (txt, warn) => `<span class="tagm" style="color:${warn ? 'var(--amber)' : 'var(--green)'};border-color:transparent;background:color-mix(in srgb,${warn ? 'var(--amber)' : 'var(--green)'} 14%,transparent);">${txt}</span>`;
  const somaV = soma < somaAvg - somaSd ? tag('baixa', true) : soma > somaAvg + somaSd ? tag('alta', true) : tag('típica', false);
  const lines = [
    `<div class="result-line"><span class="k">Soma</span><span class="v">${soma} ${somaV} <span style="color:var(--muted);font-weight:400;">média ${somaAvg.toFixed(0)}</span></span></div>`,
    `<div class="result-line"><span class="k">Pares / Ímpares</span><span class="v">${pares}P / ${K - pares}Í ${tag('+ comum: ' + modePar + 'P', Math.abs(pares - modePar) >= 2)}</span></div>`,
  ];
  if (N > 1) lines.push(`<div class="result-line"><span class="k">Repetiu do anterior</span><span class="v">${rep} dezena(s) <span style="color:var(--muted);font-weight:400;">média ${repMean.toFixed(1)}</span></span></div>`);
  lines.push(`<div class="result-line"><span class="k">Faixas</span><span class="v">${fc.join('-')}</span></div>`);
  lines.push(`<div class="result-line"><span class="k">Maior sequência</span><span class="v">${maxRun} dezena(s) seguida(s)</span></div>`);
  $('raioX').innerHTML = lines.join('');
}

// Conferência automática: como os jogos salvos se saíram no último concurso
function renderAutoConf() {
  const box = $('autoConf');
  if (!meusJogos.length) { box.innerHTML = ''; return; }
  const last = DRAWS[N - 1], lastS = new Set(last[2]);
  let best = 0, wins = 0, bestPremio = 0;
  meusJogos.forEach(j => {
    const h = j.nums.filter(n => lastS.has(n)).length;
    if (h > best) best = h;
    if (ganhou(h)) { wins++; const pr = premioDe(h); if (pr && pr[0] > bestPremio) bestPremio = pr[0]; }
  });
  let stored; try { stored = parseInt(localStorage.getItem('lotomais-visto-' + KEY)); } catch (e) {}
  const isNew = stored && last[0] > stored, win = wins > 0;
  const badge = isNew ? '<span class="badge-new">novo</span>' : '';
  const txt = win
    ? `${badge}<b>🎉 Você ganhou!</b> No concurso <b>#${last[0]}</b>, ${wins} jogo(s) premiado(s) — melhor: <b>${best} acertos</b>${bestPremio > 0 ? ' (~' + moneyShort(bestPremio) + ')' : ''}.`
    : `${badge}No concurso <b>#${last[0]}</b>, seu melhor jogo fez <b>${best} acerto(s)</b>. Boa sorte no próximo! 🍀`;
  box.innerHTML = `<div class="banner ${win ? 'win' : ''}"><span class="bi">${win ? '🏆' : '🍀'}</span><span class="bt">${txt}</span><button class="bx" title="Fechar">✕</button></div>`;
  box.querySelector('.bx').addEventListener('click', () => { box.innerHTML = ''; });
  try { localStorage.setItem('lotomais-visto-' + KEY, last[0]); } catch (e) {}
}

/* ================= Dezenas (Score) ================= */
let janela = 100, dezSort = { k: 'score', dir: -1 };
function renderDezenas() {
  const { f, draws } = freqWindow(janela);
  const rows = NUMS.map(n => ({ n, score: score[n], freq: f[n], pct: f[n] / draws * 100, atraso: atraso[n], maxAtraso: maxAtraso[n] }));
  rows.sort((a, b) => (a[dezSort.k] - b[dezSort.k]) * dezSort.dir);
  $('dezTable').querySelector('tbody').innerHTML = rows.map(r => `
    <tr><td><strong>${pad(r.n)}</strong></td>
      <td><span class="scorechip" style="background:${scoreColor(r.score)}">${r.score.toFixed(0)}</span></td>
      <td>${r.freq}</td><td>${r.pct.toFixed(0)}%</td><td>${r.atraso}</td><td>${r.maxAtraso}</td></tr>`).join('');
  $('dezTable').querySelectorAll('th').forEach(th => th.classList.toggle('act', th.dataset.k === dezSort.k));
}

/* ================= Padrões ================= */
function barsRanked(items) {
  const max = Math.max(...items.map(i => i.val));
  return items.map(i => {
    let tone = 'strong'; if (i.val === max) tone = 'peak'; else if (i.val < max * 0.20) tone = 'low';
    const p = max ? (i.val / max * 100) : 0;
    const badge = tone === 'peak' ? '<span class="peaktag">+ sai</span>' : '';
    return `<div class="barline ${tone === 'peak' ? 'peak' : ''}"><div class="bl">${i.label}</div><div class="bt"><div class="bf ${tone}" style="width:${p}%"></div></div><div class="bv">${i.suffix || i.val}${badge}</div></div>`;
  }).join('');
}
function renderPadroes() {
  const parItems = [];
  parHist.forEach((v, pares) => { if (v > 0) parItems.push({ label: `${pares}P / ${K - pares}Í`, val: v, suffix: `${v} (${(v / N * 100).toFixed(0)}%)` }); });
  $('parChart').innerHTML = barsRanked(parItems);

  $('somaHint').textContent = `média ${somaAvg.toFixed(0)}`;
  const step = L.total <= 25 ? 10 : Math.max(10, Math.round((somaMax - somaMin) / 14 / 10) * 10);
  const bucket = {}; somas.forEach(s => { const b = Math.floor(s / step) * step; bucket[b] = (bucket[b] || 0) + 1; });
  const keys = Object.keys(bucket).map(Number).sort((a, b) => a - b);
  $('somaChart').innerHTML = barsRanked(keys.map(k => ({ label: k + '–' + (k + step - 1), val: bucket[k], suffix: String(bucket[k]) })));

  $('faixaChart').innerHTML = barsRanked(faixaDefs.map(([a, b], i) => ({ label: a + '-' + b, val: faixaTot[i], suffix: String(faixaTot[i]) })));

  const repItems = [];
  repHist.forEach((v, r) => { if (v > 0) repItems.push({ label: `${r} nºs`, val: v, suffix: `${v} (${(v / (N - 1) * 100).toFixed(0)}%)` }); });
  $('repChart').innerHTML = barsRanked(repItems);

  const pairs = [];
  for (let ia = 0; ia < NUMS.length; ia++) for (let ib = ia + 1; ib < NUMS.length; ib++) { const a = NUMS[ia], b = NUMS[ib]; if (co[a][b]) pairs.push([a, b, co[a][b]]); }
  pairs.sort((x, y) => y[2] - x[2]);
  const top = pairs.slice(0, 10), maxPair = top.length ? top[0][2] : 1;
  $('afinList').innerHTML = top.map(([a, b, c], i) => {
    const peak = i === 0, badge = peak ? '<span class="peaktag">+ junta</span>' : '';
    return `<div class="barline ${peak ? 'peak' : ''}"><div class="bl" style="display:flex;gap:4px">${ball(a, 'sm')}${ball(b, 'sm')}</div><div class="bt"><div class="bf ${peak ? 'peak' : 'strong'}" style="width:${c / maxPair * 100}%"></div></div><div class="bv">${c}×${badge}</div></div>`;
  }).join('');

  renderEvo();
  renderMeses();
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function renderMeses() {
  if (!L.mes) { $('mesBlock').style.display = 'none'; return; }
  $('mesBlock').style.display = '';
  const cont = {}; MESES.forEach(m => cont[m] = 0);
  DRAWS.forEach(d => { if (d[3] != null && cont[d[3]] != null) cont[d[3]]++; });
  $('mesChart').innerHTML = barsRanked(MESES.map(m => ({ label: m, val: cont[m], suffix: String(cont[m]) })));
}
function renderEvo() {
  const n = parseInt($('evoSel').value) || NUMS[0];
  // tamanho de bloco "redondo" que gere ~12-16 barras
  const size = [50, 100, 200, 250, 500, 1000, 2000].find(s => Math.ceil(N / s) <= 16) || Math.ceil(N / 16);
  const items = [];
  for (let start = 0; start < N; start += size) {
    const end = Math.min(N, start + size); let c = 0;
    for (let i = start; i < end; i++) if (DRAWS[i][2].indexOf(n) !== -1) c++;
    items.push({ label: DRAWS[start][0] + '–' + DRAWS[end - 1][0], val: c, suffix: c + '×' });
  }
  $('evoDesc').innerHTML = `Cada barra é um bloco de <b>${size} concursos</b>. À esquerda, a faixa de concursos; à direita, quantas vezes a dezena <b>${pad(n)}</b> saiu ali (a mais alta em dourado).`;
  $('evoChart').innerHTML = barsRanked(items);
}

/* ================= Gerador ================= */
let weightMode = 'score';
const PRESETS = {
  equilibrada: { mode: 'score', rep: 1, par: 1, soma: 1, faixa: 1, score: 1 },
  repeticao: { mode: 'score', rep: 1, par: 1, soma: 1, faixa: 0, score: 1 },
  quentes: { mode: 'freq', rep: 0, par: 1, soma: 1, faixa: 1, score: 0 },
  frias: { mode: 'atraso', rep: 0, par: 1, soma: 0, faixa: 1, score: 0 },
  afinidade: { mode: 'afinidade', rep: 1, par: 0, soma: 0, faixa: 1, score: 0 },
  aleatorio: { mode: 'uniform', rep: 0, par: 0, soma: 0, faixa: 0, score: 0 },
};
function applyPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  weightMode = p.mode;
  $('fRep').checked = !!p.rep; $('fPar').checked = !!p.par; $('fSoma').checked = !!p.soma; $('fFaixa').checked = !!p.faixa; $('fScore').checked = !!p.score;
}
function baseWeight(n) {
  let w;
  if (weightMode === 'freq') w = freqAll[n]; else if (weightMode === 'atraso') w = atraso[n] + 1;
  else if (weightMode === 'afinidade') w = afinStrength[n]; else if (weightMode === 'uniform') w = 1; else w = score[n];
  w = Math.max(w, 0.001);
  if ($('fScore').checked) w *= (score[n] / 100 + 0.15);
  return w;
}
function sampleWeighted(pool, weights, count) {
  const p = pool.slice(), chosen = [];
  for (let k = 0; k < count && p.length; k++) {
    let total = 0; p.forEach(n => total += weights[n]);
    let r = Math.random() * total, idx = 0;
    for (; idx < p.length; idx++) { r -= weights[p[idx]]; if (r <= 0) break; }
    idx = Math.min(idx, p.length - 1); chosen.push(p[idx]); p.splice(idx, 1);
  }
  return chosen;
}
function buildCandidate(cfg) {
  const allowed = NUMS.filter(n => !excluidas.has(n));
  const fx = [...fixadas].filter(n => !excluidas.has(n)).slice(0, cfg.qtd);
  const fxSet = new Set(fx);
  const w = {}; allowed.forEach(n => w[n] = baseWeight(n));
  const need = cfg.qtd - fx.length;
  let rest = [];
  if (need > 0) {
    if (cfg.rep) {
      const lastPool = lastDraw.filter(n => !excluidas.has(n) && !fxSet.has(n));
      const nonLast = allowed.filter(n => !lastSet.has(n) && !fxSet.has(n));
      const fixedReps = fx.filter(n => lastSet.has(n)).length;
      const target = Math.round(repMean), lo = Math.max(0, target - 1), hi = Math.min(K, target + 1, lastDraw.length);
      let repN = (lo + Math.floor(Math.random() * (hi - lo + 1))) - fixedReps;
      repN = Math.max(0, Math.min(repN, lastPool.length, need));
      const a = sampleWeighted(lastPool, w, repN), aSet = new Set(a);
      const b = sampleWeighted(nonLast.filter(n => !aSet.has(n)), w, need - a.length);
      rest = a.concat(b);
    } else {
      rest = sampleWeighted(allowed.filter(n => !fxSet.has(n)), w, need);
    }
  }
  return fx.concat(rest).sort((a, b) => a - b);
}
function fitScore(game, cfg) {
  let active = 0, ok = 0;
  const pares = game.filter(n => n % 2 === 0).length, soma = game.reduce((a, b) => a + b, 0);
  if (cfg.par) { active++; const t = Math.round(cfg.qtd * EVENS / L.total); if (Math.abs(pares - t) <= 1) ok++; }
  if (cfg.soma) { active++; const scale = cfg.qtd / K; if (soma >= (somaAvg - somaSd) * scale && soma <= (somaAvg + somaSd) * scale) ok++; }
  if (cfg.faixa) { active++; const fc = faixaDefs.map(([a, b]) => game.filter(n => n >= a && n <= b).length); if (Math.max(...fc) - Math.min(...fc) <= 2) ok++; }
  return { active, ok };
}
function generateOne(cfg) {
  let best = null, bestOk = -1;
  for (let t = 0; t < 300; t++) { const g = buildCandidate(cfg); const { active, ok } = fitScore(g, cfg); if (ok > bestOk) { bestOk = ok; best = g; } if (ok === active) return g; }
  return best;
}
// Geração rápida (surpresinha / por data)
function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function quickPick(count, seedStr) {
  const rnd = seedStr ? mulberry32(hashStr(seedStr)) : Math.random;
  const pool = NUMS.slice(), g = [];
  for (let k = 0; k < count && pool.length; k++) g.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return g.sort((a, b) => a - b);
}
function renderOneGame(game, titulo) {
  const m = gameMeta(game);
  $('genResults').innerHTML = `<div class="game"><div class="ghead"><span class="gtitle">${titulo}</span><span class="tagm">Score médio <b>${m.avgScore.toFixed(0)}</b></span></div>
    <div class="balls">${game.map(n => ball(n, 'sm')).join('')}</div>
    <div class="gmeta"><span class="tagm">Soma <b>${m.soma}</b></span><span class="tagm">${m.pares}P / ${m.impares}I</span><span class="tagm">Faixas ${m.fc.join('-')}</span></div></div>`;
  $('genResults').appendChild(exportBar(titulo + ' — ' + L.nome, [game], KEY + '-jogo', true));
}
function gameMeta(game) {
  const pares = game.filter(n => n % 2 === 0).length;
  return { pares, impares: game.length - pares, soma: game.reduce((a, b) => a + b, 0), rep: game.filter(n => lastSet.has(n)).length, fc: faixaDefs.map(([a, b]) => game.filter(n => n >= a && n <= b).length), avgScore: game.reduce((a, n) => a + score[n], 0) / game.length };
}

/* ================= Exportar ================= */
function gamesToCSV(games) {
  const mx = Math.max(...games.map(g => g.length));
  const head = 'Jogo,' + Array.from({ length: mx }, (_, i) => 'D' + (i + 1)).join(',');
  return head + '\n' + games.map((g, i) => ['Jogo ' + (i + 1), ...g.map(pad)].join(',')).join('\n');
}
function downloadCSV(name, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function printGames(title, games) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return; }
  const rows = games.map((g, i) => `<tr><td>${i + 1}</td><td>${g.map(pad).join(' &nbsp; ')}</td></tr>`).join('');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:26px;color:#161022;}h1{font-size:19px;margin:0 0 2px;color:${L.cor};}
    .meta{color:#666;font-size:13px;margin:0 0 16px;}table{border-collapse:collapse;width:100%;font-size:14px;}
    td{border:1px solid #ddd;padding:7px 10px;letter-spacing:.5px;}td:first-child{width:44px;color:#888;text-align:center;font-weight:bold;}
    .foot{margin-top:18px;color:#888;font-size:11px;}button{margin-top:18px;padding:10px 18px;font-size:14px;background:${L.cor};color:#fff;border:none;border-radius:8px;cursor:pointer;}
    @media print{button{display:none;}}</style></head><body>
    <h1>${title}</h1><p class="meta">Loto+Facil · ${L.nome} · ${games.length} jogos · ${new Date().toLocaleDateString('pt-BR')}</p>
    <table>${rows}</table><p class="foot">Ferramenta estatística e educativa — não garante resultado.</p>
    <button onclick="window.print()">Imprimir / Salvar PDF</button></body></html>`);
  w.document.close();
}
const APP_URL = 'https://lotomaisfacil.pages.dev/';
// leva as dezenas dos jogos gerados para o modo Fechamento (bolão = união das dezenas)
function copyToFechamento(games) {
  $('gerToggle').querySelector('[data-mode="fechamento"]').click();
  if (!isPro()) { $('fechResult').innerHTML = proNote('Fechamentos'); $('fechMode').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const flat = games.reduce((a, g) => a.concat(g), []);
  const uni = [...new Set(flat)];
  let pool;
  if (uni.length > L.fechMax) {
    const freq = {}; flat.forEach(n => freq[n] = (freq[n] || 0) + 1);
    pool = uni.sort((a, b) => (freq[b] - freq[a]) || (a - b)).slice(0, L.fechMax).sort((a, b) => a - b);
  } else pool = uni.sort((a, b) => a - b);
  selFech.clear();
  const cells = $('fechPicker').children;
  Array.from(cells).forEach(c => c.classList.remove('sel'));
  pool.forEach(n => { const idx = NUMS.indexOf(n); if (idx >= 0 && cells[idx]) { selFech.add(n); cells[idx].classList.add('sel'); } });
  fechMsg();
  let aviso;
  if (uni.length > L.fechMax) aviso = `Peguei as <b>${L.fechMax}</b> dezenas mais presentes nos jogos (o bolão do fechamento vai até ${L.fechMax}).`;
  else if (pool.length < K + 1) aviso = `Bolão de <b>${pool.length}</b> dezenas — adicione mais ${K + 1 - pool.length} (mínimo ${K + 1}) para poder fechar.`;
  else aviso = `Bolão de <b>${pool.length}</b> dezenas pronto! Escolha a garantia e toque em "Gerar fechamento".`;
  $('fechResult').innerHTML = `<div class="note">${aviso}</div>`;
  $('fechMode').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function waText(title, games) {
  const linhas = games.map((g, i) => (games.length > 1 ? 'Jogo ' + (i + 1) + ': ' : '') + g.map(pad).join(' '));
  return `🍀 ${title}\n\n${linhas.join('\n')}\n\nGerado no Loto+Facil:\n${APP_URL}`;
}
function shareWhatsApp(title, games) {
  window.open('https://wa.me/?text=' + encodeURIComponent(waText(title, games)), '_blank');
}
function exportBar(title, games, baseName, fechavel) {
  const bar = document.createElement('div'); bar.className = 'chips'; bar.style.marginTop = '12px';
  const mk = (txt, fn) => { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = txt; b.addEventListener('click', () => fn(b)); return b; };
  if (fechavel && L.fechamento !== false) bar.append(mk('🎯 Montar fechamento', () => copyToFechamento(games)));
  const salvar = mk('⭐ Salvar em Meus jogos', () => {
    if (bar.querySelector('.saveform') || salvar.disabled) return;
    const form = document.createElement('div'); form.className = 'saveform';
    form.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-basis:100%;width:100%;';
    const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 40;
    inp.placeholder = games.length > 1 ? 'nome do carrinho (opcional)' : 'nome do jogo (opcional)';
    inp.style.cssText = 'flex:1;margin-top:0;';
    const ok = document.createElement('button'); ok.className = 'btn'; ok.type = 'button'; ok.textContent = 'Salvar'; ok.style.cssText = 'width:auto;padding:8px 14px;flex:none;';
    const doSave = () => { addMeusGames(games.map(g => g.slice()), inp.value.trim()); salvar.textContent = '✓ Salvos'; salvar.disabled = true; form.remove(); };
    ok.addEventListener('click', doSave);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
    form.append(inp, ok); bar.appendChild(form); inp.focus();
  });
  bar.append(
    mk('📱 WhatsApp', () => shareWhatsApp(title, games)),
    mk('⬇ Baixar CSV', () => downloadCSV(baseName + '.csv', gamesToCSV(games))),
    mk('🖨 PDF / Imprimir', () => printGames(title, games)),
    salvar
  );
  return bar;
}

/* ================= Fechamento ================= */
function combosIdx(m, k) {
  const res = [], idx = Array.from({ length: k }, (_, i) => i);
  if (k > m) return res;
  while (true) {
    res.push(idx.slice());
    let i = k - 1; while (i >= 0 && idx[i] === m - k + i) i--;
    if (i < 0) break;
    idx[i]++; for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return res;
}
function maskOf(pos) { let mk = 0; pos.forEach(p => mk |= (1 << p)); return mk; }
function popcount(x) { let c = 0; while (x) { x &= x - 1; c++; } return c; }
function binom(n, k) { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); }
function fechamento(pool, P) {
  const m = pool.length, gamesPos = combosIdx(m, K), masks = gamesPos.map(maskOf), U = masks.length;
  if (P >= K) return { games: gamesPos, total: U };
  const maxDiff = K - P, idxOf = new Map(); masks.forEach((mk, i) => idxOf.set(mk, i));
  const cover = new Array(U);
  for (let g = 0; g < U; g++) {
    const inBits = [], outBits = [];
    for (let p = 0; p < m; p++) ((masks[g] >> p) & 1 ? inBits : outBits).push(p);
    const covered = new Set([g]);
    for (let d = 1; d <= maxDiff; d++) {
      const remC = combosIdx(K, d), addC = combosIdx(outBits.length, d);
      remC.forEach(rc => addC.forEach(ac => { let mk = masks[g]; rc.forEach(r => mk &= ~(1 << inBits[r])); ac.forEach(a => mk |= (1 << outBits[a])); const wi = idxOf.get(mk); if (wi !== undefined) covered.add(wi); }));
    }
    cover[g] = Array.from(covered);
  }
  const uncovered = new Uint8Array(U).fill(1); let remaining = U; const sol = [];
  while (remaining > 0) {
    let bestG = -1, bestC = -1;
    for (let g = 0; g < U; g++) { let c = 0; const cl = cover[g]; for (let x = 0; x < cl.length; x++) if (uncovered[cl[x]]) c++; if (c > bestC) { bestC = c; bestG = g; } }
    const cl = cover[bestG]; for (let x = 0; x < cl.length; x++) if (uncovered[cl[x]]) { uncovered[cl[x]] = 0; remaining--; }
    sol.push(bestG);
  }
  return { games: sol.map(g => gamesPos[g]), total: U };
}
function verifyGuarantee(gm, allW, P) {
  for (let i = 0; i < allW.length; i++) { let ok = false; for (let j = 0; j < gm.length; j++) if (popcount(gm[j] & allW[i]) >= P) { ok = true; break; } if (!ok) return false; }
  return true;
}
function brl(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); }

/* ================= Monte Carlo ================= */
function randomPick(count) {
  const pool = NUMS.slice(), g = [];
  for (let k = 0; k < count && pool.length; k++) g.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return g;
}

/* ================= Backtest ================= */
function runBacktest(weights, topK, range) {
  const minHist = 100, startTest = range > 0 ? Math.max(minHist, N - range) : minHist;
  const hist = {}, lastIdx = {}, repC = {}, afinStr = {};
  NUMS.forEach(n => { hist[n] = 0; lastIdx[n] = -1; repC[n] = 0; afinStr[n] = 0; });
  const win = { 20: {}, 50: {}, 100: {} }; [20, 50, 100].forEach(w => NUMS.forEach(n => win[w][n] = 0));
  const hits = Array(K + 1).fill(0); let sum = 0, tests = 0, maxHit = 0;
  for (let i = 0; i < N; i++) {
    if (i >= startTest) {
      const sig = { curta: {}, media: {}, hist: {}, atraso: {}, repRate: {}, afin: {}, tend: {} };
      const c20 = Math.min(20, i), c100 = Math.min(100, i);
      NUMS.forEach(n => { sig.curta[n] = win[20][n]; sig.media[n] = win[50][n]; sig.hist[n] = hist[n]; sig.atraso[n] = (i - 1) - lastIdx[n]; sig.repRate[n] = hist[n] ? repC[n] / hist[n] : 0; sig.afin[n] = afinStr[n]; sig.tend[n] = (win[20][n] / c20) - (win[100][n] / c100); });
      const s = scoreFrom(sig, weights), picks = new Set([...NUMS].sort((a, b) => s[b] - s[a]).slice(0, topK));
      const h = DRAWS[i][2].filter(n => picks.has(n)).length; hits[h]++; sum += h; tests++; if (h > maxHit) maxHit = h;
    }
    const d = DRAWS[i][2];
    if (i > 0) { const prev = new Set(DRAWS[i - 1][2]); d.forEach(n => { if (prev.has(n)) repC[n]++; }); }
    d.forEach(n => { hist[n]++; lastIdx[n] = i; });
    for (let a = 0; a < d.length; a++) for (let b = a + 1; b < d.length; b++) { afinStr[d[a]]++; afinStr[d[b]]++; }
    [20, 50, 100].forEach(w => { d.forEach(n => win[w][n]++); const out = i - w; if (out >= 0) DRAWS[out][2].forEach(n => win[w][n]--); });
  }
  return { tests, avg: tests ? sum / tests : 0, maxHit, hits };
}

/* ================= Pickers (rebuild por loteria) ================= */
const selConferir = new Set(), selMeus = new Set(), selFech = new Set();
function buildPicker(container, set, maxFn, onChange) {
  container.innerHTML = ''; set.clear();
  container.style.gridTemplateColumns = `repeat(${L.cols},1fr)`;
  container.style.maxWidth = L.cols > 5 ? '480px' : '320px';
  NUMS.forEach(n => {
    const c = document.createElement('div'); c.className = 'pcell'; c.textContent = pad(n);
    c.addEventListener('click', () => {
      if (set.has(n)) { set.delete(n); c.classList.remove('sel'); }
      else if (set.size < maxFn()) { set.add(n); c.classList.add('sel'); }
      onChange();
    });
    container.appendChild(c);
  });
  onChange();
}
function conferirMsg() { $('pickMsg').textContent = `${selConferir.size} dezena(s) · escolha de ${L.apostaMin} a ${L.apostaMax}`; }
function meusMsg() { $('meusPickMsg').textContent = `${selMeus.size} dezena(s) selecionada(s) · ${L.apostaMin} a ${L.apostaMax}`; }
function fechMsg() { $('fechMsg').textContent = `${selFech.size} dezena(s) · escolha de ${K + 1} a ${L.fechMax}`; }

// grid de dezenas fixas/excluídas do gerador (toque cicla: neutro -> fixa -> excluída)
const fixadas = new Set(), excluidas = new Set();
function buildFixGrid() {
  const box = $('fixPicker'); box.innerHTML = ''; fixadas.clear(); excluidas.clear();
  box.style.gridTemplateColumns = `repeat(${L.cols},1fr)`;
  box.style.maxWidth = L.cols > 5 ? '480px' : '320px';
  NUMS.forEach(n => {
    const c = document.createElement('div'); c.className = 'pcell'; c.textContent = pad(n);
    c.addEventListener('click', () => {
      if (fixadas.has(n)) { fixadas.delete(n); excluidas.add(n); c.classList.remove('fixa'); c.classList.add('excl'); }
      else if (excluidas.has(n)) { excluidas.delete(n); c.classList.remove('excl'); }
      else { fixadas.add(n); c.classList.add('fixa'); }
    });
    box.appendChild(c);
  });
}

/* ================= Meus jogos ================= */
let meusJogos = []; // apostas da loteria ATUAL (usado para adicionar/salvar)
function jogosKey(k) { return 'lotomais-jogos-' + k; }
function loadMeusFor(k) { try { return JSON.parse(localStorage.getItem(jogosKey(k)) || '[]'); } catch (e) { return []; } }
function saveMeusFor(k, arr) { try { localStorage.setItem(jogosKey(k), JSON.stringify(arr)); } catch (e) {} }
function loadMeus() { return loadMeusFor(KEY); }
function saveMeus() { saveMeusFor(KEY, meusJogos); }
function addMeusGames(arr, nome, mes) {
  const now = Date.now(), alvo = DRAWS[N - 1][0] + 1, cart = 'c' + now;
  const novos = arr.map((nums, i) => { const g = { id: now + '-' + i + '-' + Math.random().toString(36).slice(2, 6), nums, created: now, alvo, cart, nome: nome || '' }; if (mes) g.mes = mes; return g; });
  novos.forEach(j => meusJogos.push(j));
  saveMeus(); renderMeus();
  enviarJogosNuvem(KEY, novos);
}
function deleteCart(k, cartKey) {
  const arr = loadMeusFor(k), ids = arr.filter(j => (j.cart || j.id) === cartKey).map(j => j.id);
  saveMeusFor(k, arr.filter(j => (j.cart || j.id) !== cartKey)); if (k === KEY) meusJogos = loadMeus(); renderMeus();
  removerJogosNuvem(ids);
}
function shareCart(k, cartKey) {
  const grp = loadMeusFor(k).filter(j => (j.cart || j.id) === cartKey);
  const nome = (grp[0] && grp[0].nome) || 'Meus jogos';
  shareWhatsApp(nome + ' — ' + LOTERIAS[k].nome, grp.map(j => j.nums));
}
function deleteGame(k, id) { saveMeusFor(k, loadMeusFor(k).filter(j => j.id !== id)); if (k === KEY) meusJogos = loadMeus(); renderMeus(); removerJogosNuvem([id]); }
function renameCart(k, cartKey) {
  const arr = loadMeusFor(k), cur = arr.find(j => (j.cart || j.id) === cartKey);
  const novo = prompt('Nome do carrinho:', (cur && cur.nome) || '');
  if (novo === null) return;
  const ids = [];
  arr.forEach(j => { if ((j.cart || j.id) === cartKey) { j.nome = novo.trim(); ids.push(j.id); } });
  saveMeusFor(k, arr); if (k === KEY) meusJogos = loadMeus(); renderMeus();
  renomearNuvem(ids, novo.trim());
}
// contexto de qualquer loteria (para exibir jogos de todas)
function lotCtx(k) {
  const draws = (window.LOTO_DB && window.LOTO_DB[k] ? window.LOTO_DB[k] : []).slice().sort((a, b) => a[0] - b[0]);
  const last = draws[draws.length - 1];
  return { k, cfg: LOTERIAS[k], draws, last, lastSet: new Set(last ? last[2] : []), prem: (window.LOTO_PREMIOS && window.LOTO_PREMIOS[k]) || null };
}
function histPerfCtx(nums, ctx) {
  const s = new Set(nums); let best = 0, wins = 0; const D = ctx.draws;
  for (let i = 0; i < D.length; i++) { let h = 0; const d = D[i][2]; for (let x = 0; x < d.length; x++) if (s.has(d[x])) h++; if (h > best) best = h; if (ctx.cfg.premios.includes(h)) wins++; }
  return { best, wins, total: D.length };
}
function renderMeus() {
  const filtro = $('meusFiltro') ? $('meusFiltro').value : '';
  const ordem = $('meusOrdem') ? $('meusOrdem').value : 'rec';
  const showLot = filtro === 'todas';
  const keys = filtro === 'todas' ? Object.keys(LOTERIAS) : [filtro || KEY];
  // agrupar por carrinho
  const groups = {};
  keys.forEach(k => {
    const ctx = lotCtx(k); if (!ctx.last) return;
    loadMeusFor(k).forEach(j => {
      const gid = k + '|' + (j.cart || j.id);
      (groups[gid] = groups[gid] || { gid, k, ctx, nome: j.nome || '', created: j.created, jogos: [] }).jogos.push(j);
    });
  });
  const arr = Object.values(groups);
  const totalJogos = arr.reduce((s, g) => s + g.jogos.length, 0);
  $('meusCount').textContent = totalJogos ? `${totalJogos} jogo(s) · ${arr.length} carrinho(s)` : '';
  if (!arr.length) { $('meusList').innerHTML = `<div class="note">Nenhuma aposta ${filtro === 'todas' ? 'salva ainda' : 'para esta loteria'}. Adicione acima, ou use o botão ⭐ nos jogos gerados.</div>`; return; }
  arr.forEach(g => {
    g.bestLast = 0; g.winLast = false;
    g.jogos.forEach(j => { const h = j.nums.filter(n => g.ctx.lastSet.has(n)).length; j._hits = h; if (h > g.bestLast) g.bestLast = h; if (g.ctx.cfg.premios.includes(h)) g.winLast = true; });
    let bh = 0, wc = 0; g.jogos.forEach(j => { const p = histPerfCtx(j.nums, g.ctx); if (p.best > bh) bh = p.best; wc += p.wins; });
    g.bestHist = bh; g.winsHist = wc;
  });
  arr.sort(ordem === 'best' ? (a, b) => b.bestHist - a.bestHist || b.created - a.created : (a, b) => b.created - a.created);
  $('meusList').innerHTML = arr.map(g => {
    const dt = new Date(g.created).toLocaleDateString('pt-BR');
    const titulo = g.nome ? g.nome : (g.jogos.length > 1 ? 'Bolão' : 'Jogo salvo');
    const alvoTxt = g.jogos[0].alvo ? ` · 🎯 #${g.jogos[0].alvo}` : '';
    const lotLabel = showLot ? `<span class="tagm" style="background:color-mix(in srgb,var(--violet) 14%,transparent);color:var(--violet);border-color:transparent;margin-bottom:8px;display:inline-block;">${g.ctx.cfg.nome}</span>` : '';
    const multi = g.jogos.length > 1;
    const jogosHtml = g.jogos.map((j, idx) => {
      const win = g.ctx.cfg.premios.includes(j._hits);
      const sep = multi && idx < g.jogos.length - 1 ? 'border-bottom:1px solid var(--line);padding-bottom:7px;margin-bottom:7px;' : 'margin-bottom:5px;';
      const num = multi ? `<span style="color:var(--muted);font-size:11px;font-weight:700;flex:none;min-width:14px;">${idx + 1}</span>` : '';
      const delG = multi ? `<button class="chip" data-delg="${g.k}|${j.id}" type="button" style="padding:2px 8px;font-size:11px;flex:none;" title="Excluir este jogo">✕</button>` : '';
      const mesOk = j.mes && g.ctx.last && g.ctx.last[3] === j.mes;
      const mesTag = j.mes ? `<span class="tagm" style="flex:none;${mesOk ? 'color:var(--green);border-color:transparent;background:color-mix(in srgb,var(--green) 16%,transparent);' : ''}" title="Mês da Sorte">🗓️ ${j.mes}${mesOk ? ' ✓' : ''}</span>` : '';
      return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;${sep}">${num}<div class="balls" style="flex:1;min-width:60%;">${j.nums.map(n => ball(n, g.ctx.lastSet.has(n) ? 'sm gold' : 'sm')).join('')}</div><span class="tagm" style="${win ? 'color:var(--green);border-color:transparent;background:color-mix(in srgb,var(--green) 16%,transparent);' : ''}">${j._hits}${win ? ' 🏆' : ''}</span>${mesTag}${delG}</div>`;
    }).join('');
    return `<div class="game">
      <div class="ghead"><span class="gtitle">${titulo} · ${g.jogos.length} jogo(s) · ${dt}${alvoTxt}</span><span style="display:flex;gap:6px;"><button class="chip" data-rename="${g.gid}" type="button" style="padding:4px 10px;" title="Renomear carrinho">✏️</button><button class="chip" data-wac="${g.gid}" type="button" style="padding:4px 10px;" title="Compartilhar no WhatsApp">📱</button><button class="chip" data-delc="${g.gid}" type="button" style="padding:4px 11px;" title="Excluir carrinho">✕</button></span></div>
      ${lotLabel}${jogosHtml}
      <div class="gmeta"><span class="tagm" style="${g.winLast ? 'background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green);border-color:transparent;' : ''}">#${g.ctx.last[0]}: melhor <b>${g.bestLast}</b>${g.winLast ? ' 🏆' : ''}</span><span class="tagm">histórico: melhor <b>${g.bestHist}</b> · premiou <b>${g.winsHist}×</b></span></div>
    </div>`;
  }).join('');
  $('meusList').querySelectorAll('[data-delc]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.delc.split('|'); deleteCart(p[0], p[1]); }));
  $('meusList').querySelectorAll('[data-wac]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.wac.split('|'); shareCart(p[0], p[1]); }));
  $('meusList').querySelectorAll('[data-rename]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.rename.split('|'); renameCart(p[0], p[1]); }));
  $('meusList').querySelectorAll('[data-delg]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.delg.split('|'); deleteGame(p[0], p[1]); }));
}
// Backup: exportar/importar todas as apostas
function exportBackup() {
  const data = {}; Object.keys(LOTERIAS).forEach(k => { const arr = loadMeusFor(k); if (arr.length) data[k] = arr; });
  const blob = new Blob([JSON.stringify({ app: 'loto+facil', v: 1, jogos: data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'loto-mais-facil-backup.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importBackup(ev) {
  const file = ev.target.files[0]; if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const jogos = (JSON.parse(rd.result) || {}).jogos || {}; let add = 0;
      Object.keys(jogos).forEach(k => {
        if (!LOTERIAS[k] || !Array.isArray(jogos[k])) return;
        const cur = loadMeusFor(k), ids = new Set(cur.map(j => j.id));
        jogos[k].forEach(j => { if (j && Array.isArray(j.nums) && !ids.has(j.id)) { cur.push(j); add++; } });
        saveMeusFor(k, cur);
      });
      meusJogos = loadMeus(); renderMeus(); enviarTudoNuvem();
      alert(add ? add + ' aposta(s) importada(s)!' : 'Nada novo para importar.');
    } catch (e) { alert('Arquivo de backup inválido.'); }
  };
  rd.readAsText(file); ev.target.value = '';
}

/* ================= Trocar de loteria ================= */
function buildLottery(key) {
  KEY = key; L = LOTERIAS[key];
  DRAWS = (window.LOTO_DB && window.LOTO_DB[key] ? window.LOTO_DB[key] : []).slice().sort((a, b) => a[0] - b[0]);
  N = DRAWS.length; K = L.sorteados;
  NUMS = Array.from({ length: L.total }, (_, i) => i + (L.min ?? 1));
  EVENS = NUMS.filter(n => n % 2 === 0).length;
  document.documentElement.style.setProperty('--violet', L.cor);
  document.documentElement.style.setProperty('--violet-2', L.cor2);
  premiosRef = (window.LOTO_PREMIOS && window.LOTO_PREMIOS[key]) || null;

  computeStats();

  // selects dinâmicos
  const qtdVals = []; for (let v = L.apostaMin; v <= L.apostaMax; v++) qtdVals.push(v);
  $('genQtd').innerHTML = options(qtdVals, K);
  $('labTopK').innerHTML = options(qtdVals, K);
  const garVals = L.premios.filter(p => p < K); garVals.push(K);
  $('fechGar').innerHTML = garVals.map(p => `<option value="${p}">${p === K ? 'Completo (todos os jogos)' : p + (L.total <= 25 ? ' pontos' : ' acertos')}</option>`).join('');
  const hottest = [...NUMS].sort((a, b) => freqAll[b] - freqAll[a])[0];
  $('evoSel').innerHTML = options(NUMS, hottest, pad);
  $('meusFiltro').innerHTML = `<option value="">Esta loteria (${L.nome})</option><option value="todas">Todas as loterias</option>` + Object.keys(LOTERIAS).map(k => `<option value="${k}">${LOTERIAS[k].nome}</option>`).join('');
  const mesOpts = MESES.map(m => `<option value="${m}">${m}</option>`).join('');
  $('conferirMes').innerHTML = mesOpts; $('meusMes').innerHTML = mesOpts;
  $('conferirMesWrap').style.display = L.mes ? '' : 'none';
  $('meusMesWrap').style.display = L.mes ? '' : 'none';

  // pickers
  buildPicker($('picker'), selConferir, () => L.apostaMax, conferirMsg);
  buildPicker($('meusPicker'), selMeus, () => L.apostaMax, meusMsg);
  buildPicker($('fechPicker'), selFech, () => L.fechMax, fechMsg);
  buildFixGrid();

  // fechamento (esconder onde não faz sentido, ex.: Lotomania)
  const fbtn = $('gerToggle').querySelector('[data-mode="fechamento"]');
  if (fbtn) fbtn.style.display = L.fechamento === false ? 'none' : '';
  $('gerToggle').querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === 0));
  $('genMode').style.display = ''; $('fechMode').style.display = 'none';

  // reset áreas de resultado
  ['genResults', 'checkResults', 'fechResult', 'labResult', 'mcResult'].forEach(id => $(id).innerHTML = '');
  labRuns = []; $('labCompareWrap').style.display = 'none';
  $('presetChips').querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  applyPreset('equilibrada');
  setLabWeights(LAB_PRESETS.equilibrado);

  meusJogos = loadMeus();
  renderPainel(); renderDezenas(); renderPadroes(); renderMeus();
  if (typeof aplicarGating === 'function') aplicarGating();
  window.scrollTo(0, 0);
}

/* ================= Laboratório ================= */
const COMPS = [['curta', 'Freq. curta (20)'], ['media', 'Freq. média (50)'], ['hist', 'Freq. histórica'], ['atraso', 'Atraso'], ['rep', 'Repetição'], ['afin', 'Afinidade'], ['tend', 'Tendência']];
const LAB_PRESETS = {
  equilibrado: { curta: 20, media: 15, hist: 15, atraso: 20, rep: 10, afin: 10, tend: 10 },
  frequencia: { curta: 30, media: 25, hist: 45, atraso: 0, rep: 0, afin: 0, tend: 0 },
  atraso: { curta: 10, media: 0, hist: 10, atraso: 80, rep: 0, afin: 0, tend: 0 },
  recencia: { curta: 40, media: 15, hist: 0, atraso: 5, rep: 0, afin: 0, tend: 40 },
};
$('weightBox').innerHTML = COMPS.map(([k, label]) => `<div class="wrow"><div class="wl"><span>${label}</span><span class="wp" id="wp-${k}">0%</span></div><input type="range" min="0" max="100" value="0" id="w-${k}"></div>`).join('');
function labWeights() { const w = {}; COMPS.forEach(([k]) => w[k] = parseInt($('w-' + k).value) || 0); return w; }
function refreshWeightLabels() { const w = labWeights(), sum = COMPS.reduce((s, [k]) => s + w[k], 0) || 1; COMPS.forEach(([k]) => $('wp-' + k).textContent = Math.round(w[k] / sum * 100) + '%'); $('wSum').textContent = 'distribuição relativa'; }
function setLabWeights(o) { COMPS.forEach(([k]) => $('w-' + k).value = o[k] ?? 0); refreshWeightLabels(); }
let labRuns = [];
function renderLabTable() {
  if (!labRuns.length) return;
  $('labCompareWrap').style.display = '';
  $('labTable').querySelector('tbody').innerHTML = labRuns.map(x => { const d = x.avg - x.exp; return `<tr><td><strong>${x.name}</strong></td><td>${x.avg.toFixed(2)}</td><td style="color:${Math.abs(d) < 0.15 ? 'var(--muted)' : (d > 0 ? 'var(--green)' : 'var(--red)')}">${d >= 0 ? '+' : ''}${d.toFixed(2)}</td><td>${x.hTop}</td><td>${x.hMid}</td><td>${x.hLow}</td></tr>`; }).join('');
}

/* ================= Eventos (uma vez) ================= */
$('lotSel').addEventListener('change', e => { buildLottery(e.target.value); try { localStorage.setItem('lotomais-loteria', e.target.value); } catch (x) {} });

$('dezTable').querySelectorAll('th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; dezSort.dir = dezSort.k === k ? -dezSort.dir : -1; dezSort.k = k; renderDezenas(); }));
$('janelaSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('janelaSeg').querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); janela = parseInt(b.dataset.j); renderDezenas(); }));
$('evoSel').addEventListener('change', renderEvo);

$('presetChips').querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { $('presetChips').querySelectorAll('.chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); applyPreset(c.dataset.preset); }));
$('genBtn').addEventListener('click', () => {
  const cfg = { qtd: parseInt($('genQtd').value), rep: $('fRep').checked, par: $('fPar').checked, soma: $('fSoma').checked, faixa: $('fFaixa').checked, score: $('fScore').checked };
  if (L.total - excluidas.size < cfg.qtd) { $('genResults').innerHTML = `<div class="note">Você excluiu dezenas demais — sobram ${L.total - excluidas.size}, mas o jogo precisa de ${cfg.qtd}.</div>`; return; }
  if (fixadas.size > cfg.qtd) { $('genResults').innerHTML = `<div class="note">Você fixou ${fixadas.size} dezenas, mas o jogo tem ${cfg.qtd}. Reduza as fixas ou aumente as dezenas por jogo.</div>`; return; }
  const count = Math.max(1, Math.min(isPro() ? 20 : 3, parseInt($('genCount').value) || 1));
  let html = ''; const out = [];
  for (let i = 0; i < count; i++) {
    const g = generateOne(cfg); out.push(g); const m = gameMeta(g);
    html += `<div class="game"><div class="ghead"><span class="gtitle">Jogo ${i + 1}</span><span class="tagm">Score médio <b>${m.avgScore.toFixed(0)}</b></span></div>
      <div class="balls">${g.map(n => ball(n, 'sm')).join('')}</div>
      <div class="gmeta"><span class="tagm">Soma <b>${m.soma}</b></span><span class="tagm">${m.pares}P / ${m.impares}I</span><span class="tagm">Repetiu <b>${m.rep}</b> do último</span><span class="tagm">Faixas ${m.fc.join('-')}</span></div></div>`;
  }
  $('genResults').innerHTML = html;
  $('genResults').appendChild(exportBar('Jogos gerados — ' + L.nome, out, KEY + '-jogos', true));
});

$('gerToggle').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('gerToggle').querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); const f = b.dataset.mode === 'fechamento'; $('genMode').style.display = f ? 'none' : ''; $('fechMode').style.display = f ? '' : 'none'; }));
$('surpresinha').addEventListener('click', () => renderOneGame(quickPick(L.apostaMin, null), '🎲 Surpresinha'));
$('dataBtn').addEventListener('click', () => { const d = ($('dataSorte').value || '').trim(); if (!d) { $('genResults').innerHTML = '<div class="note">Digite uma data (ex.: 15/03/1990).</div>'; return; } renderOneGame(quickPick(L.apostaMin, KEY + '|' + d), '🍀 Números de ' + d); });
$('fechBtn').addEventListener('click', () => {
  if (!isPro()) { $('fechResult').innerHTML = proNote('Fechamentos'); return; }
  if (selFech.size < K + 1) { $('fechResult').innerHTML = `<div class="note">Selecione de ${K + 1} a ${L.fechMax} dezenas.</div>`; return; }
  const pool = [...selFech].sort((a, b) => a - b), P = parseInt($('fechGar').value), price = parseFloat($('fechPrice').value) || 0;
  if (P < K) { const m = pool.length, maxDiff = K - P; let cov = 0; for (let d = 0; d <= maxDiff; d++) cov += binom(K, d) * binom(m - K, d);
    if (binom(m, K) * cov > 3e7) { $('fechResult').innerHTML = `<div class="note">Esse fechamento é pesado demais para o navegador. Tente um <b>bolão menor</b> ou uma <b>garantia maior</b>.</div>`; return; } }
  $('fechResult').innerHTML = `<div class="note">Calculando o fechamento…</div>`;
  setTimeout(() => {
    const r = fechamento(pool, P), gamesNums = r.games.map(pos => pos.map(p => pool[p]).sort((a, b) => a - b));
    const allW = combosIdx(pool.length, K).map(maskOf), ok = P >= K ? true : verifyGuarantee(r.games.map(maskOf), allW, P);
    const unidade = L.total <= 25 ? 'pontos' : 'acertos';
    const gar = P >= K ? `Fecha <b>todos</b> os jogos possíveis do bolão.` : `Se as ${K} sorteadas estiverem entre as suas ${pool.length} dezenas, garante pelo menos <b>${P} ${unidade}</b> em algum jogo ${ok ? '✅' : '⚠️'}.`;
    const cap = 120, shown = gamesNums.slice(0, cap);
    let list = shown.map((g, i) => `<div class="game" style="padding:10px 12px;margin-bottom:8px;"><div class="ghead" style="margin-bottom:8px;"><span class="gtitle" style="font-size:13px;">Jogo ${i + 1}</span></div><div class="balls">${g.map(n => ball(n, 'sm')).join('')}</div></div>`).join('');
    if (gamesNums.length > cap) list += `<div class="note">Mostrando os primeiros ${cap} de ${gamesNums.length} jogos.</div>`;
    $('fechResult').innerHTML = `<div class="card" style="margin-top:6px;">
      <div class="bignum"><span class="b">${gamesNums.length}</span><span class="bd">jogos<br>bolão de ${pool.length} dezenas</span></div>
      <div class="result-line"><span class="k">Garantia</span><span class="v" style="text-align:right;max-width:60%;">${gar}</span></div>
      <div class="result-line"><span class="k">Custo estimado</span><span class="v">${brl(gamesNums.length * price)}</span></div>
      <div class="result-line"><span class="k">Bolão</span><span class="v">${pool.map(pad).join(' ')}</span></div></div>`;
    // barra de ações (salvar como carrinho, compartilhar, exportar) logo após o resumo
    $('fechResult').appendChild(exportBar('Fechamento — ' + L.nome, gamesNums, KEY + '-fechamento'));
    const listWrap = document.createElement('div'); listWrap.style.marginTop = '12px'; listWrap.innerHTML = list;
    $('fechResult').appendChild(listWrap);
  }, 30);
});

// Lab
COMPS.forEach(([k]) => $('w-' + k).addEventListener('input', () => { refreshWeightLabels(); $('labPresets').querySelectorAll('.chip').forEach(c => c.classList.remove('on')); }));
$('labPresets').querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { $('labPresets').querySelectorAll('.chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); setLabWeights(LAB_PRESETS[c.dataset.lp]); }));
$('labRun').addEventListener('click', () => {
  const w = labWeights(); if (COMPS.reduce((s, [k]) => s + w[k], 0) === 0) { $('labResult').innerHTML = `<div class="note">Ajuste ao menos um peso acima de zero.</div>`; return; }
  const topK = parseInt($('labTopK').value), range = parseInt($('labRange').value);
  $('labResult').innerHTML = `<div class="note">Rodando backtest…</div>`;
  setTimeout(() => {
    const r = runBacktest(w, topK, range), exp = topK * K / L.total, diff = r.avg - exp;
    let grid = ''; L.premios.forEach(h => grid += `<div class="hitbox"><div class="hn">${r.hits[h] || 0}</div><div class="hl">${h} acertos<br>${((r.hits[h] || 0) / r.tests * 100).toFixed(2)}%</div></div>`);
    $('labResult').innerHTML = `<div class="card">
      <div class="bignum"><span class="b">${r.avg.toFixed(2)}</span><span class="bd">acertos em média<br>por jogo de ${topK} dezenas</span></div>
      <div class="result-line"><span class="k">Esperado pelo acaso</span><span class="v">${exp.toFixed(2)} <span style="color:${Math.abs(diff) < 0.15 ? 'var(--muted)' : (diff > 0 ? 'var(--green)' : 'var(--red)')}">(${diff >= 0 ? '+' : ''}${diff.toFixed(2)})</span></span></div>
      <div class="result-line"><span class="k">Melhor jogo do teste</span><span class="v">${r.maxHit} acertos</span></div>
      <div class="result-line"><span class="k">Concursos testados</span><span class="v">${r.tests}</span></div>
      <h3 style="margin:14px 0 4px;font-size:14px;">Quantas vezes teria feito</h3><div class="hitgrid">${grid}</div>
      <button class="btn sec" id="labSave" style="margin-top:14px;">Salvar para comparar</button></div>`;
    const on = $('labPresets').querySelector('.chip.on');
    $('labSave').addEventListener('click', () => { const P = L.premios; labRuns.push({ name: on ? on.textContent.trim() : 'Personalizada', avg: r.avg, exp, hTop: r.hits[P[0]] || 0, hMid: r.hits[P[1]] || 0, hLow: r.hits[P[2] ?? P[1]] || 0 }); renderLabTable(); });
  }, 30);
});
$('mcRun').addEventListener('click', () => {
  const X = Math.max(1, Math.min(200, parseInt($('mcGames').value) || 1)), T = parseInt($('mcTrials').value);
  $('mcResult').innerHTML = `<div class="note">Simulando ${T.toLocaleString('pt-BR')} concursos…</div>`;
  setTimeout(() => {
    const betSize = L.apostaMin;
    const games = Array.from({ length: X }, () => new Set(randomPick(betSize))), bestTier = Array(K + 1).fill(0); let sumBest = 0;
    for (let t = 0; t < T; t++) { const W = randomPick(K); let best = 0; for (const gs of games) { let h = 0; for (const n of W) if (gs.has(n)) h++; if (h > best) best = h; } bestTier[best]++; sumBest += best; }
    const atLeast = h => { let c = 0; for (let k = h; k <= K; k++) c += bestTier[k]; return c; };
    const pct = v => { const p = v / T * 100; return p >= 1 ? p.toFixed(1) + '%' : p >= 0.01 ? p.toFixed(2) + '%' : p > 0 ? p.toFixed(3) + '%' : '~0%'; };
    const oneIn = h => { const p = atLeast(h) / T; return p > 0 ? '1 em ' + Math.round(1 / p).toLocaleString('pt-BR') : '—'; };
    let grid = ''; L.premios.filter(h => h > 0).forEach(h => grid += `<div class="hitbox"><div class="hn" style="font-size:17px;">${pct(atLeast(h))}</div><div class="hl">≥ ${h} acertos<br>${oneIn(h)}</div></div>`);
    $('mcResult').innerHTML = `<div class="card" style="margin-top:6px;">
      <div class="bignum"><span class="b">${(sumBest / T).toFixed(2)}</span><span class="bd">acertos no melhor jogo,<br>em média, jogando ${X} por concurso</span></div>
      <h3 style="margin:12px 0 4px;font-size:14px;">Chance de pelo menos um prêmio</h3><div class="hitgrid">${grid}</div>
      <p style="font-size:12px;color:var(--muted);margin:12px 0 0;">Jogar mais jogos aumenta a chance na mesma proporção do custo. As probabilidades <b>não dependem de quais dezenas</b> você escolhe.</p></div>`;
  }, 30);
});

// Conferir
$('checkBtn').addEventListener('click', () => {
  if (selConferir.size < L.apostaMin) { $('checkResults').innerHTML = `<div class="note">Selecione ao menos ${L.apostaMin} dezenas.</div>`; return; }
  const chosen = new Set(selConferir), hits = Array(K + 1).fill(0); let best = 0, bestDraw = null;
  DRAWS.forEach(d => { const h = d[2].filter(n => chosen.has(n)).length; hits[h]++; if (h > best) { best = h; bestDraw = d; } });
  const last = DRAWS[N - 1], lastHits = last[2].filter(n => chosen.has(n)).length;
  const arr = [...chosen].sort((a, b) => a - b), soma = arr.reduce((a, b) => a + b, 0), pares = arr.filter(n => n % 2 === 0).length;
  let grid = ''; L.premios.forEach(h => { const pr = premioDe(h); grid += `<div class="hitbox"><div class="hn">${hits[h] || 0}</div><div class="hl">${h} acertos<br>${((hits[h] || 0) / N * 100).toFixed(2)}%${pr && pr[1] > 0 ? '<br><span style="color:var(--green);font-weight:700;">~' + moneyShort(pr[0]) + '</span>' : ''}</div></div>`; });
  const lp = premioDe(lastHits);
  // Mês da Sorte (Dia de Sorte)
  let mesLinhas = '';
  if (L.mes) {
    const mes = $('conferirMes').value;
    const mesAcertos = DRAWS.reduce((c, d) => c + (d[3] === mes ? 1 : 0), 0);
    const lastMesOk = last[3] === mes;
    mesLinhas = `<div class="result-line"><span class="k">🗓️ Mês da Sorte (${mes})</span><span class="v">acertou em ${mesAcertos} de ${N} (${(mesAcertos / N * 100).toFixed(1)}%)</span></div>
      <div class="result-line"><span class="k">Mês no último concurso</span><span class="v" style="${lastMesOk ? 'color:var(--green);' : ''}">${last[3]}${lastMesOk ? ' ✓ acertou!' : ' — não acertou'}</span></div>`;
  }
  $('checkResults').innerHTML = `<div class="card">
    <div class="result-line"><span class="k">Dezenas</span><span class="v">${arr.map(pad).join(' ')}</span></div>
    <div class="result-line"><span class="k">Soma / Pares</span><span class="v">${soma} · ${pares}P/${arr.length - pares}I</span></div>
    <div class="result-line"><span class="k">No último concurso (#${last[0]})</span><span class="v">${lastHits} acertos${lp && lp[1] > 0 ? ' · pagaria ~' + moneyShort(lp[0]) : ''}</span></div>
    ${mesLinhas}
    <div class="result-line"><span class="k">Melhor da história</span><span class="v">${best} acertos · #${bestDraw[0]} (${bestDraw[1]})</span></div>
    <h3 style="margin:14px 0 4px;font-size:14px;">Distribuição em ${N} concursos</h3><div class="hitgrid">${grid}</div></div>`;
});
$('clearBtn').addEventListener('click', () => { selConferir.clear(); $('picker').querySelectorAll('.pcell').forEach(c => c.classList.remove('sel')); conferirMsg(); $('checkResults').innerHTML = ''; });

// Meus jogos
$('meusClear').addEventListener('click', () => { selMeus.clear(); $('meusPicker').querySelectorAll('.pcell').forEach(c => c.classList.remove('sel')); meusMsg(); });
$('meusAdd').addEventListener('click', () => { if (selMeus.size < L.apostaMin || selMeus.size > L.apostaMax) { $('meusPickMsg').textContent = `Escolha de ${L.apostaMin} a ${L.apostaMax} dezenas.`; return; } addMeusGames([[...selMeus].sort((a, b) => a - b)], '', L.mes ? $('meusMes').value : undefined); selMeus.clear(); $('meusPicker').querySelectorAll('.pcell').forEach(c => c.classList.remove('sel')); meusMsg(); });
$('meusFiltro').addEventListener('change', renderMeus);
$('meusOrdem').addEventListener('change', renderMeus);
$('meusExport').addEventListener('click', exportBackup);
$('meusImport').addEventListener('click', () => $('meusImportFile').click());
$('meusImportFile').addEventListener('change', importBackup);

// Buscar concurso
function buscarConcurso() {
  const q = ($('buscaConc').value || '').trim();
  if (!q) { $('buscaResult').innerHTML = ''; return; }
  const porData = q.includes('/');
  const found = porData ? DRAWS.filter(d => d[1].includes(q)) : DRAWS.filter(d => d[0] === parseInt(q));
  if (!found.length) { $('buscaResult').innerHTML = `<div class="note">${porData ? 'Nenhum concurso na data "' + q + '"' : 'Concurso #' + q + ' não encontrado'}. A base vai de #${DRAWS[0][0]} (${DRAWS[0][1]}) a #${DRAWS[N - 1][0]} (${DRAWS[N - 1][1]}).</div>`; return; }
  if (found.length > 12) { $('buscaResult').innerHTML = `<div class="note">${found.length} concursos encontrados — refine a data (ex.: 27/07/2026).</div>`; return; }
  $('buscaResult').innerHTML = found.map((d, i) =>
    `<div style="margin-bottom:${found.length > 1 ? 10 : 0}px;"><p class="sub" style="margin:0 0 6px;">Concurso #${d[0]} · ${d[1]}${found.length > 1 ? ' · ' + (i + 1) + 'º sorteio' : ''}</p><div class="balls">${d[2].map(x => ball(x, 'sm')).join('')}</div>${L.mes && d[3] ? `<div style="margin-top:8px;font-size:13px;color:var(--ink-soft);">🗓️ Mês da Sorte: <b>${d[3]}</b></div>` : ''}</div>`
  ).join('');
}
$('buscaBtn').addEventListener('click', buscarConcurso);
$('buscaConc').addEventListener('keydown', e => { if (e.key === 'Enter') buscarConcurso(); });

// Aviso de nova versão do app (service worker)
function showUpdateBanner() {
  if (document.getElementById('updToast')) return;
  const t = document.createElement('div'); t.id = 'updToast';
  t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(80px + env(safe-area-inset-bottom));z-index:300;background:var(--ink);color:var(--bg);padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 10px 34px rgba(0,0,0,.35);display:flex;align-items:center;gap:12px;';
  t.append('🔄 Nova versão disponível');
  const b = document.createElement('button'); b.textContent = 'Atualizar';
  b.style.cssText = 'background:var(--violet);color:#fff;border:none;border-radius:8px;padding:6px 13px;font-weight:700;cursor:pointer;font-family:inherit;';
  b.onclick = () => location.reload(); t.appendChild(b);
  document.body.appendChild(t);
}

// Abas
$('tabbar').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
  $('tabbar').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active'); $('tab-' + btn.dataset.tab).classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' });
}));

// Glossário / ajuda
function openHelp() { $('helpModal').style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closeHelp() { $('helpModal').style.display = 'none'; document.body.style.overflow = ''; }
$('helpBtn').addEventListener('click', openHelp);
$('helpClose').addEventListener('click', closeHelp);
$('helpModal').addEventListener('click', e => { if (e.target === $('helpModal')) closeHelp(); });
document.querySelectorAll('.openHelp').forEach(b => b.addEventListener('click', openHelp));

// Balãozinho de explicação por item (data-tip)
let curTip = null, curTrig = null;
function closeTip() { if (curTip) { curTip.remove(); curTip = null; } if (curTrig) { curTrig.classList.remove('on'); curTrig = null; } }
function showTip(el) {
  closeTip();
  const txt = el.getAttribute('data-tip'); if (!txt) return;
  const pop = document.createElement('div'); pop.className = 'tip-pop'; pop.innerHTML = txt;
  pop.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(pop);
  const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(r.left + window.scrollX, window.scrollX + vw - pw - 10);
  left = Math.max(window.scrollX + 8, left);
  let top = r.bottom + window.scrollY + 9;
  if (r.bottom + ph + 16 > window.innerHeight && r.top - ph - 12 > 0) { top = r.top + window.scrollY - ph - 9; pop.classList.add('above'); }
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  const arrow = (r.left + window.scrollX + r.width / 2) - left - 6;
  pop.style.setProperty('--arrow', Math.max(10, Math.min(pw - 22, arrow)) + 'px');
  curTip = pop; curTrig = el; el.classList.add('on');
}
document.querySelectorAll('[data-tip]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); if (curTrig === el) closeTip(); else showTip(el); }));
document.addEventListener('click', closeTip);
window.addEventListener('scroll', closeTip, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeHelp(); closeTip(); closeAbout(); } });

// Instalar app (PWA)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; showInstallBanner(); });
function showInstallBanner() {
  if (!deferredPrompt || matchMedia('(display-mode: standalone)').matches) return;
  $('installBox').innerHTML = `<div class="banner"><span class="bi">📲</span><span class="bt" style="flex:1;">Instale o <b>Loto+Facil</b> no celular — abre rápido e funciona offline.</span><button class="btn" id="installGo" style="width:auto;padding:8px 15px;flex:none;">Instalar</button><button class="bx" id="installNo" title="Agora não">✕</button></div>`;
  $('installGo').addEventListener('click', doInstall);
  $('installNo').addEventListener('click', () => { $('installBox').innerHTML = ''; });
}
async function doInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { await deferredPrompt.userChoice; } catch (e) {}
  deferredPrompt = null; $('installBox').innerHTML = '';
}
window.addEventListener('appinstalled', () => { deferredPrompt = null; $('installBox').innerHTML = ''; });

// Modal Sobre
function openAbout() { $('aboutModal').style.display = 'flex'; document.body.style.overflow = 'hidden'; const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); $('iosHint').style.display = (ios && !deferredPrompt) ? '' : 'none'; }
function closeAbout() { $('aboutModal').style.display = 'none'; document.body.style.overflow = ''; }
$('aboutBtn').addEventListener('click', openAbout);
$('aboutClose').addEventListener('click', closeAbout);
$('aboutModal').addEventListener('click', e => { if (e.target === $('aboutModal')) closeAbout(); });
$('installBtn2').addEventListener('click', () => { if (deferredPrompt) doInstall(); else $('iosHint').style.display = ''; });
$('shareApp').addEventListener('click', () => window.open('https://wa.me/?text=' + encodeURIComponent('🍀 Loto+Facil — análise e gerador de jogos das loterias da Caixa:\n' + APP_URL), '_blank'));
$('copyLink').addEventListener('click', e => { if (navigator.clipboard) navigator.clipboard.writeText(APP_URL).then(() => { e.target.textContent = '✓ Copiado'; setTimeout(() => e.target.textContent = '🔗 Copiar link', 1500); }).catch(() => {}); });

// Tema
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('lotomais-theme', t); } catch (e) {} }
(function () { let t; try { t = localStorage.getItem('lotomais-theme'); } catch (e) {} if (t) applyTheme(t); })();
$('themeBtn').addEventListener('click', () => { const cur = document.documentElement.getAttribute('data-theme'); const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; applyTheme(dark ? 'light' : 'dark'); });

/* ================= Contas (Supabase) ================= */
const SB = (window.LOTO_CFG && window.LOTO_CFG.SUPABASE_URL && window.supabase)
  ? window.supabase.createClient(window.LOTO_CFG.SUPABASE_URL, window.LOTO_CFG.SUPABASE_ANON_KEY)
  : null;
let usuario = null, perfil = null, modoCadastro = false;
function isPro() { return !!(perfil && perfil.plano === 'pro' && (!perfil.pro_ate || new Date(perfil.pro_ate) > new Date())); }
function nomeUsuario() { return (perfil && perfil.nome) || (usuario && usuario.email) || ''; }

async function carregarPerfil() {
  if (!SB || !usuario) { perfil = null; return; }
  try { const { data } = await SB.from('perfis').select('nome,plano,pro_ate').eq('id', usuario.id).single(); perfil = data || { nome: '', plano: 'free' }; }
  catch (e) { perfil = { nome: '', plano: 'free' }; }
}
function atualizarContaBtn() {
  const b = $('contaBtn'); if (!b) return;
  if (usuario) { b.textContent = (nomeUsuario()[0] || '?').toUpperCase(); b.style.background = 'var(--violet)'; b.style.color = '#fff'; }
  else { b.textContent = '👤'; b.style.background = ''; b.style.color = ''; }
}
function traduzErro(m) {
  m = (m || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been')) return 'Este email já tem conta. Faça login.';
  if (m.includes('at least 6') || (m.includes('password') && m.includes('6'))) return 'A senha precisa de pelo menos 6 caracteres.';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Email inválido.';
  return m || 'Erro. Tente de novo.';
}
function renderContaBody() {
  const body = $('contaBody'); if (!body) return;
  if (!SB) { body.innerHTML = `<div class="note">As contas ainda não estão configuradas.</div>`; return; }
  if (usuario) {
    const nome = nomeUsuario(), pro = isPro(), ini = (nome[0] || '?').toUpperCase();
    body.innerHTML = `<div style="text-align:center;padding:12px 0;">
        <div style="width:60px;height:60px;border-radius:50%;background:var(--violet);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;margin:0 auto 10px;">${ini}</div>
        <div style="font-weight:800;font-size:17px;">${nome}</div>
        <div class="sub" style="margin:2px 0 0;">${usuario.email}</div>
        <div style="margin-top:12px;"><span class="tagm" style="border-color:transparent;font-size:13px;padding:5px 14px;${pro ? 'background:color-mix(in srgb,var(--gold) 22%,transparent);color:var(--amber);' : ''}">${pro ? '⭐ Plano Pro' : 'Plano Grátis'}</span></div>
      </div>
      ${pro ? '' : `<div class="note" style="margin-top:6px;">No <b>Pro</b> você libera: fechamentos, gerar muitos jogos de uma vez e sincronizar seus jogos na nuvem.</div><button class="btn" id="btnUpgrade" style="margin-top:12px;">⭐ Assinar Pro</button>`}
      <button class="btn sec" id="btnSair" style="margin-top:10px;">Sair</button>`;
    $('btnSair').addEventListener('click', sair);
    if ($('btnUpgrade')) $('btnUpgrade').addEventListener('click', assinarPro);
  } else {
    body.innerHTML = `<p class="sub" style="margin:10px 0 14px;">${modoCadastro ? 'Crie sua conta para salvar e sincronizar seus jogos entre aparelhos.' : 'Entre para acessar seus jogos em qualquer aparelho.'}</p>
      ${modoCadastro ? `<label class="field">Nome<input type="text" id="acNome" autocomplete="name"></label>` : ''}
      <label class="field">Email<input type="email" id="acEmail" autocomplete="email"></label>
      <label class="field">Senha<input type="password" id="acSenha" autocomplete="${modoCadastro ? 'new-password' : 'current-password'}"></label>
      <div id="acErro" class="note" style="border-color:var(--red);color:var(--red);display:none;margin-bottom:10px;"></div>
      <button class="btn" id="acSubmit">${modoCadastro ? 'Cadastrar' : 'Entrar'}</button>
      <p class="sub" style="text-align:center;margin-top:14px;">${modoCadastro ? 'Já tem conta?' : 'Não tem conta?'} <button id="acToggle" type="button" style="background:none;border:none;color:var(--violet);font-weight:700;cursor:pointer;font-family:inherit;">${modoCadastro ? 'Entrar' : 'Criar conta'}</button></p>`;
    $('acToggle').addEventListener('click', () => { modoCadastro = !modoCadastro; renderContaBody(); });
    $('acSubmit').addEventListener('click', submitAuth);
    $('acSenha').addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
  }
}
async function submitAuth() {
  const email = ($('acEmail').value || '').trim(), senha = $('acSenha').value, erro = $('acErro');
  erro.style.display = 'none';
  if (!email || !senha) { erro.textContent = 'Preencha email e senha.'; erro.style.color = 'var(--red)'; erro.style.borderColor = 'var(--red)'; erro.style.display = ''; return; }
  const btn = $('acSubmit'), txt = btn.textContent; btn.disabled = true; btn.textContent = 'Aguarde…';
  try {
    if (modoCadastro) {
      const { data, error } = await SB.auth.signUp({ email, password: senha, options: { data: { nome: ($('acNome').value || '').trim() } } });
      if (error) throw error;
      if (!data.session) { erro.style.color = 'var(--ink-soft)'; erro.style.borderColor = 'var(--line)'; erro.textContent = 'Conta criada! Confirme pelo email e depois entre.'; erro.style.display = ''; btn.disabled = false; btn.textContent = txt; return; }
    } else {
      const { error } = await SB.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
    }
    closeConta();
  } catch (e) { erro.textContent = traduzErro(e.message); erro.style.color = 'var(--red)'; erro.style.borderColor = 'var(--red)'; erro.style.display = ''; btn.disabled = false; btn.textContent = txt; }
}
async function sair() { if (SB) await SB.auth.signOut(); closeConta(); }
async function assinarPro() {
  if (!SB || !usuario) { openConta(); return; }
  const btn = $('btnUpgrade'); if (btn) { btn.disabled = true; btn.textContent = 'Gerando pagamento…'; }
  try {
    const { data, error } = await SB.functions.invoke('criar-pagamento');
    const link = data && (data.init_point || data.sandbox);
    if (error || !link) throw (error || new Error('sem link'));
    window.location.href = link;
  } catch (e) {
    alert('Não consegui iniciar o pagamento agora. Tente de novo em instantes.');
    if (btn) { btn.disabled = false; btn.textContent = '⭐ Assinar Pro'; }
  }
}
async function checarRetornoPagamento() {
  const pro = new URLSearchParams(location.search).get('pro');
  if (!pro) return;
  history.replaceState(null, '', location.pathname);
  if (pro === 'ok') {
    for (let i = 0; i < 8 && !isPro(); i++) { await carregarPerfil(); if (isPro()) break; await new Promise(r => setTimeout(r, 2000)); }
    atualizarContaBtn(); aplicarGating();
    if (isPro()) { await puxarJogosNuvem(); renderMeus(); alert('🎉 Pagamento confirmado! Seu Pro está ativo.'); }
    else alert('Recebemos seu pagamento — pode levar alguns instantes para liberar o Pro. Recarregue em breve.');
  } else if (pro === 'falhou') alert('O pagamento não foi concluído. Tente novamente quando quiser.');
}
function openConta() { renderContaBody(); $('contaModal').style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closeConta() { $('contaModal').style.display = 'none'; document.body.style.overflow = ''; }
window.abrirConta = openConta;
$('contaBtn').addEventListener('click', openConta);
$('contaClose').addEventListener('click', closeConta);
$('contaModal').addEventListener('click', e => { if (e.target === $('contaModal')) closeConta(); });

/* --------- Gating do Pro --------- */
function proNote(recurso) { return `<div class="note" style="border-color:var(--gold);"><b>🔒 ${recurso} é um recurso Pro.</b><br>Entre na sua conta e assine o Pro para liberar. <button class="chip" type="button" onclick="abrirConta()" style="margin-top:8px;">Ver plano Pro</button></div>`; }
function aplicarGating() {
  const pro = isPro(), gc = $('genCount');
  if (gc) { gc.max = pro ? 20 : 3; if (!pro && (parseInt(gc.value) || 1) > 3) gc.value = 3; }
  const ft = $('gerToggle') && $('gerToggle').querySelector('[data-mode="fechamento"]');
  if (ft && typeof L !== 'undefined') ft.textContent = (!pro && L.fechamento !== false) ? 'Fechamento 🔒' : 'Fechamento';
}

/* --------- Sincronização dos jogos (Pro) --------- */
async function puxarJogosNuvem() {
  if (!SB || !usuario || !isPro()) return;
  try {
    const { data } = await SB.from('jogos').select('*').eq('user_id', usuario.id);
    if (!data) return;
    const porLot = {};
    data.forEach(r => { const o = { id: r.id, nums: r.nums, nome: r.nome || '', cart: r.cart, alvo: r.alvo, created: Number(r.created) }; if (r.mes) o.mes = r.mes; (porLot[r.loteria] = porLot[r.loteria] || []).push(o); });
    Object.keys(porLot).forEach(k => {
      if (!LOTERIAS[k]) return;
      const local = loadMeusFor(k), ids = new Set(local.map(j => j.id));
      porLot[k].forEach(j => { if (!ids.has(j.id)) local.push(j); });
      saveMeusFor(k, local);
    });
    meusJogos = loadMeus();
  } catch (e) {}
}
async function enviarJogosNuvem(k, jogos) {
  if (!SB || !usuario || !isPro() || !jogos.length) return;
  const rows = jogos.map(j => { const r = { id: j.id, user_id: usuario.id, loteria: k, nums: j.nums, nome: j.nome || '', cart: j.cart, alvo: j.alvo, created: j.created }; if (j.mes) r.mes = j.mes; return r; });
  try { await SB.from('jogos').upsert(rows); } catch (e) {}
}
async function removerJogosNuvem(ids) { if (!SB || !usuario || !isPro() || !ids.length) return; try { await SB.from('jogos').delete().in('id', ids); } catch (e) {} }
async function enviarTudoNuvem() { if (!isPro()) return; for (const k of Object.keys(LOTERIAS)) { const arr = loadMeusFor(k); if (arr.length) await enviarJogosNuvem(k, arr); } }
async function renomearNuvem(ids, nome) { if (!SB || !usuario || !isPro() || !ids.length) return; try { await SB.from('jogos').update({ nome }).in('id', ids); } catch (e) {} }

async function initAuth() {
  if (!SB) { atualizarContaBtn(); return; }
  const { data } = await SB.auth.getSession();
  usuario = data.session ? data.session.user : null;
  if (usuario) await carregarPerfil();
  atualizarContaBtn(); aplicarGating();
  if (usuario && isPro()) await puxarJogosNuvem();
  renderMeus();
  if (usuario) checarRetornoPagamento();
  SB.auth.onAuthStateChange(async (_ev, session) => {
    const antes = usuario && usuario.id;
    usuario = session ? session.user : null;
    await carregarPerfil();
    atualizarContaBtn(); aplicarGating();
    if (usuario && isPro()) await puxarJogosNuvem();
    renderMeus();
    if ($('contaModal').style.display === 'flex') renderContaBody();
  });
}

/* ================= Init ================= */
(function init() {
  let key = 'lotofacil'; try { const k = localStorage.getItem('lotomais-loteria'); if (k && LOTERIAS[k]) key = k; } catch (e) {}
  $('lotSel').value = key;
  buildLottery(key);
  initAuth();
})();

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBanner(); });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
