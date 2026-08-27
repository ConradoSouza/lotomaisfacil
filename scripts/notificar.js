#!/usr/bin/env node
/* Envia avisos de push quando saem resultados novos.
   Lê o resumo escrito pelo atualizar.js (scripts/_novos.json) e dispara para os inscritos.
   Requer (variáveis de ambiente / secrets do GitHub):
     SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (ex.: mailto:voce@email.com)
   Sem dependência além de "web-push". */
'use strict';
const fs = require('fs');
const path = require('path');
let webpush;
try { webpush = require('web-push'); } catch (e) { console.log('web-push não instalado; pulei os avisos.'); process.exit(0); }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT } = process.env;
const APP_URL = 'https://lotomaisfacil.pages.dev/app.html';

(async () => {
  const arq = path.join(__dirname, '_novos.json');
  let novos = [];
  try { novos = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { /* sem arquivo = nada novo */ }
  if (!Array.isArray(novos) || !novos.length) { console.log('Sem resultados novos; nada a notificar.'); return; }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('Segredos de push ausentes (VAPID/Supabase). Pulei o envio.'); return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:contato@lotomaisfacil.app', VAPID_PUBLIC, VAPID_PRIVATE);

  // monta a mensagem
  const lista = novos.map(n => `${n.nome} #${n.concurso}`).join(', ');
  const payload = JSON.stringify({
    title: '🍀 Saiu o resultado!',
    body: lista + '. Veja se você ganhou!',
    url: APP_URL,
    tag: 'resultado'
  });

  // lê as inscrições (service_role bypassa o RLS)
  const base = SUPABASE_URL.replace(/\/$/, '');
  const headers = { apikey: SUPABASE_SERVICE_ROLE, Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE };
  let subs = [];
  try {
    const r = await fetch(base + '/rest/v1/push_subs?select=endpoint,p256dh,auth', { headers });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    subs = await r.json();
  } catch (e) { console.log('Falha ao ler inscrições: ' + e.message); return; }
  if (!subs.length) { console.log('Nenhum inscrito ainda.'); return; }

  let ok = 0, mortas = 0, falhas = 0;
  await Promise.all(subs.map(async s => {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try { await webpush.sendNotification(sub, payload); ok++; }
    catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) { // inscrição expirada/removida: apaga
        mortas++;
        try { await fetch(base + '/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE', headers }); } catch (e) {}
      } else { falhas++; }
    }
  }));
  console.log(`Push: ${ok} enviado(s), ${mortas} inscrição(ões) morta(s) removida(s), ${falhas} falha(s). Resultados: ${lista}`);
})();
