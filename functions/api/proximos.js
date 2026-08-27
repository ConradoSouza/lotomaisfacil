/* Cloudflare Pages Function — /api/proximos
   Retorna o próximo concurso (número, data, prêmio estimado, acumulado) de TODAS as loterias,
   numa chamada só. Alimenta o "qual jogar hoje" do Painel. */

const LOTERIAS = [
  ['lotofacil', 'Lotofácil'], ['megasena', 'Mega-Sena'], ['quina', 'Quina'],
  ['lotomania', 'Lotomania'], ['duplasena', 'Dupla Sena'], ['diadesorte', 'Dia de Sorte']
];

const GUIDI = (k) => 'https://api.guidi.dev.br/loteria/' + k;
const COMUNIT = (k) => 'https://loteriascaixa-api.herokuapp.com/api/' + k;
const CAIXA = (k) => 'https://servicebus2.caixa.gov.br/portaldeloterias/api/' + k;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=600', // 10 min: estimativa muda devagar
};

async function getJSON(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Loto+Facil' }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function ultimoJSON(key) {
  try { const j = await getJSON(GUIDI(key) + '/ultimo'); if (j && (j.numero || j.concurso)) return j; } catch (e) {}
  try { const j = await getJSON(COMUNIT(key) + '/latest'); if (j && j.concurso) return j; } catch (e) {}
  return await getJSON(CAIXA(key));
}
function proximoFrom(j) {
  if (!j) return null;
  const numero = j.numeroConcursoProximo || j.proximoConcurso || null;
  const data = j.dataProximoConcurso || null;
  const estimativa = j.valorEstimadoProximoConcurso || 0;
  const acumulado = !!j.acumulado;
  const acumuladoValor = j.valorAcumuladoProximoConcurso || 0;
  if (!numero && !data && !estimativa) return null;
  return { numero, data, estimativa, acumulado, acumuladoValor };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestGet() {
  const loterias = {};
  await Promise.all(LOTERIAS.map(async ([key, nome]) => {
    try { const j = await ultimoJSON(key); loterias[key] = { nome, ultimo: j.numero || j.concurso || null, proximo: proximoFrom(j) }; }
    catch (e) { loterias[key] = { nome, ultimo: null, proximo: null }; }
  }));
  return json({ ok: true, loterias });
}
