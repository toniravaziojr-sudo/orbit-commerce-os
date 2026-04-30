// Edge: mercadopago-oauth-callback
// Recebe o code do Mercado Pago, troca por access_token+refresh_token
// e persiste em payment_providers do tenant.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function htmlResponse(status: 'success' | 'error', message: string, returnUrl?: string) {
  const target = returnUrl || '/integrations';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mercado Pago</title>
  <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc}
  .card{background:#fff;padding:32px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.08);max-width:420px;text-align:center}
  .ok{color:#16a34a}.err{color:#dc2626}</style></head>
  <body><div class="card">
  <h2 class="${status === 'success' ? 'ok' : 'err'}">${status === 'success' ? '✅ Conectado!' : '❌ Falha na conexão'}</h2>
  <p>${message}</p>
  <p style="color:#64748b;font-size:14px">Você pode fechar esta janela.</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ source: 'mp-oauth', status: '${status}', message: ${JSON.stringify(message)} }, '*');
        setTimeout(() => window.close(), 1200);
      } else {
        setTimeout(() => { window.location.href = ${JSON.stringify(target)}; }, 1500);
      }
    } catch(e){}
  </script></body></html>`;
  return new Response(html, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateRaw = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) return htmlResponse('error', `Mercado Pago retornou erro: ${error}`);
    if (!code || !stateRaw) return htmlResponse('error', 'Parâmetros ausentes (code/state).');

    let state: any;
    try { state = JSON.parse(atob(stateRaw)); } catch { return htmlResponse('error', 'State inválido.'); }
    const { t: tenantId, u: userId, n: nonce, r: returnUrl } = state;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validar nonce
    const { data: stateRow } = await admin
      .from('oauth_state_store')
      .select('state_key, expires_at, tenant_id')
      .eq('state_key', nonce)
      .maybeSingle();
    if (!stateRow || stateRow.tenant_id !== tenantId) return htmlResponse('error', 'State expirado ou inválido.');
    if (new Date(stateRow.expires_at) < new Date()) return htmlResponse('error', 'Sessão de conexão expirada. Tente novamente.');

    // Credenciais do integrador
    const { data: creds } = await admin
      .from('platform_credentials')
      .select('credential_key, credential_value')
      .in('credential_key', ['mercadopago_client_id', 'mercadopago_client_secret']);
    const map = Object.fromEntries((creds || []).map(c => [c.credential_key, c.credential_value]));
    const clientId = map['mercadopago_client_id'];
    const clientSecret = map['mercadopago_client_secret'];
    if (!clientId || !clientSecret) return htmlResponse('error', 'Credenciais do integrador não configuradas.');

    // Trocar code por token
    const redirectUri = `${SUPABASE_URL}/functions/v1/mercadopago-oauth-callback`;
    const tokenResp = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenJson.access_token) {
      console.error('[mp-oauth-callback] token exchange failed', tokenJson);
      return htmlResponse('error', tokenJson.message || 'Falha ao trocar código por token.');
    }

    // Buscar public_key (via /users/me)
    let publicKey = tokenJson.public_key || '';
    let mpUserId = tokenJson.user_id?.toString() || '';
    try {
      const meResp = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (meResp.ok) {
        const me: any = await meResp.json();
        mpUserId = mpUserId || me.id?.toString() || '';
      }
    } catch {}

    // Persistir em payment_providers (recebedor do tenant)
    const credentials = {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token || null,
      public_key: publicKey,
      mp_user_id: mpUserId,
      scope: tokenJson.scope || null,
      token_type: tokenJson.token_type || 'bearer',
      expires_in: tokenJson.expires_in || null,
      connected_at: new Date().toISOString(),
      expires_at: tokenJson.expires_in
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : null,
      connected_via: 'oauth',
    };

    const { error: upsertErr } = await admin.from('payment_providers').upsert({
      tenant_id: tenantId,
      provider: 'mercado_pago',
      is_enabled: true,
      environment: 'production',
      credentials,
    }, { onConflict: 'tenant_id,provider' });
    if (upsertErr) {
      console.error('[mp-oauth-callback] upsert err', upsertErr);
      return htmlResponse('error', 'Falha ao salvar conexão no banco.');
    }

    // Cleanup state
    await admin.from('oauth_state_store').delete().eq('state_key', nonce);

    return htmlResponse('success', 'Mercado Pago conectado com sucesso ao seu tenant.', returnUrl);
  } catch (e: any) {
    console.error('[mp-oauth-callback] fatal', e);
    return htmlResponse('error', e?.message || 'Erro inesperado.');
  }
});
