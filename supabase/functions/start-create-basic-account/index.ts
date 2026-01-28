import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email, password, owner_name, store_name, phone, utm } = await req.json();

    // Validações
    if (!email || !password || !owner_name || !store_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados obrigatórios não informados' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Senha deve ter pelo menos 6 caracteres' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verificar se já existe usuário
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email?.toLowerCase() === normalizedEmail);

    if (userExists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este email já está cadastrado. Faça login.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar slug único para a loja
    const baseSlug = store_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    // Verificar se slug já existe
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('slug', baseSlug)
      .maybeSingle();

    const slug = existingTenant 
      ? `${baseSlug}-${Date.now().toString(36)}` 
      : baseSlug;

    console.log(`Creating basic account for: ${normalizedEmail}, store: ${store_name}, slug: ${slug}`);

    // 1. Criar usuário no Auth
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: owner_name,
      },
    });

    if (createUserError || !newUser.user) {
      console.error('Error creating user:', createUserError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar usuário: ' + (createUserError?.message || 'Erro desconhecido') }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = newUser.user.id;
    console.log('User created:', userId);

    // 2. Criar profile
    await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: normalizedEmail,
        full_name: owner_name,
      }, { onConflict: 'id' });

    // 3. Criar tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: store_name,
        slug: slug,
        plan: 'start', // Plano inicial
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

    console.log('Tenant created:', tenant.id);

    // 4. Criar user_role como owner
    await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        tenant_id: tenant.id,
        role: 'owner',
      });

    // 5. Criar subscription com status pending_payment_method (plano básico)
    await supabase
      .from('tenant_subscriptions')
      .insert({
        tenant_id: tenant.id,
        plan_key: 'basico',
        status: 'pending_payment_method', // Precisa cadastrar cartão para publicar
        billing_cycle: 'monthly',
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
        utm_content: utm?.utm_content || null,
        utm_term: utm?.utm_term || null,
      });

    console.log('Subscription created with pending_payment_method status');

    // 6. Inicializar credit_wallet
    await supabase
      .from('credit_wallet')
      .insert({
        tenant_id: tenant.id,
        balance_credits: 0,
        reserved_credits: 0,
        lifetime_purchased: 0,
        lifetime_consumed: 0,
      });

    // 7. Atualizar profile com tenant atual
    await supabase
      .from('profiles')
      .update({ current_tenant_id: tenant.id })
      .eq('id', userId);

    // 8. Provisionar domínio padrão (opcional, pode falhar silenciosamente)
    try {
      const projectUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      
      await fetch(`${projectUrl}/functions/v1/domains-provision-default`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          tenant_slug: slug,
        }),
      });
    } catch (domainError) {
      console.error('Error provisioning domain:', domainError);
    }

    // 9. Enviar email de boas-vindas (opcional)
    try {
      const projectUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      
      await fetch(`${projectUrl}/functions/v1/send-auth-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          user_name: owner_name,
          email_type: 'welcome',
          store_name: store_name,
        }),
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    console.log('Basic account creation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        tenant_id: tenant.id,
        email: normalizedEmail,
        message: 'Conta criada com sucesso! Cadastre um cartão de crédito para publicar sua loja.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
