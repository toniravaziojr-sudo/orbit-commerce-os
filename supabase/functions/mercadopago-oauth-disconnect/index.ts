// Edge: mercadopago-oauth-disconnect
// Remove a conexão do tenant com o Mercado Pago.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { tenant_id } = await req.json().catch(() => ({}));
    if (!tenant_id) return new Response(JSON.stringify({ success: false, error: 'tenant_id obrigatório' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: access } = await admin.rpc('user_has_tenant_access', { p_user_id: user.id, p_tenant_id: tenant_id });
    if (!access) return new Response(JSON.stringify({ success: false, error: 'forbidden' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    await admin.from('payment_providers').delete().eq('tenant_id', tenant_id).eq('provider', 'mercado_pago');

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
