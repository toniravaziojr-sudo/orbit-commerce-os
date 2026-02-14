import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Initial Google Hub OAuth callback
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const appUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";

  try {
    console.log(`[google-oauth-callback][${VERSION}] Callback received`);

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error(`[google-oauth-callback][${VERSION}] OAuth error: ${error}`);
      return redirectWithResult(appUrl, false, `Erro OAuth: ${error}`);
    }

    if (!code || !state) {
      return redirectWithResult(appUrl, false, "Parâmetros inválidos");
    }

    // Validate state (anti-CSRF)
    const { data: stateData, error: stateError } = await supabase
      .from("google_oauth_states")
      .select("*")
      .eq("state", state)
      .single();

    if (stateError || !stateData) {
      console.error(`[google-oauth-callback][${VERSION}] Invalid state`);
      return redirectWithResult(appUrl, false, "Estado inválido ou expirado");
    }

    // Check expiry
    if (new Date(stateData.expires_at) < new Date()) {
      await supabase.from("google_oauth_states").delete().eq("id", stateData.id);
      return redirectWithResult(appUrl, false, "Autorização expirada. Tente novamente.");
    }

    const { tenant_id, user_id, scope_packs, return_path } = stateData;

    // Delete used state
    await supabase.from("google_oauth_states").delete().eq("id", stateData.id);

    // Get credentials
    const [clientId, clientSecret] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_SECRET"),
    ]);

    if (!clientId || !clientSecret) {
      return redirectWithResult(appUrl, false, "Credenciais Google não configuradas");
    }

    // Exchange code for tokens
    const callbackUrl = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenText = await tokenResponse.text();
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error(`[google-oauth-callback][${VERSION}] Token parse error:`, tokenText);
      return redirectWithResult(appUrl, false, "Erro ao processar resposta do Google");
    }

    if (!tokenResponse.ok || tokenData.error) {
      console.error(`[google-oauth-callback][${VERSION}] Token error:`, tokenData);
      return redirectWithResult(appUrl, false, tokenData.error_description || "Erro ao obter tokens");
    }

    const { access_token, refresh_token, expires_in, scope: grantedScopeStr } = tokenData;

    if (!access_token) {
      return redirectWithResult(appUrl, false, "Access token não recebido");
    }

    const grantedScopes = grantedScopeStr ? grantedScopeStr.split(" ") : [];
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // Get user info
    let googleUserInfo: any = {};
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userInfoText = await userInfoRes.text();
      googleUserInfo = JSON.parse(userInfoText);
    } catch (e) {
      console.warn(`[google-oauth-callback][${VERSION}] UserInfo fetch failed:`, e);
    }

    // Discover assets based on scope packs
    const assets: Record<string, any> = {};

    for (const pack of scope_packs) {
      try {
        const packAssets = await discoverAssets(pack, access_token, supabaseUrl, supabaseServiceKey);
        Object.assign(assets, packAssets);
      } catch (e) {
        console.warn(`[google-oauth-callback][${VERSION}] Asset discovery failed for ${pack}:`, e);
      }
    }

    // Upsert connection (1 per tenant)
    const connectionData = {
      tenant_id,
      connected_by: user_id,
      google_user_id: googleUserInfo.id || null,
      google_email: googleUserInfo.email || null,
      display_name: googleUserInfo.name || null,
      avatar_url: googleUserInfo.picture || null,
      access_token,
      refresh_token: refresh_token || null,
      token_expires_at: tokenExpiresAt,
      scope_packs,
      granted_scopes: grantedScopes,
      is_active: true,
      connection_status: "connected",
      last_error: null,
      last_sync_at: new Date().toISOString(),
      assets,
      metadata: {
        connected_at: new Date().toISOString(),
        id_token: tokenData.id_token || null,
      },
    };

    // Check if existing connection - merge scope_packs and refresh_token
    const { data: existing } = await supabase
      .from("google_connections")
      .select("id, scope_packs, refresh_token, assets, granted_scopes")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (existing) {
      // Merge packs, scopes, assets, and preserve refresh_token
      const mergedPacks = [...new Set([...(existing.scope_packs || []), ...scope_packs])];
      const mergedScopes = [...new Set([...(existing.granted_scopes || []), ...grantedScopes])];
      const mergedAssets = { ...(existing.assets || {}), ...assets };

      const { error: updateError } = await supabase
        .from("google_connections")
        .update({
          ...connectionData,
          scope_packs: mergedPacks,
          granted_scopes: mergedScopes,
          assets: mergedAssets,
          // CRITICAL: Never lose refresh_token
          refresh_token: refresh_token || existing.refresh_token,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error(`[google-oauth-callback][${VERSION}] Update error:`, updateError);
        return redirectWithResult(appUrl, false, "Erro ao salvar conexão");
      }
    } else {
      const { error: insertError } = await supabase
        .from("google_connections")
        .insert(connectionData);

      if (insertError) {
        console.error(`[google-oauth-callback][${VERSION}] Insert error:`, insertError);
        return redirectWithResult(appUrl, false, "Erro ao salvar conexão");
      }
    }

    console.log(`[google-oauth-callback][${VERSION}] Connection saved for tenant ${tenant_id}, packs: ${scope_packs.join(", ")}`);

    // Redirect with success - use HTML page that posts message to opener
    return new Response(
      generateCallbackHtml(true, googleUserInfo.name || googleUserInfo.email || "Google", return_path || "/integrations"),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );

  } catch (error) {
    console.error(`[google-oauth-callback][${VERSION}] Error:`, error);
    return redirectWithResult(appUrl, false, error instanceof Error ? error.message : "Erro interno");
  }
});

