import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, code: "UNAUTHORIZED", message: "Token ausente" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, code: "UNAUTHORIZED", message: "Token inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const method = req.method;

    // GET — list integrations for tenant
    if (method === "GET") {
      const url = new URL(req.url);
      const tenantId = url.searchParams.get("tenant_id");
      if (!tenantId) {
        return new Response(
          JSON.stringify({ success: false, code: "MISSING_PARAM", message: "tenant_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify tenant access — use userClient so auth.uid() works inside the RPC
      const { data: hasAccess } = await userClient.rpc("user_has_tenant_access", {
        _tenant_id: tenantId,
        _user_id: user.id,
      });
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ success: false, code: "FORBIDDEN", message: "Sem acesso a este tenant" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch integrations
      const { data: integrations, error: intError } = await adminClient
        .from("tenant_meta_integrations")
        .select("*")
        .eq("tenant_id", tenantId);

      if (intError) throw intError;

      // Fetch active grant for auth capability info
      const { data: activeGrant } = await adminClient
        .from("tenant_meta_auth_grants")
        .select("id, granted_scopes, status, token_expires_at, auth_profile_key, meta_user_name")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          integrations: integrations || [],
          grant: activeGrant ? {
            id: activeGrant.id,
            grantedScopes: activeGrant.granted_scopes || [],
            status: activeGrant.status,
            tokenExpiresAt: activeGrant.token_expires_at,
            authProfile: activeGrant.auth_profile_key,
            metaUserName: activeGrant.meta_user_name,
          } : null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST — activate or deactivate an integration
    if (method === "POST") {
      const body = await req.json();
      const { tenant_id, integration_id, action } = body;

      if (!tenant_id || !integration_id || !action) {
        return new Response(
          JSON.stringify({ success: false, code: "MISSING_PARAM", message: "tenant_id, integration_id e action são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!["activate", "deactivate"].includes(action)) {
        return new Response(
          JSON.stringify({ success: false, code: "INVALID_ACTION", message: "action deve ser 'activate' ou 'deactivate'" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify tenant access
      const { data: hasAccess } = await adminClient.rpc("user_has_tenant_access", {
        _tenant_id: tenant_id,
        _user_id: user.id,
      });
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ success: false, code: "FORBIDDEN", message: "Sem acesso a este tenant" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "activate") {
        // Get active grant
        const { data: activeGrant } = await adminClient
          .from("tenant_meta_auth_grants")
          .select("id, granted_scopes")
          .eq("tenant_id", tenant_id)
          .eq("status", "active")
          .maybeSingle();

        if (!activeGrant) {
          return new Response(
            JSON.stringify({ success: false, code: "NO_GRANT", message: "Nenhuma conexão Meta ativa. Conecte sua conta primeiro." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Upsert integration — link to active grant
        const { data: integration, error: upsertError } = await adminClient
          .from("tenant_meta_integrations")
          .upsert(
            {
              tenant_id,
              integration_id,
              auth_grant_id: activeGrant.id,
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,integration_id" }
          )
          .select()
          .single();

        if (upsertError) throw upsertError;

        return new Response(
          JSON.stringify({ success: true, integration }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "deactivate") {
        const { data: integration, error: updateError } = await adminClient
          .from("tenant_meta_integrations")
          .update({ status: "inactive", updated_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id)
          .eq("integration_id", integration_id)
          .select()
          .single();

        if (updateError && updateError.code !== "PGRST116") throw updateError;

        return new Response(
          JSON.stringify({ success: true, integration: integration || null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, code: "METHOD_NOT_ALLOWED", message: "Método não suportado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[meta-integrations-manage] Error:", error);
    return new Response(
      JSON.stringify({ success: false, code: "INTERNAL_ERROR", message: "Erro interno ao gerenciar integração" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
