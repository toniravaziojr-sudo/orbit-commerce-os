import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import {
  LATE_BASE_URL,
  listProfiles,
  createProfile,
  getConnectUrl,
  findMatchingProfile,
  generateProfileName,
} from "../_shared/late-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LogContext {
  tenant_id: string;
  step: string;
  late_profile_id?: string;
  error?: string;
}

function log(ctx: LogContext, message: string) {
  console.log(`[late-auth-start] [${ctx.step}] tenant=${ctx.tenant_id} profile=${ctx.late_profile_id || 'none'}: ${message}`);
  if (ctx.error) {
    console.error(`[late-auth-start] [${ctx.step}] ERROR: ${ctx.error}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ctx: LogContext = { tenant_id: "unknown", step: "init" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate auth
    ctx.step = "auth";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header required" });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ success: false, error: "User not authenticated" });
    }

    // Parse request
    ctx.step = "parse";
    const { tenant_id, redirect_url, platform = "facebook" } = await req.json();
    if (!tenant_id) {
      return jsonResponse({ success: false, error: "tenant_id is required" });
    }
    ctx.tenant_id = tenant_id;
    
    // Validate platform
    const validPlatforms = ["facebook", "instagram"];
    const selectedPlatform = validPlatforms.includes(platform) ? platform : "facebook";
    log(ctx, "Request received");

    // Verify user role
    ctx.step = "role_check";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (roleError || !roleCheck) {
      log(ctx, "User not authorized for tenant");
      return jsonResponse({ success: false, error: "User not authorized for this tenant" });
    }

    // Get Late API Key
    ctx.step = "get_api_key";
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    if (!lateApiKey) {
      log(ctx, "Late API Key not configured");
      return jsonResponse({ success: false, error: "Late API Key não configurada. Contate o administrador." });
    }

    // Check for existing connection with profile
    ctx.step = "check_existing";
    const { data: existingConnection } = await supabaseAdmin
      .from("late_connections")
      .select("late_profile_id, status, updated_at")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    let lateProfileId = existingConnection?.late_profile_id;

    // Reset stale "connecting" status (> 10 minutes)
    if (existingConnection?.status === "connecting" && existingConnection.updated_at) {
      const updatedAt = new Date(existingConnection.updated_at);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (updatedAt < tenMinutesAgo) {
        log(ctx, "Resetting stale connecting status");
        await supabaseAdmin
          .from("late_connections")
          .update({ status: "disconnected", last_error: "Connection timeout reset" })
          .eq("tenant_id", tenant_id);
      }
    }

    // If we have a profile ID, use it (idempotency - 1 profile per tenant)
    if (lateProfileId) {
      ctx.late_profile_id = lateProfileId;
      log(ctx, "Using existing profile ID");
    } else {
      // Get tenant info
      ctx.step = "get_tenant";
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name, slug")
        .eq("id", tenant_id)
        .single();

      const profileName = generateProfileName(tenant?.slug || null, tenant_id);

      // List existing profiles
      ctx.step = "list_profiles";
      const { profiles, error: listError } = await listProfiles(lateApiKey);
      
      if (listError) {
        log({ ...ctx, error: listError }, "Failed to list profiles");
        return jsonResponse({ success: false, error: "Erro ao conectar com Late. Tente novamente." });
      }

      log(ctx, `Found ${profiles.length} profiles in Late`);

      // Try to find matching profile
      const matchingProfile = findMatchingProfile(profiles, tenant_id, tenant?.slug);
      
      if (matchingProfile) {
        lateProfileId = matchingProfile._id;
        ctx.late_profile_id = lateProfileId;
        log(ctx, `Found matching profile: ${matchingProfile.name}`);
      } else {
        // Create new profile
        ctx.step = "create_profile";
        const { profile, error: createError } = await createProfile(lateApiKey, profileName);

        if (createError === "PROFILE_LIMIT_REACHED") {
          log(ctx, "Profile limit reached in Late plan");
          return jsonResponse({ 
            success: false, 
            error: "Limite de perfis atingido no seu plano Late. Faça upgrade ou delete um perfil existente no painel da Late." 
          });
        }

        if (createError === "PROFILE_EXISTS") {
          // Profile exists but we didn't find it - try listing again
          log(ctx, "Profile exists but not found in list, retrying...");
          const { profiles: retryProfiles } = await listProfiles(lateApiKey);
          const retryMatch = findMatchingProfile(retryProfiles, tenant_id, tenant?.slug);
          if (retryMatch) {
            lateProfileId = retryMatch._id;
            ctx.late_profile_id = lateProfileId;
            log(ctx, `Found profile on retry: ${retryMatch.name}`);
          } else {
            return jsonResponse({ 
              success: false, 
              error: "Perfil já existe na Late mas não foi encontrado. Contate o suporte." 
            });
          }
        } else if (createError) {
          log({ ...ctx, error: createError }, "Failed to create profile");
          return jsonResponse({ success: false, error: "Erro ao criar perfil na Late." });
        } else if (profile) {
          lateProfileId = profile._id;
          ctx.late_profile_id = lateProfileId;
          log(ctx, `Created new profile: ${profile.name}`);
        }
      }

      if (!lateProfileId) {
        return jsonResponse({ success: false, error: "Não foi possível obter um perfil do Late" });
      }

      // Save profile ID to connection
      ctx.step = "save_connection";
      await supabaseAdmin
        .from("late_connections")
        .upsert({
          tenant_id,
          late_profile_id: lateProfileId,
          late_profile_name: profileName,
          status: "connecting",
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id" });
    }

    // Update status to connecting
    ctx.step = "update_status";
    await supabaseAdmin
      .from("late_connections")
      .update({ 
        status: "connecting",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id);

    // Generate state token
    ctx.step = "create_state";
    const stateToken = crypto.randomUUID();

    // Determine callback URL
    // CRITICAL: Pass state in PATH, not query string!
    // Late/Facebook rewrites query params, losing the state.
    // Format: /late-auth-callback/{platform}/{stateToken}
    const functionUrl = `${supabaseUrl}/functions/v1/late-auth-callback`;
    const lateRedirectUrl = `${functionUrl}/${selectedPlatform}/${stateToken}`;

    // Save state with platform info
    const { error: stateError } = await supabaseAdmin
      .from("late_onboarding_states")
      .insert({
        tenant_id,
        state_token: stateToken,
        redirect_url: redirect_url || "/integrations",
        metadata: { platform: selectedPlatform },
      });

    if (stateError) {
      log({ ...ctx, error: stateError.message }, "Failed to save state");
      return jsonResponse({ success: false, error: "Erro ao iniciar conexão" });
    }

    // Get OAuth URL from Late for the selected platform
    ctx.step = "get_connect_url";
    log(ctx, `Getting connect URL for platform: ${selectedPlatform}`);
    
    const { authUrl, error: connectError } = await getConnectUrl(
      lateApiKey,
      selectedPlatform,
      lateProfileId,
      lateRedirectUrl
    );

    if (connectError || !authUrl) {
      log({ ...ctx, error: connectError || "No authUrl returned" }, "Failed to get connect URL");
      // Reset status
      await supabaseAdmin
        .from("late_connections")
        .update({ status: "disconnected", last_error: "Failed to get connect URL" })
        .eq("tenant_id", tenant_id);
      return jsonResponse({ success: false, error: "Erro ao obter URL de autorização do Late" });
    }

    log(ctx, `Got authUrl, redirecting user`);

    return jsonResponse({
      success: true,
      connect_url: authUrl, // URL para onde o frontend deve redirecionar/abrir popup
      state: stateToken,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    log({ ...ctx, error: message }, "Unhandled exception");
    return jsonResponse({ success: false, error: message });
  }
});

function jsonResponse(data: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