// Asset discovery per pack
async function discoverAssets(
  pack: string,
  accessToken: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
): Promise<Record<string, any>> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  switch (pack) {
    case "youtube": {
      try {
        const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers });
        const text = await res.text();
        const data = JSON.parse(text);
        return {
          youtube_channels: (data.items || []).map((ch: any) => ({
            id: ch.id,
            title: ch.snippet?.title,
            thumbnail_url: ch.snippet?.thumbnails?.default?.url,
            subscriber_count: parseInt(ch.statistics?.subscriberCount || "0"),
          })),
        };
      } catch { return {}; }
    }

    case "analytics": {
      try {
        const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", { headers });
        const text = await res.text();
        const data = JSON.parse(text);
        const properties: any[] = [];
        for (const account of (data.accountSummaries || [])) {
          for (const prop of (account.propertySummaries || [])) {
            properties.push({
              id: prop.property,
              name: prop.displayName,
              measurement_id: null, // Would need data streams API
            });
          }
        }
        return { analytics_properties: properties };
      } catch { return {}; }
    }

    case "search_console": {
      try {
        const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers });
        const text = await res.text();
        const data = JSON.parse(text);
        return {
          search_console_sites: (data.siteEntry || []).map((s: any) => ({
            url: s.siteUrl,
            permission_level: s.permissionLevel,
          })),
        };
      } catch { return {}; }
    }

    case "merchant": {
      try {
        const res = await fetch("https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo", { headers });
        const text = await res.text();
        const data = JSON.parse(text);
        return {
          merchant_accounts: (data.accountIdentifiers || []).map((a: any) => ({
            id: a.merchantId || a.aggregatorId,
            name: a.merchantId ? `Merchant ${a.merchantId}` : `Aggregator ${a.aggregatorId}`,
          })),
        };
      } catch { return {}; }
    }

    case "ads": {
      try {
        // Google Ads requires Developer Token
        const devToken = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_DEVELOPER_TOKEN");
        if (!devToken) return { ad_accounts: [], ads_note: "Developer Token não configurado" };

        const res = await fetch("https://googleads.googleapis.com/v18/customers:listAccessibleCustomers", {
          headers: {
            ...headers,
            "developer-token": devToken,
          },
        });
        const text = await res.text();
        const data = JSON.parse(text);
        return {
          ad_accounts: (data.resourceNames || []).map((name: string) => ({
            id: name.replace("customers/", ""),
            name: name,
          })),
        };
      } catch { return {}; }
    }

    case "tag_manager": {
      try {
        const res = await fetch("https://www.googleapis.com/tagmanager/v2/accounts", { headers });
        const text = await res.text();
        const data = JSON.parse(text);
        return {
          tag_manager_accounts: (data.account || []).map((a: any) => ({
            id: a.accountId,
            name: a.name,
          })),
        };
      } catch { return {}; }
    }

    case "business": {
      try {
        const res = await fetch("https://mybusinessbusinessinformation.googleapis.com/v1/accounts", { headers });
        const text = await res.text();
        const data = JSON.parse(text);
        return {
          business_locations: (data.accounts || []).map((a: any) => ({
            name: a.accountName || a.name,
            location_id: a.name,
          })),
        };
      } catch { return {}; }
    }

    default:
      return {};
  }
}

function redirectWithResult(appUrl: string, success: boolean, message: string) {
  return new Response(
    generateCallbackHtml(success, message, "/integrations"),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function generateCallbackHtml(success: boolean, message: string, returnPath: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Google OAuth</title></head>
<body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({
        type: "google:connected",
        success: ${success},
        ${success ? `account: "${message.replace(/"/g, '\\"')}"` : `error: "${message.replace(/"/g, '\\"')}"`}
      }, "*");
      window.close();
    } else {
      window.location.href = "${returnPath}?google_connected=${success}&${success ? "" : `google_error=${encodeURIComponent(message)}`}";
    }
  } catch(e) {
    window.location.href = "${returnPath}";
  }
</script>
<p>${success ? "Conectado! Fechando..." : message}</p>
</body>
</html>`;
}
