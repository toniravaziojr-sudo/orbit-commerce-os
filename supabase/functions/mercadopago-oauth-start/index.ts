// Edge: mercadopago-oauth-start
// Inicia o fluxo OAuth do Mercado Pago para o tenant (lojista) usando as credenciais
// do INTEGRADOR armazenadas em platform_credentials.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId: string | undefined = body.tenant_id;
    const returnUrl: string = body.return_url || '';
    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id obrigatório' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validar acesso do usuário ao tenant
    const { data: access } = await admin.rpc('user_has_tenant_access', {
      p_user_id: user.id, p_tenant_id: tenantId,
    });
    if (!access) {
      return new Response(JSON.stringify({ success: false, error: 'forbidden' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar credenciais do INTEGRADOR
    const { data: creds } = await admin
      .from('platform_credentials')
      .select('credential_key, credential_value, is_active')
      .in('credential_key', ['mercadopago_client_id', 'mercadopago_client_secret']);

    const map = Object.fromEntries((creds || []).map(c => [c.credential_key, c]));
    const clientId = map['mercadopago_client_id']?.credential_value;
    if (!clientId || map['mercadopago_client_id']?.is_active === false) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Integração Mercado Pago não configurada pela plataforma. Contate o administrador.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Gerar state assinado curto (tenant + user + nonce + return)
    const nonce = crypto.randomUUID();
    const statePayload = { t: tenantId, u: user.id, n: nonce, r: returnUrl, ts: Date.now() };
    const state = btoa(JSON.stringify(statePayload));

    // Persistir nonce para validar no callback (idempotente)
    await admin.from('oauth_state_store').upsert({
      state_key: nonce,
      provider: 'mercado_pago',
      tenant_id: tenantId,
      user_id: user.id,
      payload: statePayload,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    }, { onConflict: 'state_key' });

    const redirectUri = `${SUPABASE_URL}/functions/v1/mercadopago-oauth-callback`;
    const authUrl = new URL('https://auth.mercadopago.com.br/authorization');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    return new Response(JSON.stringify({ success: true, url: authUrl.toString() }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
