/* Cloudflare Worker — Cron Trigger pontual para o robô de resultados.
   O cron do GitHub é "melhor esforço" e às vezes atrasa/pula. Este Worker roda no cron
   confiável da Cloudflare e DISPARA o workflow do GitHub logo após os sorteios — que então
   busca o resultado e envia o push (mesmo pipeline que já funciona).

   Secret necessário: GH_TOKEN (fine-grained token do GitHub com Actions: Read and write).
   Horários: no wrangler.toml, ou na aba Triggers do painel.

   Teste manual: acesse  https://SEU-worker.workers.dev/run  no navegador. */

const OWNER = 'ConradoSouza';
const REPO = 'lotomaisfacil';
const WORKFLOW = 'atualizar-lotofacil.yml';

async function dispararRobo(env) {
  if (!env.GH_TOKEN) return { ok: false, msg: 'GH_TOKEN ausente no Worker.' };
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.GH_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lotomais-cron-worker'
    },
    body: JSON.stringify({ ref: 'main' })
  });
  if (r.ok) return { ok: true, msg: 'Robô disparado ✅' };
  return { ok: false, msg: 'Falha ao disparar: ' + r.status + ' ' + (await r.text()) };
}

export default {
  // Dispara automaticamente nos horários agendados (cron triggers).
  async scheduled(event, env, ctx) {
    const res = await dispararRobo(env);
    console.log(res.msg + ' (' + event.cron + ')');
  },
  // Permite testar manualmente abrindo a URL do Worker com /run no final.
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/run') {
      const res = await dispararRobo(env);
      return new Response(res.msg, { status: res.ok ? 200 : 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    return new Response('Worker de cron do Loto+Facil ativo. Dispara o robô nos horários agendados.\nPara testar agora, acesse /run', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
};
