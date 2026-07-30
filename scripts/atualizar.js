#!/usr/bin/env node
/* Atualiza as bases das loterias com os concursos novos.
   Uso: node scripts/atualizar.js [loteria...]   (sem argumento = todas)
   Sem dependências — usa o fetch nativo do Node 18+. */
'use strict';
const fs = require('fs');
const path = require('path');

const LOTERIAS = ['lotofacil', 'megasena', 'quina', 'lotomania', 'duplasena', 'diadesorte'];
const alvos = process.argv.slice(2).length ? process.argv.slice(2) : LOTERIAS;
const DADOS = path.join(__dirname, '..', 'dados');

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Loto+Facil' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
function entriesFrom(key, j) {
  const c = j.concurso || j.numero, dt = j.data || j.dataApuracao;
  const dez = (j.dezenas || j.listaDezenas || []).map(Number);
  if (key === 'duplasena' && dez.length === 12)
    return [[c, dt, dez.slice(0, 6).sort((a, b) => a - b)], [c, dt, dez.slice(6, 12).sort((a, b) => a - b)]];
  return [[c, dt, dez.slice().sort((a, b) => a - b)]];
}
function premiosFrom(j) {
  const premios = {};
  (j.premiacoes || []).forEach(p => {
    const h = parseInt(p.descricao != null ? p.descricao : p.faixa);
    if (isNaN(h)) return;
    const v = p.valorPremio || 0, g = p.ganhadores || 0;
    if (!premios[h] || v > premios[h][0]) premios[h] = [v, g];
  });
  return { concurso: j.concurso || j.numero, data: j.data || j.dataApuracao, premios };
}
async function latestNumber(key) {
  const API = 'https://loteriascaixa-api.herokuapp.com/api/' + key;
  const CAIXA = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/' + key;
  try { return (await getJSON(API + '/latest')).concurso; }
  catch (e) { const j = await getJSON(CAIXA); return j.numero || j.concurso; }
}
async function fetchRaw(key, n) {
  const API = 'https://loteriascaixa-api.herokuapp.com/api/' + key;
  const CAIXA = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/' + key;
  try { return await getJSON(API + '/' + n); }
  catch (e) { return await getJSON(CAIXA + '/' + n); }
}

async function atualizar(key) {
  const file = path.join(DADOS, key + '.js');
  if (!fs.existsSync(file)) { console.log('[' + key + '] arquivo não existe, pulei (use semear.js).'); return; }
  const content = fs.readFileSync(file, 'utf8');
  const m = content.match(/window\.LOTO_DB\[["']?\w+["']?\]\s*=\s*(\[[\s\S]*\]);/);
  if (!m) { console.log('[' + key + '] formato inesperado, pulei.'); return; }
  const draws = JSON.parse(m[1]);
  const maxLocal = Math.max(...draws.map(d => d[0]));

  let latest;
  try { latest = await latestNumber(key); }
  catch (e) { console.log('[' + key + '] API indisponível: ' + e.message); return; }
  if (latest <= maxLocal) { console.log('[' + key + '] atualizado (#' + maxLocal + ').'); return; }

  const added = [];
  let lastJson = null;
  for (let n = maxLocal + 1; n <= latest; n++) {
    try {
      const j = await fetchRaw(key, n);
      const entries = entriesFrom(key, j);
      if (!entries[0][0] || !entries[0][2].length) { console.log('[' + key + '] #' + n + ' inválido, parando.'); break; }
      entries.forEach(e => draws.push(e)); added.push(n); lastJson = j;
    } catch (e) { console.log('[' + key + '] falha no #' + n + ': ' + e.message); break; }
  }
  if (!added.length) return;
  draws.sort((a, b) => a[0] - b[0]);
  const prem = premiosFrom(lastJson);
  const header = '// Base ' + key + ' — atualização automática. Formato: [concurso, "dd/mm/aaaa", [dezenas]]';
  fs.writeFileSync(file,
    header + '\n' +
    'window.LOTO_DB=window.LOTO_DB||{};window.LOTO_DB["' + key + '"]=' + JSON.stringify(draws) + ';\n' +
    'window.LOTO_PREMIOS=window.LOTO_PREMIOS||{};window.LOTO_PREMIOS["' + key + '"]=' + JSON.stringify(prem) + ';\n', 'utf8');
  console.log('[' + key + '] +' + added.length + ' concurso(s). Total: ' + draws.length + ' (#' + draws[draws.length - 1][0] + ')');
}

(async () => { for (const key of alvos) await atualizar(key); })();
