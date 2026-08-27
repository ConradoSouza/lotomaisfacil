/* Cloudflare Pages Function — /api/resultados?loteria=lotofacil&desde=3752
   Busca no lado do servidor (sem bloqueio de CORS) os concursos mais novos que "desde".
   Deploy automático junto com o site (git push). Assim o app se auto-atualiza na hora,
   sem depender do robô agendado. Retorna { ok, latest, entries, premios }. */

const LOTERIAS = ['lotofacil', 'megasena', 'quina', 'lotomania', 'duplasena', 'diadesorte'];
const MAX_NOVOS = 60; // trava de segurança por chamada

const GUIDI = (k) => 'https://api.guidi.dev.br/loteria/' + k;               // espelho da Caixa, atualizado
const COMUNIT = (k) => 'https://loteriascaixa-api.herokuapp.com/api/' + k;   // fallback (às vezes trava)
const CAIXA = (k) => 'https://servicebus2.caixa.gov.br/portaldeloterias/api/' + k; // oficial (fallback)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=120', // 2 min: alivia a origem sem atrasar resultado novo
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

function entriesFrom(key, j) {
  const c = j.concurso || j.numero, dt = j.data || j.dataApuracao;
  const dez = (j.dezenas || j.listaDezenas || []).map(Number);
  if (key === 'duplasena') {
    const seg = (j.listaDezenasSegundoSorteio || []).map(Number);
    if (seg.length) return [[c, dt, dez.slice().sort((a, b) => a - b)], [c, dt, seg.sort((a, b) => a - b)]];
    if (dez.length === 12) return [[c, dt, dez.slice(0, 6).sort((a, b) => a - b)], [c, dt, dez.slice(6, 12).sort((a, b) => a - b)]];
  }
  const entry = [c, dt, dez.slice().sort((a, b) => a - b)];
  if (key === 'diadesorte') entry.push(j.mesSorte || j.nomeTimeCoracaoMesSorte || '');
  return [entry];
}

function premiosFrom(j) {
  const premios = {}, lista = j.premiacoes || j.listaRateioPremio || [];
  lista.forEach(p => {
    const desc = p.descricao != null ? p.descricao : (p.descricaoFaixa != null ? p.descricaoFaixa : p.faixa);
    const h = parseInt(desc);
    if (isNaN(h)) return;
    const v = p.valorPremio || 0, g = (p.ganhadores != null ? p.ganhadores : p.numeroDeGanhadores) || 0;
    if (!premios[h] || v > premios[h][0]) premios[h] = [v, g];
  });
  return { concurso: j.concurso || j.numero, data: j.data || j.dataApuracao, premios };
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
async function fetchRaw(key, n) {
  try { const j = await getJSON(GUIDI(key) + '/' + n); if (j && (j.numero || j.concurso)) return j; } catch (e) {}
  try { const j = await getJSON(COMUNIT(key) + '/' + n); if (j && (j.concurso || j.numero)) return j; } catch (e) {}
  return await getJSON(CAIXA(key) + '/' + n);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const key = (url.searchParams.get('loteria') || '').toLowerCase();
    const desde = parseInt(url.searchParams.get('desde') || '0', 10) || 0;
    if (!LOTERIAS.includes(key)) return json({ ok: false, erro: 'loteria inválida' }, 400);

    let ult;
    try { ult = await ultimoJSON(key); }
    catch (e) { return json({ ok: false, erro: 'fontes indisponíveis' }, 502); }
    const latest = ult.numero || ult.concurso;
    const proximo = proximoFrom(ult);

    if (!latest || latest <= desde) return json({ ok: true, latest: latest || desde, entries: [], premios: null, proximo });

    const entries = [];
    let lastJson = null;
    const alvo = Math.min(latest, desde + MAX_NOVOS);
    for (let n = desde + 1; n <= alvo; n++) {
      let j;
      try { j = await fetchRaw(key, n); }
      catch (e) { break; } // para no primeiro furo; volta o que já tem
      const es = entriesFrom(key, j);
      if (!es[0][0] || !es[0][2].length) break;
      es.forEach(e => entries.push(e));
      lastJson = j;
    }
    return json({ ok: true, latest, entries, premios: lastJson ? premiosFrom(lastJson) : null, proximo });
  } catch (e) {
    return json({ ok: false, erro: 'erro interno' }, 500);
  }
}
