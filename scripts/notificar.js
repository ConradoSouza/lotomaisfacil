#!/usr/bin/env node
/* Avisos de push:
   - Resultado novo -> notifica TODOS os inscritos (lê scripts/_novos.json do atualizar.js).
   - Falha na atualização -> alerta os ADMINS (lê scripts/_status.json + tabela admins).
   Secrets (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT. */
'use strict';
const fs = require('fs');
const path = require('path');
let webpush;
try { webpush = require('web-push'); } catch (e) { console.log('web-push não instalado; pulei os avisos.'); process.exit(0); }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT } = process.env;
const APP_URL = 'https://lotomaisfacil.pages.dev/app.html';

function ler(nome, fb) { try { return JSON.parse(fs.readFileSync(path.join(__dirname, nome), 'utf8')); } catch (e) { return fb; } }

(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('Segredos de push ausentes (VAPID/Supabase). Pulei o envio.'); return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:contato@lotomaisfacil.app', VAPID_PUBLIC, VAPID_PRIVATE);
  const base = SUPABASE_URL.replace(/\/$/, '');
  const headers = { apikey: SUPABASE_SERVICE_ROLE, Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE };

  async function rest(pathq) { const r = await fetch(base + '/rest/v1/' + pathq, { headers }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  async function apagarEndpoint(ep) { try { await fetch(base + '/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(ep), { method: 'DELETE', headers }); } catch (e) {} }
  async function enviar(subs, payload, rotulo) {
    if (!subs.length) { console.log(rotulo + ': nenhum destinatário.'); return; }
    let ok = 0, mortas = 0, falhas = 0;
    await Promise.all(subs.map(async s => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); ok++; }
      catch (err) { const c = err && err.statusCode; if (c === 404 || c === 410) { mortas++; await apagarEndpoint(s.endpoint); } else falhas++; }
    }));
    console.log(`${rotulo}: ${ok} enviado(s), ${mortas} morta(s), ${falhas} falha(s).`);
  }

  // Diagnóstico: quantas inscrições existem no banco
  let todas = [];
  try { todas = await rest('push_subs?select=endpoint,p256dh,auth'); } catch (e) { console.log('Erro lendo push_subs: ' + e.message); }
  console.log('Inscrições no banco: ' + todas.length);

  // Modo teste (workflow_dispatch com teste=true): manda um push agora pra todos
  if (process.env.TESTE === '1' || process.env.TESTE === 'true') {
    const payload = JSON.stringify({ title: '🔔 Teste de notificação', body: 'Se você recebeu isto, os avisos estão funcionando! 🍀', url: APP_URL, tag: 'teste' });
    await enviar(todas, payload, 'Teste');
    return;
  }

  // 1) Resultado novo -> todos os inscritos
  const novos = ler('_novos.json', []);
  if (Array.isArray(novos) && novos.length) {
    const lista = novos.map(n => `${n.nome} #${n.concurso}`).join(', ');
    const payload = JSON.stringify({ title: '🍀 Saiu o resultado!', body: lista + '. Veja se você ganhou!', url: APP_URL, tag: 'resultado' });
    await enviar(todas, payload, 'Resultado (' + lista + ')');
  } else {
    console.log('Sem resultados novos para notificar.');
  }

  // 2) Falha na atualização -> alerta os admins
  const status = ler('_status.json', { falha: false });
  if (status && status.falha) {
    let adminIds = [];
    try { adminIds = (await rest('admins?select=user_id')).map(a => a.user_id).filter(Boolean); } catch (e) {}
    if (adminIds.length) {
      let subs = [];
      try { subs = await rest('push_subs?select=endpoint,p256dh,auth,user_id&user_id=in.(' + adminIds.join(',') + ')'); } catch (e) {}
      const payload = JSON.stringify({ title: '⚠️ Loto+Facil: atualização falhou', body: 'Uma fonte de resultados ficou indisponível. Confira as APIs/robô.', url: APP_URL, tag: 'admin-alerta' });
      await enviar(subs, payload, 'Alerta admin');
    } else {
      console.log('Falha detectada, mas nenhum admin cadastrado para alertar.');
    }
  }
})();
