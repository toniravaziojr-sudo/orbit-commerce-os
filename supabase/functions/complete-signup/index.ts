import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CompleteSignupRequest {
  token: string;
  password?: string;
  google_access_token?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body: CompleteSignupRequest = await req.json();
    const { token, password, google_access_token } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password && !google_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe uma senha ou faça login com Google' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar token
    const { data: sessionId } = await supabase.rpc('validate_billing_checkout_token', { p_token: token });

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou expirado. Solicite um novo link por e-mail.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar sessão
    const { data: session, error: sessionError } = await supabase
      .from('billing_checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status === 'completed') {
      return new Response(
        JSON.stringify({ success: false, error: 'Esta conta já foi criada. Faça login.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userId: string | null = null;
    let userEmail = session.email;

    // Verificar se usuário já existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === session.email.toLowerCase()
    );

    if (existingUser) {
      userId = existingUser.id;
      console.log('User already exists:', userId);
    } else if (password) {
      // Criar usuário com senha
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: session.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: session.owner_name,
        },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar usuário: ' + createError.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user?.id || null;
      console.log('User created:', userId);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado. Crie uma senha.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar usuário' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar ou atualizar profile
    await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: session.email,
        full_name: session.owner_name,
      }, { onConflict: 'id' });

    // Verificar se já existe tenant com esse slug
    let tenantId: string | null = session.tenant_id;

    if (!tenantId) {
      // Verificar slug único
      let slug = session.slug;
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existingTenant) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      // Criar tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: session.store_name,
          slug: slug,
        })
        .select()
        .single();

      if (tenantError || !tenant) {
        console.error('Error creating tenant:', tenantError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar loja' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = tenant.id;
      console.log('Tenant created:', tenantId);
    }

    // Criar user_role como owner
    await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        role: 'owner',
      }, { onConflict: 'user_id,tenant_id' });

    // Atualizar current_tenant_id no profile
    await supabase
      .from('profiles')
      .update({ current_tenant_id: tenantId })
      .eq('id', userId);

    // Criar/atualizar assinatura
    const now = new Date();
    const periodEnd = new Date();
    if (session.billing_cycle === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await supabase
      .from('tenant_subscriptions')
      .upsert({
        tenant_id: tenantId,
        plan_key: session.plan_key,
        billing_cycle: session.billing_cycle,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        mp_preapproval_id: session.mp_preapproval_id,
      }, { onConflict: 'tenant_id' });

    // Marcar sessão como completed
    await supabase
      .from('billing_checkout_sessions')
      .update({
        status: 'completed',
        tenant_id: tenantId,
        user_id: userId,
        token_hash: null,
        token_expires_at: null,
      })
      .eq('id', session.id);

    console.log('Signup completed for session:', session.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conta criada com sucesso!',
        tenant_id: tenantId,
        user_id: userId,
        email: session.email,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
