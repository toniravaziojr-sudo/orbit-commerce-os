import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function para gerenciar meta_auth_profiles (admin only).
 * 
 * GET: Lista os 2 perfis com config_id, escopos e status
 * POST: Atualiza o config_id de um perfil específico
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verificar autenticação
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é platform admin
    const { data: isPlatformAdmin } = await supabase.rpc('is_platform_admin');
    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado. Apenas operadores da plataforma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // GET: Listar perfis
    if (req.method === 'GET') {
      const { data: profiles, error } = await supabaseAdmin
        .from('meta_auth_profiles')
        .select('profile_key, display_name, description, config_id, effective_scopes, is_active, updated_at')
        .order('profile_key');

      if (error) {
        console.error('[meta-auth-profiles-admin] Error fetching profiles:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao buscar perfis' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, profiles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Atualizar config_id de um perfil
    if (req.method === 'POST') {
      const body = await req.json();
      const { profile_key, config_id } = body as { profile_key: string; config_id: string | null };

      if (!profile_key) {
        return new Response(
          JSON.stringify({ success: false, error: 'profile_key é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar que é um dos 2 perfis permitidos
      const VALID_PROFILES = ['meta_auth_full', 'meta_auth_external'];
      if (!VALID_PROFILES.includes(profile_key)) {
        return new Response(
          JSON.stringify({ success: false, error: `Perfil '${profile_key}' não é válido` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseAdmin
        .from('meta_auth_profiles')
        .update({
          config_id: config_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_key', profile_key);

      if (error) {
        console.error('[meta-auth-profiles-admin] Error updating profile:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao atualizar perfil' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[meta-auth-profiles-admin] Updated config_id for ${profile_key} by ${user.email}`);

      return new Response(
        JSON.stringify({ success: true, message: `Config ID de ${profile_key} atualizado` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[meta-auth-profiles-admin] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
