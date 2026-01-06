import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is platform admin
    const { data: isPlatformAdmin } = await supabase.rpc('is_platform_admin');
    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado. Apenas operadores da plataforma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body for POST requests (which includes action-based routing)
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    // GET - List all instances
    // Also support POST with no action as GET
    if (req.method === 'GET' || (req.method === 'POST' && !body.action)) {
      const { data, error } = await supabaseAdmin
        .from('whatsapp_configs')
        .select(`
          id,
          tenant_id,
          instance_id,
          connection_status,
          phone_number,
          is_enabled,
          last_connected_at,
          last_error,
          created_at,
          updated_at,
          tenants:tenant_id (
            id,
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[whatsapp-admin-instances] Error listing:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mask sensitive data
      const instances = (data || []).map((item: any) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        tenant_name: item.tenants?.name || 'N/A',
        tenant_slug: item.tenants?.slug || 'N/A',
        instance_id_preview: item.instance_id 
          ? `${item.instance_id.substring(0, 8)}...` 
          : null,
        has_credentials: !!item.instance_id,
        connection_status: item.connection_status,
        phone_number: item.phone_number,
        is_enabled: item.is_enabled,
        last_connected_at: item.last_connected_at,
        last_error: item.last_error,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      console.log(`[whatsapp-admin-instances] Returning ${instances.length} instances`);

      return new Response(
        JSON.stringify({ success: true, instances }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create/Update instance
    if (req.method === 'POST') {
      const body = await req.json();
      const { tenant_id, instance_id, instance_token, client_token, is_enabled = true } = body;

      if (!tenant_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!instance_id || !instance_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'instance_id e instance_token são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upsert whatsapp_configs
      const { data, error } = await supabaseAdmin
        .from('whatsapp_configs')
        .upsert({
          tenant_id,
          instance_id,
          instance_token,
          client_token: client_token || null,
          is_enabled,
          connection_status: 'disconnected',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id',
        })
        .select()
        .single();

      if (error) {
        console.error('[whatsapp-admin-instances] Error upserting:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[whatsapp-admin-instances] Upserted instance for tenant ${tenant_id}`);

      return new Response(
        JSON.stringify({ success: true, instance: { id: data.id, tenant_id: data.tenant_id } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remove instance
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { tenant_id } = body;

      if (!tenant_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseAdmin
        .from('whatsapp_configs')
        .delete()
        .eq('tenant_id', tenant_id);

      if (error) {
        console.error('[whatsapp-admin-instances] Error deleting:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[whatsapp-admin-instances] Deleted instance for tenant ${tenant_id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[whatsapp-admin-instances] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
