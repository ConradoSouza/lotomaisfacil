#!/usr/bin/env node
/* Semeia a base de uma loteria baixando TODO o histórico de uma vez.
   Uso: node scripts/semear.js <loteria>   (ex.: megasena, quina, lotofacil) */
'use strict';
const fs = require('fs');
const path = require('path');

const key = process.argv[2];
if (!key) { console.error('Uso: node scripts/semear.js <loteria>'); process.exit(1); }
const API = 'https://loteriascaixa-api.herokuapp.com/api/' + key;

(async () => {
  const r = await fetch(API, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) { console.error('HTTP ' + r.status); process.exit(1); }
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.data || []);
  let draws = [];
  arr.forEach(o => {
    const c = o.concurso || o.numero, dt = o.data || o.dataApuracao;
    const dez = (o.dezenas || o.listaDezenas || []).map(Number);
    if (!c || !dez.length) return;
    if (key === 'duplasena' && dez.length === 12) {
      // dois sorteios de 6 no mesmo concurso -> dois registros
      draws.push([c, dt, dez.slice(0, 6).sort((a, b) => a - b)]);
      draws.push([c, dt, dez.slice(6, 12).sort((a, b) => a - b)]);
    } else {
      draws.push([c, dt, dez.slice().sort((a, b) => a - b)]);
    }
  });
  draws.sort((a, b) => a[0] - b[0]);
  const file = path.join(__dirname, '..', 'dados', key + '.js');
  const header = '// Base ' + key + ' — atualização automática. Formato: [concurso, "dd/mm/aaaa", [dezenas]]';
  fs.writeFileSync(file, header + '\nwindow.LOTO_DB=window.LOTO_DB||{};window.LOTO_DB["' + key + '"]=' + JSON.stringify(draws) + ';\n', 'utf8');
  console.log(key + ': ' + draws.length + ' concursos (#' + draws[0][0] + '..#' + draws[draws.length - 1][0] + ')');
})();
