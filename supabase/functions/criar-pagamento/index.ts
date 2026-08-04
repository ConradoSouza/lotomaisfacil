// Loto+Facil — cria um pagamento no Mercado Pago (Pro por 30 dias).
// Chamada pelo app (usuário logado). Requer o secret MP_ACCESS_TOKEN.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = 'https://lotomaisfacil.pages.dev/';
const PRECO = 9.90;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'não autenticado' }, 401);

    const preferencia = {
      items: [{ title: 'Loto+Facil Pro — 30 dias', quantity: 1, currency_id: 'BRL', unit_price: PRECO }],
      external_reference: user.id,
      metadata: { user_id: user.id },
      back_urls: {
        success: APP_URL + '?pro=ok',
        failure: APP_URL + '?pro=falhou',
        pending: APP_URL + '?pro=pendente',
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-mp`,
    };

    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencia),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: 'erro no Mercado Pago', detalhe: data }, 500);

    return json({ init_point: data.init_point, sandbox: data.sandbox_init_point });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
