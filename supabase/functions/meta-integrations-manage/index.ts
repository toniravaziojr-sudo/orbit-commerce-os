import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { revalidateStorefrontAfterTrackingChange } from "../_shared/storefront-revalidation.ts";

const VERSION = "v1.2.0";
// v1.3.0 — Sync fresh grant token to marketing_integrations on pixel/CAPI activation
const TRACKING_INTEGRATION_IDS = new Set(["pixel_facebook", "conversions_api"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  console.log(`[meta-integrations-manage][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    if (method === "GET") {
      const url = new URL(req.url);
      const tenantId = url.searchParams.get("tenant_id");
      if (!tenantId) {
        return new Response(
          JSON.stringify({ success: false, code: "MISSING_PARAM", message: "tenant_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: hasAccess } = await userClient.rpc("user_has_tenant_access", {
        p_tenant_id: tenantId,
      });
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ success: false, code: "FORBIDDEN", message: "Sem acesso a este tenant" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: activeGrant } = await adminClient
        .from("tenant_meta_auth_grants")
        .select("id, granted_scopes, status, token_expires_at, auth_profile_key, meta_user_name, discovered_assets")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();

      let integrationsQuery = adminClient
        .from("tenant_meta_integrations")
        .select("*")
        .eq("tenant_id", tenantId);

      if (activeGrant) {
        integrationsQuery = integrationsQuery.eq("auth_grant_id", activeGrant.id);
      }

      const { data: integrations, error: intError } = await integrationsQuery;
      if (intError) throw intError;

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
            discoveredAssets: activeGrant.discovered_assets || null,
          } : null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "POST") {
      const body = await req.json();
      const { tenant_id, integration_id, action, selected_assets } = body;

      if (!tenant_id || !integration_id || !action) {
        return new Response(
          JSON.stringify({ success: false, code: "MISSING_PARAM", message: "tenant_id, integration_id e action são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!["activate", "deactivate", "save_assets"].includes(action)) {
        return new Response(
          JSON.stringify({ success: false, code: "INVALID_ACTION", message: "action deve ser 'activate', 'deactivate' ou 'save_assets'" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: hasAccess } = await userClient.rpc("user_has_tenant_access", {
        p_tenant_id: tenant_id,
      });
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ success: false, code: "FORBIDDEN", message: "Sem acesso a este tenant" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "activate") {
        const { data: activeGrant } = await adminClient
          .from("tenant_meta_auth_grants")
          .select("id, granted_scopes, discovered_assets")
          .eq("tenant_id", tenant_id)
          .eq("status", "active")
          .maybeSingle();

        if (!activeGrant) {
          return new Response(
            JSON.stringify({ success: false, code: "NO_GRANT", message: "Nenhuma conexão Meta ativa. Conecte sua conta primeiro." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const upsertData: Record<string, unknown> = {
          tenant_id,
          integration_id,
          auth_grant_id: activeGrant.id,
          status: "active",
          updated_at: new Date().toISOString(),
        };

        if (selected_assets) {
          upsertData.selected_assets = selected_assets;
        }

        const { data: integration, error: upsertError } = await adminClient
          .from("tenant_meta_integrations")
          .upsert(upsertData, { onConflict: "tenant_id,integration_id" })
          .select()
          .single();

        if (upsertError) throw upsertError;

        if (selected_assets) {
          await executeSideEffects(adminClient, tenant_id, integration_id, selected_assets);
        }

        const storefrontSync = await maybeRevalidateStorefront({
          adminClient,
          supabaseUrl,
          supabaseServiceKey,
          tenantId: tenant_id,
          integrationId: integration_id,
          action,
        });

        return new Response(
          JSON.stringify({ success: true, integration, storefrontSync }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "save_assets") {
        if (!selected_assets) {
          return new Response(
            JSON.stringify({ success: false, code: "MISSING_PARAM", message: "selected_assets é obrigatório para save_assets" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: integration, error: updateError } = await adminClient
          .from("tenant_meta_integrations")
          .update({
            selected_assets,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenant_id)
          .eq("integration_id", integration_id)
          .select()
          .single();

        if (updateError) throw updateError;

        await executeSideEffects(adminClient, tenant_id, integration_id, selected_assets);

        const storefrontSync = await maybeRevalidateStorefront({
          adminClient,
          supabaseUrl,
          supabaseServiceKey,
          tenantId: tenant_id,
          integrationId: integration_id,
          action,
        });

        return new Response(
          JSON.stringify({ success: true, integration, storefrontSync }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "deactivate") {
        const { data: integration, error: updateError } = await adminClient
          .from("tenant_meta_integrations")
          .update({
            status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenant_id)
          .eq("integration_id", integration_id)
          .select()
          .single();

        if (updateError && updateError.code !== "PGRST116") throw updateError;

        await cleanupSideEffects(adminClient, tenant_id, integration_id);

        const storefrontSync = await maybeRevalidateStorefront({
          adminClient,
          supabaseUrl,
          supabaseServiceKey,
          tenantId: tenant_id,
          integrationId: integration_id,
          action,
        });

        return new Response(
          JSON.stringify({ success: true, integration: integration || null, storefrontSync }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, code: "METHOD_NOT_ALLOWED", message: "Método não suportado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[meta-integrations-manage][${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, code: "INTERNAL_ERROR", message: "Erro interno ao gerenciar integração" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function maybeRevalidateStorefront(params: {
  adminClient: any;
  supabaseUrl: string;
  supabaseServiceKey: string;
  tenantId: string;
  integrationId: string;
  action: string;
}) {
  const { adminClient, supabaseUrl, supabaseServiceKey, tenantId, integrationId, action } = params;

  if (!TRACKING_INTEGRATION_IDS.has(integrationId)) {
    return null;
  }

  try {
    return await revalidateStorefrontAfterTrackingChange({
      supabase: adminClient,
      supabaseUrl,
      supabaseServiceKey,
      tenantId,
      reason: `meta-integrations-manage:${action}:${integrationId}`,
    });
  } catch (error) {
    console.warn(`[meta-integrations-manage][${VERSION}] Storefront revalidation failed:`, (error as Error).message);
    return {
      staleCount: 0,
      cachePurged: false,
      prerenderTriggered: false,
      purgeStatus: null,
      prerenderStatus: null,
    };
  }
}

async function executeSideEffects(
  adminClient: any,
  tenantId: string,
  integrationId: string,
  selectedAssets: any,
) {
  try {
    if (integrationId.startsWith("whatsapp_") && selectedAssets.phone) {
      const phone = selectedAssets.phone;
      await adminClient
        .from("whatsapp_configs")
        .upsert({
          tenant_id: tenantId,
          provider: "meta",
          phone_number_id: phone.id,
          phone_number: phone.display_phone_number || null,
          display_phone_number: phone.display_phone_number || null,
          verified_name: phone.verified_name || null,
          waba_id: phone.waba_id,
          connection_status: "connected",
          is_enabled: true,
          last_connected_at: new Date().toISOString(),
          last_error: null,
        }, { onConflict: "tenant_id,provider" });

      console.log(`[meta-integrations-manage] WhatsApp side-effect: phone ${phone.display_phone_number} configured`);
    }

    if (integrationId === "pixel_facebook" && selectedAssets.pixel) {
      const pixel = selectedAssets.pixel;

      // Get fresh token from active grant for CAPI usage
      let freshToken: string | null = null;
      try {
        const { getMetaConnectionForTenant } = await import("../_shared/meta-connection.ts");
        const conn = await getMetaConnectionForTenant(adminClient, tenantId, "pixel-side-effect");
        freshToken = conn?.access_token || null;
      } catch (e) {
        console.warn(`[meta-integrations-manage] Could not get fresh token for pixel side-effect`);
      }

      await adminClient
        .from("marketing_integrations")
        .upsert({
          tenant_id: tenantId,
          meta_pixel_id: pixel.id,
          meta_enabled: true,
          meta_status: "active",
          meta_access_token: freshToken,
          meta_last_error: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });

      console.log(`[meta-integrations-manage] Pixel side-effect: ${pixel.id} configured`);
    }

    if (integrationId === "conversions_api" && selectedAssets.pixel) {
      const pixel = selectedAssets.pixel;

      // Get fresh token from active grant for CAPI usage
      let freshToken: string | null = null;
      try {
        const { getMetaConnectionForTenant } = await import("../_shared/meta-connection.ts");
        const conn = await getMetaConnectionForTenant(adminClient, tenantId, "capi-side-effect");
        freshToken = conn?.access_token || null;
      } catch (e) {
        console.warn(`[meta-integrations-manage] Could not get fresh token for CAPI side-effect`);
      }

      await adminClient
        .from("marketing_integrations")
        .upsert({
          tenant_id: tenantId,
          meta_pixel_id: pixel.id,
          meta_enabled: true,
          meta_capi_enabled: true,
          meta_status: "active",
          meta_access_token: freshToken,
          meta_last_error: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });

      console.log(`[meta-integrations-manage] CAPI side-effect: ${pixel.id} configured`);
    }
  } catch (err) {
    console.warn(`[meta-integrations-manage] Side-effect error for ${integrationId}:`, err);
  }
}

async function cleanupSideEffects(
  adminClient: any,
  tenantId: string,
  integrationId: string,
) {
  try {
    if (integrationId === "pixel_facebook") {
      await adminClient
        .from("marketing_integrations")
        .update({
          meta_enabled: false,
          meta_status: "inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);
    }

    if (integrationId === "conversions_api") {
      await adminClient
        .from("marketing_integrations")
        .update({
          meta_capi_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);
    }
  } catch (err) {
    console.warn(`[meta-integrations-manage] Cleanup error for ${integrationId}:`, err);
  }
}
