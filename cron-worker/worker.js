/* Cloudflare Worker — Cron Trigger pontual para o robô de resultados.
   O cron do GitHub é "melhor esforço" e às vezes atrasa/pula (foi por isso que o
   aviso chegou 01h da manhã). Este Worker roda no cron confiável da Cloudflare e
   DISPARA o workflow do GitHub logo após os sorteios — que então busca o resultado
   e envia o push (mesmo pipeline que já funciona).

   Secret necessário: GH_TOKEN (token do GitHub com permissão de acionar Actions).
   Config dos horários: no wrangler.toml (ou na aba Triggers do painel). */

const OWNER = 'ConradoSouza';
const REPO = 'lotomaisfacil';
const WORKFLOW = 'atualizar-lotofacil.yml';

export default {
  async scheduled(event, env, ctx) {
    if (!env.GH_TOKEN) { console.log('GH_TOKEN ausente.'); return; }
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
    if (r.ok) console.log('Robô disparado (' + event.cron + ').');
    else console.log('Falha ao disparar: ' + r.status + ' ' + (await r.text()));
  }
};
