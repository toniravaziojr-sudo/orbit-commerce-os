import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: sync, list, scripts actions
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const TAG_MANAGER_API = "https://www.googleapis.com/tagmanager/v2";

Deno.serve(async (req) => {
  console.log(`[google-tag-manager][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, tenantId } = body;

    if (!tenantId) {
      return jsonResponse({ success: false, error: "tenantId obrigatório" });
    }

    // Fetch connection
    const { data: connection, error: connError } = await supabase
      .from('google_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (connError || !connection) {
      return jsonResponse({ success: false, error: "Google não conectado" });
    }

    // Check scope
    const scopePacks: string[] = connection.scope_packs || [];
    if (!scopePacks.includes('tag_manager')) {
      return jsonResponse({ success: false, error: "Scope pack 'tag_manager' não habilitado" });
    }

    const accessToken = connection.access_token;

    switch (action) {
      case 'sync':
        return await handleSync(supabase, tenantId, accessToken);
      case 'list':
        return await handleList(supabase, tenantId);
      case 'scripts':
        return await handleScripts(supabase, tenantId, accessToken, body);
      default:
        return jsonResponse({ success: false, error: `Ação inválida: ${action}` });
    }
  } catch (err) {
    console.error(`[google-tag-manager][${VERSION}] Error:`, err);
    return jsonResponse({ success: false, error: err.message || "Erro interno" });
  }
});

// ===== SYNC: Fetch accounts + containers from GTM API =====
async function handleSync(supabase: any, tenantId: string, accessToken: string) {
  console.log(`[google-tag-manager][${VERSION}] Syncing containers for tenant ${tenantId}`);

  // 1. List accounts
  const accountsRes = await fetch(`${TAG_MANAGER_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const accountsText = await accountsRes.text();
  if (!accountsRes.ok) {
    console.error(`[google-tag-manager] Accounts API error: ${accountsText}`);
    return jsonResponse({ success: false, error: `Erro ao listar contas: ${accountsRes.status}` });
  }

  const accountsData = JSON.parse(accountsText);
  const accounts = accountsData.account || [];

  if (accounts.length === 0) {
    return jsonResponse({ success: true, data: { synced: 0, message: "Nenhuma conta GTM encontrada" } });
  }

  let totalSynced = 0;

  // 2. For each account, list containers
  for (const account of accounts) {
    const accountId = account.accountId;
    const accountName = account.name;
    const accountPath = account.path; // accounts/123456

    const containersRes = await fetch(`${TAG_MANAGER_API}/${accountPath}/containers`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const containersText = await containersRes.text();
    if (!containersRes.ok) {
      console.warn(`[google-tag-manager] Containers API error for account ${accountId}: ${containersText}`);
      continue;
    }

    const containersData = JSON.parse(containersText);
    const containers = containersData.container || [];

    for (const container of containers) {
      const { error: upsertError } = await supabase
        .from('google_tag_manager_containers')
        .upsert({
          tenant_id: tenantId,
          account_id: accountId,
          account_name: accountName,
          container_id: container.containerId,
          container_name: container.name,
          container_public_id: container.publicId || null,
          domain_name: container.domainName || [],
          usage_context: container.usageContext || [],
          tag_manager_url: container.tagManagerUrl || null,
          fingerprint: container.fingerprint || null,
          is_active: true,
          last_sync_at: new Date().toISOString(),
          metadata: {
            path: container.path,
            tag_ids: container.tagIds || [],
            notes: container.notes || null,
          },
        }, {
          onConflict: 'tenant_id,account_id,container_id',
        });

      if (upsertError) {
        console.error(`[google-tag-manager] Upsert error for container ${container.containerId}:`, upsertError);
      } else {
        totalSynced++;
      }
    }
  }

  // Update last_sync_at on connection
  await supabase
    .from('google_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  console.log(`[google-tag-manager][${VERSION}] Synced ${totalSynced} containers`);
  return jsonResponse({ success: true, data: { synced: totalSynced } });
}

// ===== LIST: Return cached containers from DB =====
async function handleList(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from('google_tag_manager_containers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('account_name', { ascending: true });

  if (error) {
    console.error(`[google-tag-manager] List error:`, error);
    return jsonResponse({ success: false, error: error.message });
  }

  return jsonResponse({ success: true, data: data || [] });
}

// ===== SCRIPTS: Get container snippet for installation =====
async function handleScripts(supabase: any, tenantId: string, accessToken: string, body: any) {
  const { accountId, containerId } = body;

  if (!accountId || !containerId) {
    return jsonResponse({ success: false, error: "accountId e containerId obrigatórios" });
  }

  // Fetch container environments to get the snippet
  const envPath = `${TAG_MANAGER_API}/accounts/${accountId}/containers/${containerId}/environments`;
  const envRes = await fetch(envPath, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const envText = await envRes.text();
  if (!envRes.ok) {
    console.error(`[google-tag-manager] Environments API error: ${envText}`);
    return jsonResponse({ success: false, error: `Erro ao buscar snippets: ${envRes.status}` });
  }

  const envData = JSON.parse(envText);
  const environments = envData.environment || [];

  // Find the "Live" environment
  const liveEnv = environments.find((e: any) => e.type === 'live') || environments[0];

  if (!liveEnv) {
    return jsonResponse({ success: false, error: "Nenhum environment encontrado" });
  }

  // Fetch the container to get the publicId for snippet generation
  const { data: containerData } = await supabase
    .from('google_tag_manager_containers')
    .select('container_public_id')
    .eq('tenant_id', tenantId)
    .eq('account_id', accountId)
    .eq('container_id', containerId)
    .maybeSingle();

  const publicId = containerData?.container_public_id || `GTM-${containerId}`;

  // Generate standard GTM snippets
  const headSnippet = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${publicId}');</script>
<!-- End Google Tag Manager -->`;

  const bodySnippet = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${publicId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

  return jsonResponse({
    success: true,
    data: {
      publicId,
      headSnippet,
      bodySnippet,
      environment: {
        name: liveEnv.name,
        type: liveEnv.type,
        authorizationCode: liveEnv.authorizationCode || null,
      },
    },
  });
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
