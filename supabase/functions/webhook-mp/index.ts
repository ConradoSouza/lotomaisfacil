// Loto+Facil — webhook do Mercado Pago. Quando um pagamento é APROVADO,
// libera o Pro por 30 dias no perfil do usuário (usando a service_role).
// IMPORTANTE: criar esta função com "Verify JWT" DESLIGADO (o MP chama sem token).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DIAS = 30;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let tipo = url.searchParams.get('type') || url.searchParams.get('topic');
    let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');
    if (!paymentId || !tipo) {
      try {
        const body = await req.json();
        tipo = tipo || body.type;
        paymentId = paymentId || (body.data && body.data.id) || body.id;
      } catch (_e) { /* sem corpo */ }
    }
    // só nos interessa notificação de pagamento
    if (tipo !== 'payment' || !paymentId) return new Response('ignorado', { status: 200 });

    // consulta o pagamento no Mercado Pago
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` },
    });
    const pay = await mpResp.json();
    if (pay.status !== 'approved') return new Response('não aprovado', { status: 200 });

    const userId = pay.external_reference || (pay.metadata && pay.metadata.user_id);
    if (!userId) return new Response('sem usuário', { status: 200 });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // idempotência: não processa o mesmo pagamento duas vezes
    const { data: ja } = await admin.from('pagamentos').select('mp_id').eq('mp_id', String(paymentId)).maybeSingle();
    if (ja) return new Response('já processado', { status: 200 });

    // estende o Pro a partir do vencimento atual (ou de agora)
    const { data: perfil } = await admin.from('perfis').select('pro_ate').eq('id', userId).single();
    const agora = new Date();
    const base = perfil?.pro_ate && new Date(perfil.pro_ate) > agora ? new Date(perfil.pro_ate) : agora;
    const novo = new Date(base.getTime() + DIAS * 24 * 60 * 60 * 1000);

    await admin.from('perfis').update({ plano: 'pro', pro_ate: novo.toISOString() }).eq('id', userId);
    await admin.from('pagamentos').insert({ mp_id: String(paymentId), user_id: userId, valor: pay.transaction_amount, status: pay.status });

    return new Response('ok', { status: 200 });
  } catch (e) {
    // devolve 200 para o MP não ficar reenviando; o erro fica no log da função
    return new Response('erro: ' + String(e), { status: 200 });
  }
});
