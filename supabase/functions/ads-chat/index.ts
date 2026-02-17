import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v4.2.0"; // Add create_meta_campaign tool: full campaign creation (Campaign→AdSet→Ad) with creative from Drive
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ============ TOOL DEFINITIONS ============

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_campaign_performance",
      description: "Busca performance real das campanhas (métricas dos últimos 7 dias). Use para responder sobre performance, ROAS, CPA, etc.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta de anúncios (opcional, busca todas se omitido)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_creative_assets",
      description: "Lista os criativos existentes (imagens/copy gerados). Use para verificar status de criativos.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "ready", "active", "rejected"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_creative_generation",
      description: "Dispara a geração REAL de briefs criativos (headlines + copy) para os top produtos por receita. Gera textos estratégicos (roteiros, headlines, copy). Para gerar IMAGENS use generate_creative_image.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_creative_image",
      description: "Gera IMAGENS reais de criativos para anúncios usando IA (Gemini). Cria imagens publicitárias baseadas no produto selecionado. Use quando o usuário pedir para gerar imagens, artes, criativos visuais ou quando precisar de mídia para campanhas.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nome do produto do catálogo real (obrigatório)" },
          channel: { type: "string", enum: ["meta", "google", "tiktok"], description: "Canal de destino (default: meta)" },
          campaign_objective: { type: "string", enum: ["sales", "leads", "traffic", "awareness"], description: "Objetivo da campanha" },
          target_audience: { type: "string", description: "Descrição do público-alvo" },
          style_preference: { type: "string", enum: ["promotional", "product_natural", "person_interacting"], description: "Estilo visual (default: promotional)" },
          format: { type: "string", enum: ["1:1", "9:16", "16:9"], description: "Formato da imagem (default: 1:1)" },
          variations: { type: "number", description: "Número de variações (1-4, default: 2)" },
        },
        required: ["product_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_meta_campaign",
      description: "Cria uma campanha COMPLETA no Meta Ads (Campanha → Conjunto de Anúncios → Anúncio com criativo). Busca automaticamente criativos prontos do Drive/galeria para o produto. A campanha é criada PAUSADA e agendada para ativação em 00:01-04:00 BRT. Use quando o usuário pedir para criar/montar/publicar uma campanha.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nome do produto do catálogo (obrigatório)" },
          campaign_name: { type: "string", description: "Nome da campanha (opcional, gerado automaticamente se omitido)" },
          objective: { type: "string", enum: ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"], description: "Objetivo da campanha (default: OUTCOME_SALES)" },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos (default: 3000 = R$30)" },
          targeting_description: { type: "string", description: "Descrição do público-alvo para segmentação" },
          funnel_stage: { type: "string", enum: ["cold", "warm", "hot"], description: "Estágio do funil (default: cold)" },
          ad_account_id: { type: "string", description: "ID da conta de anúncios Meta (opcional, usa a primeira disponível)" },
        },
        required: ["product_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_autopilot_analysis",
      description: "Dispara uma análise completa do Autopilot (Motor Guardião). Só use quando o usuário pedir para rodar uma análise ou auditoria.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["meta", "google", "tiktok"], description: "Canal para análise" },
        },
        required: ["channel"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_actions",
      description: "Lista as ações executadas ou agendadas pelo Autopilot. Use para mostrar o que a IA de tráfego está fazendo de verdade.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["scheduled", "executed", "failed", "pending_approval"], description: "Filtrar por status" },
          limit: { type: "number", description: "Quantidade de ações (default 15)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_insights",
      description: "Lista os insights e diagnósticos gerados pelo Autopilot.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "resolved"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_url",
      description: "Analisa o conteúdo de uma URL (landing page, concorrente, anúncio, artigo). Extrai texto, estrutura e informações relevantes. Use quando o usuário enviar um link ou pedir para analisar uma página.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL completa para analisar" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_google_campaigns",
      description: "Busca campanhas e performance do Google Ads. Use para perguntas sobre Google Ads.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta Google Ads (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tiktok_campaigns",
      description: "Busca campanhas e performance do TikTok Ads. Use para perguntas sobre TikTok Ads.",
      parameters: {
        type: "object",
        properties: {
          advertiser_id: { type: "string", description: "ID do advertiser TikTok (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_meta_adsets",
      description: "Lista os conjuntos de anúncios (Ad Sets) da Meta com status, orçamento, segmentação e pixel. Use para perguntas detalhadas sobre conjuntos.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional)" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED", "DELETED"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_meta_ads",
      description: "Lista os anúncios individuais da Meta com status e criativos vinculados. Use para detalhes de anúncios específicos.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_audiences",
      description: "Lista os públicos/audiências configurados (Meta e Google). Use para perguntas sobre segmentação.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["meta", "google"], description: "Canal (default: todos)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_config",
      description: "Retorna as configurações atuais do Autopilot (globais e por conta). Use para mostrar settings, ROI alvo, modo de aprovação, orçamento, etc.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta específica (opcional, retorna todas se omitido)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_autopilot_config",
      description: "Atualiza configurações do Autopilot para uma conta específica. Use APENAS quando o usuário pedir explicitamente para alterar configurações (ROI, orçamento, estratégia, etc).",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta de anúncios" },
          channel: { type: "string", description: "Canal da conta" },
          updates: {
            type: "object",
            description: "Campos a atualizar",
            properties: {
              target_roi: { type: "number", description: "ROI alvo (ex: 3.0)" },
              budget_cents: { type: "number", description: "Orçamento diário em centavos" },
              strategy_mode: { type: "string", enum: ["conservative", "balanced", "aggressive"], description: "Modo de estratégia" },
              is_ai_enabled: { type: "boolean", description: "Ativar/desativar IA" },
              user_instructions: { type: "string", description: "Instruções estratégicas do lojista" },
              human_approval_mode: { type: "string", enum: ["auto", "high_impact"], description: "Modo de aprovação" },
            },
          },
        },
        required: ["ad_account_id", "channel", "updates"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_experiments",
      description: "Lista os experimentos/testes A/B em andamento ou finalizados.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "running", "completed", "cancelled"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tracking_health",
      description: "Retorna o status de saúde do tracking/pixel (Meta, Google, TikTok). Use para diagnosticar problemas de rastreamento.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_sessions",
      description: "Lista as sessões de execução do Autopilot (histórico de análises). Mostra quando rodou, quantas ações fez, custo, etc.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade (default 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// ============ TOOL EXECUTORS ============

async function executeTool(
  supabase: any,
  tenantId: string,
  toolName: string,
  args: any
): Promise<string> {
  try {
    switch (toolName) {
      case "get_campaign_performance":
        return await getCampaignPerformance(supabase, tenantId, args.ad_account_id);
      case "get_creative_assets":
        return await getCreativeAssets(supabase, tenantId, args.status);
      case "trigger_creative_generation":
        return await triggerCreativeGeneration(supabase, tenantId);
      case "generate_creative_image":
        return await generateCreativeImage(supabase, tenantId, args);
      case "create_meta_campaign":
        return await createMetaCampaign(supabase, tenantId, args);
      case "trigger_autopilot_analysis":
        return await triggerAutopilotAnalysis(supabase, tenantId, args.channel);
      case "get_autopilot_actions":
        return await getAutopilotActions(supabase, tenantId, args.status, args.limit);
      case "get_autopilot_insights":
        return await getAutopilotInsights(supabase, tenantId, args.status);
      case "analyze_url":
        return await analyzeUrl(args.url);
      case "get_google_campaigns":
        return await getGoogleCampaigns(supabase, tenantId, args.ad_account_id);
      case "get_tiktok_campaigns":
        return await getTikTokCampaigns(supabase, tenantId, args.advertiser_id);
      case "get_meta_adsets":
        return await getMetaAdsets(supabase, tenantId, args.ad_account_id, args.status);
      case "get_meta_ads":
        return await getMetaAds(supabase, tenantId, args.ad_account_id);
      case "get_audiences":
        return await getAudiences(supabase, tenantId, args.channel);
      case "get_autopilot_config":
        return await getAutopilotConfig(supabase, tenantId, args.ad_account_id);
      case "update_autopilot_config":
        return await updateAutopilotConfig(supabase, tenantId, args.ad_account_id, args.channel, args.updates);
      case "get_experiments":
        return await getExperiments(supabase, tenantId, args.status);
      case "get_tracking_health":
        return await getTrackingHealth(supabase, tenantId);
      case "get_autopilot_sessions":
        return await getAutopilotSessions(supabase, tenantId, args.limit);
      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`[ads-chat][${VERSION}] Tool error (${toolName}):`, err);
    return JSON.stringify({ error: err.message || "Erro ao executar ferramenta" });
  }
}

async function getCampaignPerformance(supabase: any, tenantId: string, adAccountId?: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const campQuery = supabase
    .from("meta_ad_campaigns")
    .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
    .eq("tenant_id", tenantId);
  if (adAccountId) campQuery.eq("ad_account_id", adAccountId);
  const { data: campaigns } = await campQuery.limit(30);

  const insightQuery = supabase
    .from("meta_ad_insights")
    .select("meta_campaign_id, spend_cents, impressions, clicks, conversions, roas, ctr, cpc_cents, cpm_cents, date_start")
    .eq("tenant_id", tenantId)
    .gte("date_start", sevenDaysAgo);
  const { data: insights } = await insightQuery.limit(500);

  const campMap: Record<string, any> = {};
  for (const c of (campaigns || [])) {
    campMap[c.meta_campaign_id] = {
      name: c.name, status: c.status, objective: c.objective,
      daily_budget: `R$ ${((c.daily_budget_cents || 0) / 100).toFixed(2)}`,
      spend_7d: 0, impressions_7d: 0, clicks_7d: 0, conversions_7d: 0, roas_avg: 0, days_with_data: 0,
    };
  }

  for (const i of (insights || [])) {
    const c = campMap[i.meta_campaign_id];
    if (!c) continue;
    c.spend_7d += (i.spend_cents || 0) / 100;
    c.impressions_7d += i.impressions || 0;
    c.clicks_7d += i.clicks || 0;
    c.conversions_7d += i.conversions || 0;
    c.days_with_data += 1;
    if (i.roas) c.roas_avg = i.roas;
  }

  const result = Object.values(campMap).map((c: any) => ({
    ...c,
    spend_7d: `R$ ${c.spend_7d.toFixed(2)}`,
    cpa: c.conversions_7d > 0 ? `R$ ${(c.spend_7d / c.conversions_7d).toFixed(2)}` : "N/A",
  }));

  return JSON.stringify({
    total_campaigns: campaigns?.length || 0,
    active: (campaigns || []).filter((c: any) => c.status === "ACTIVE").length,
    paused: (campaigns || []).filter((c: any) => c.status === "PAUSED").length,
    campaigns: result,
  });
}

async function getCreativeAssets(supabase: any, tenantId: string, status?: string) {
  const query = supabase
    .from("ads_creative_assets")
    .select("id, headline, copy_text, format, status, angle, channel, asset_url, storage_path, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    assets: (data || []).map((a: any) => ({
      id: a.id, headline: a.headline, copy: a.copy_text?.substring(0, 100),
      format: a.format, status: a.status, angle: a.angle, channel: a.channel,
      has_image: !!(a.asset_url || a.storage_path), created_at: a.created_at,
    })),
  });
}

async function triggerCreativeGeneration(supabase: any, tenantId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-creative-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    const result = await response.text();
    let parsed;
    try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }
    if (!response.ok) {
      return JSON.stringify({ success: false, error: `Falha ao gerar criativos (HTTP ${response.status})`, details: parsed });
    }
    return JSON.stringify({ success: true, message: "Geração de briefs criativos disparada com sucesso.", details: parsed });
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

async function generateCreativeImage(supabase: any, tenantId: string, args: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    // Find product by name in catalog
    const { data: products } = await supabase
      .from("products")
      .select("id, name, images")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    const product = (products || []).find((p: any) => 
      p.name.toLowerCase().includes((args.product_name || "").toLowerCase())
    ) || products?.[0];

    if (!product) {
      return JSON.stringify({ success: false, error: "Produto não encontrado no catálogo. Verifique o nome e tente novamente." });
    }

    // Resolve product image
    let productImageUrl: string | null = null;
    if (product.images) {
      const images = Array.isArray(product.images) ? product.images : [];
      const firstImg = images[0];
      productImageUrl = typeof firstImg === "string" ? firstImg : (firstImg as any)?.url || null;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-creative`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        tenant_id: tenantId,
        channel: args.channel || "meta",
        product_id: product.id,
        product_name: product.name,
        product_image_url: productImageUrl,
        campaign_objective: args.campaign_objective || "sales",
        target_audience: args.target_audience,
        style_preference: args.style_preference || "promotional",
        format: args.format || "1:1",
        variations: Math.min(args.variations || 2, 4),
      }),
    });

    const result = await response.text();
    let parsed;
    try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }

    if (!response.ok || !parsed?.success) {
      return JSON.stringify({ success: false, error: `Falha ao gerar imagens (HTTP ${response.status})`, details: parsed });
    }

    return JSON.stringify({
      success: true,
      message: `Geração de ${args.variations || 2} imagem(ns) criativa(s) disparada com sucesso para "${product.name}". As imagens estão sendo geradas via IA e ficarão disponíveis na pasta "Gestor de Tráfego IA" do Drive e na galeria de criativos.`,
      job_id: parsed?.data?.job_id,
      product_name: product.name,
      style: args.style_preference || "promotional",
      format: args.format || "1:1",
    });
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

async function createMetaCampaign(supabase: any, tenantId: string, args: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` };

  try {
    // 1. Find the product
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    const product = (products || []).find((p: any) =>
      p.name.toLowerCase().includes((args.product_name || "").toLowerCase())
    ) || products?.[0];

    if (!product) {
      return JSON.stringify({ success: false, error: "Produto não encontrado no catálogo." });
    }

    // 2. Get Meta connection and ad account
    const { data: conn } = await supabase
      .from("marketplace_connections")
      .select("access_token, metadata")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta")
      .eq("is_active", true)
      .maybeSingle();

    if (!conn) {
      return JSON.stringify({ success: false, error: "Meta não conectada. Configure a integração Meta primeiro." });
    }

    const adAccounts = conn.metadata?.assets?.ad_accounts || [];
    const adAccountId = args.ad_account_id || adAccounts[0]?.id;
    if (!adAccountId) {
      return JSON.stringify({ success: false, error: "Nenhuma conta de anúncios Meta encontrada." });
    }

    // 3. Find ready creative for this product (from ads_creative_assets or meta_ad_creatives)
    const { data: creativeAssets } = await supabase
      .from("ads_creative_assets")
      .select("id, asset_url, storage_path, headline, copy_text, cta_type, product_id")
      .eq("tenant_id", tenantId)
      .eq("product_id", product.id)
      .in("status", ["ready", "draft"])
      .order("created_at", { ascending: false })
      .limit(5);

    let creativeImageUrl: string | null = null;
    let creativeHeadline: string | null = null;
    let creativeCopy: string | null = null;

    if (creativeAssets && creativeAssets.length > 0) {
      const best = creativeAssets.find((c: any) => c.asset_url) || creativeAssets[0];
      creativeImageUrl = best.asset_url || null;
      creativeHeadline = best.headline || null;
      creativeCopy = best.copy_text || null;

      // If no URL but has storage_path, build signed URL
      if (!creativeImageUrl && best.storage_path) {
        const { data: signedData } = await supabase.storage
          .from("files")
          .createSignedUrl(best.storage_path, 86400 * 30); // 30 days
        if (signedData?.signedUrl) creativeImageUrl = signedData.signedUrl;
      }
    }

    // 4. Fallback: check files in Drive "Gestor de Tráfego IA" folder
    if (!creativeImageUrl) {
      const { data: folder } = await supabase
        .from("files")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("filename", "Gestor de Tráfego IA")
        .eq("is_folder", true)
        .maybeSingle();

      if (folder) {
        const { data: driveFiles } = await supabase
          .from("files")
          .select("id, url, storage_path, filename")
          .eq("tenant_id", tenantId)
          .eq("folder_id", folder.id)
          .eq("is_folder", false)
          .order("created_at", { ascending: false })
          .limit(5);

        const imageFile = (driveFiles || []).find((f: any) =>
          f.url || f.storage_path
        );
        if (imageFile) {
          creativeImageUrl = imageFile.url || null;
          if (!creativeImageUrl && imageFile.storage_path) {
            const { data: signedData } = await supabase.storage
              .from("files")
              .createSignedUrl(imageFile.storage_path, 86400 * 30);
            if (signedData?.signedUrl) creativeImageUrl = signedData.signedUrl;
          }
        }
      }
    }

    // 5. Fallback: product image
    if (!creativeImageUrl) {
      const { data: prodImages } = await supabase
        .from("product_images")
        .select("url")
        .eq("product_id", product.id)
        .order("position", { ascending: true })
        .limit(1);
      if (prodImages?.[0]?.url) creativeImageUrl = prodImages[0].url;
    }

    if (!creativeImageUrl) {
      return JSON.stringify({
        success: false,
        error: "Nenhum criativo ou imagem disponível para este produto. Gere criativos primeiro usando generate_creative_image.",
      });
    }

    // 6. Get pixel from marketing_integrations
    const { data: mktIntegration } = await supabase
      .from("marketing_integrations")
      .select("meta_pixel_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const pixelId = mktIntegration?.meta_pixel_id || null;

    // 7. Get page for creative
    const pages = conn.metadata?.assets?.pages || [];
    const pageId = pages[0]?.id || null;
    const pageAccessToken = pages[0]?.access_token || conn.access_token;

    // 8. Upload image to Meta and create ad creative
    const accountIdClean = adAccountId.replace("act_", "");

    // Upload image hash
    const imageHashResult = await fetch(
      `https://graph.facebook.com/v21.0/act_${accountIdClean}/adimages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: creativeImageUrl,
          access_token: conn.access_token,
        }),
      }
    );
    const imageHashData = await imageHashResult.json();
    const imageHash = imageHashData?.images?.[Object.keys(imageHashData?.images || {})[0]]?.hash;

    if (!imageHash) {
      console.error(`[ads-chat][${VERSION}] Image upload failed:`, JSON.stringify(imageHashData));
      return JSON.stringify({
        success: false,
        error: "Falha ao enviar imagem para o Meta. Tente novamente.",
        details: imageHashData?.error?.message || "Hash não retornado",
      });
    }

    // Create ad creative on Meta
    const objective = args.objective || "OUTCOME_SALES";
    const creativeName = `[AI] ${product.name} - ${new Date().toISOString().split("T")[0]}`;
    const creativeBody: any = {
      name: creativeName,
      access_token: conn.access_token,
    };

    if (pageId) {
      creativeBody.object_story_spec = {
        page_id: pageId,
        link_data: {
          image_hash: imageHash,
          message: creativeCopy || `Conheça ${product.name}! Aproveite agora.`,
          name: creativeHeadline || product.name,
          call_to_action: {
            type: objective === "OUTCOME_SALES" ? "SHOP_NOW" : "LEARN_MORE",
          },
        },
      };
    } else {
      creativeBody.image_hash = imageHash;
      creativeBody.title = creativeHeadline || product.name;
      creativeBody.body = creativeCopy || `Conheça ${product.name}!`;
    }

    const creativeResult = await fetch(
      `https://graph.facebook.com/v21.0/act_${accountIdClean}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creativeBody),
      }
    );
    const creativeData = await creativeResult.json();

    if (creativeData.error) {
      console.error(`[ads-chat][${VERSION}] Creative creation failed:`, creativeData.error);
      return JSON.stringify({
        success: false,
        error: `Falha ao criar criativo: ${creativeData.error.message}`,
      });
    }

    const metaCreativeId = creativeData.id;
    console.log(`[ads-chat][${VERSION}] Creative created: ${metaCreativeId}`);

    // 9. Create Campaign (PAUSED) via edge function
    const campName = args.campaign_name || `[AI] ${objective === "OUTCOME_SALES" ? "Vendas" : "Tráfego"} | ${product.name} | ${new Date().toISOString().split("T")[0]}`;
    const dailyBudgetCents = args.daily_budget_cents || 3000;

    const campResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        action: "create",
        ad_account_id: adAccountId,
        name: campName,
        objective,
        daily_budget_cents: dailyBudgetCents,
        status: "PAUSED",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      }),
    });
    const campResult = await campResponse.text();
    let campParsed: any;
    try { campParsed = JSON.parse(campResult); } catch { campParsed = { raw: campResult }; }

    if (!campParsed?.success) {
      return JSON.stringify({
        success: false,
        error: `Falha ao criar campanha: ${campParsed?.error || "Erro desconhecido"}`,
      });
    }

    const metaCampaignId = campParsed.data?.meta_campaign_id;
    console.log(`[ads-chat][${VERSION}] Campaign created: ${metaCampaignId}`);

    // 10. Create AdSet (PAUSED) with pixel
    const funnelStage = args.funnel_stage || "cold";
    const adsetName = `[AI] ${funnelStage} | ${args.targeting_description || "Brasil 18-65"} | ${product.name}`.substring(0, 200);

    const adsetBody: any = {
      tenant_id: tenantId,
      action: "create",
      ad_account_id: adAccountId,
      meta_campaign_id: metaCampaignId,
      name: adsetName,
      targeting: {
        geo_locations: { countries: ["BR"] },
        age_min: 18,
        age_max: 65,
      },
      status: "PAUSED",
    };

    // Add promoted_object for conversion campaigns
    if (pixelId && (objective === "OUTCOME_SALES" || objective === "OUTCOME_LEADS")) {
      adsetBody.promoted_object = {
        pixel_id: pixelId,
        custom_event_type: objective === "OUTCOME_SALES" ? "PURCHASE" : "LEAD",
      };
    }

    const adsetResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-adsets`, {
      method: "POST",
      headers,
      body: JSON.stringify(adsetBody),
    });
    const adsetResult = await adsetResponse.text();
    let adsetParsed: any;
    try { adsetParsed = JSON.parse(adsetResult); } catch { adsetParsed = { raw: adsetResult }; }

    const metaAdsetId = adsetParsed?.data?.meta_adset_id || null;
    console.log(`[ads-chat][${VERSION}] AdSet created: ${metaAdsetId}`);

    // 11. Create Ad (PAUSED) with the creative
    let metaAdId: string | null = null;
    if (metaAdsetId && metaCreativeId) {
      const adResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-ads`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          action: "create",
          ad_account_id: adAccountId,
          meta_adset_id: metaAdsetId,
          meta_campaign_id: metaCampaignId,
          name: `[AI] ${product.name} - Criativo 1`,
          creative_id: metaCreativeId,
          status: "PAUSED",
        }),
      });
      const adResult = await adResponse.text();
      let adParsed: any;
      try { adParsed = JSON.parse(adResult); } catch { adParsed = { raw: adResult }; }
      metaAdId = adParsed?.data?.meta_ad_id || null;
      console.log(`[ads-chat][${VERSION}] Ad created: ${metaAdId}`);
    }

    // 12. Schedule activation for 00:01-04:00 BRT
    const now = new Date();
    const utcHour = now.getUTCHours();
    const brtHour = utcHour - 3 < 0 ? utcHour - 3 + 24 : utcHour - 3;
    const scheduleDate = new Date(now);
    if (brtHour >= 0 && brtHour < 4) {
      scheduleDate.setMinutes(scheduleDate.getMinutes() + 5);
    } else {
      if (brtHour >= 4) scheduleDate.setDate(scheduleDate.getDate() + 1);
      const randomMinute = 1 + Math.floor(Math.random() * 59);
      scheduleDate.setUTCHours(3, randomMinute, 0, 0);
    }
    const scheduledFor = scheduleDate.toISOString();

    // Record scheduled activation action
    await supabase.from("ads_autopilot_actions").insert({
      tenant_id: tenantId,
      session_id: crypto.randomUUID(),
      channel: "meta",
      action_type: "activate_campaign",
      action_data: {
        campaign_id: metaCampaignId,
        adset_id: metaAdsetId,
        ad_id: metaAdId,
        ad_account_id: adAccountId,
        campaign_name: campName,
        product_name: product.name,
        creative_id: metaCreativeId,
        scheduled_for: scheduledFor,
        daily_budget_cents: dailyBudgetCents,
        created_by: "ads_chat",
      },
      reasoning: `Campanha completa criada via Chat IA para "${product.name}". Ativação agendada para ${scheduledFor} (00:01-04:00 BRT).`,
      status: "scheduled",
      action_hash: `chat_activate_${metaCampaignId}_${Date.now()}`,
    });

    return JSON.stringify({
      success: true,
      message: `Campanha completa criada com sucesso para "${product.name}"! A campanha foi criada PAUSADA e será ativada automaticamente na próxima janela (00:01-04:00 BRT).`,
      data: {
        campaign: { id: metaCampaignId, name: campName, status: "PAUSED" },
        adset: { id: metaAdsetId, name: adsetName, status: "PAUSED" },
        ad: { id: metaAdId, status: "PAUSED" },
        creative_id: metaCreativeId,
        daily_budget: `R$ ${(dailyBudgetCents / 100).toFixed(2)}`,
        scheduled_activation: scheduledFor,
        product: product.name,
        image_used: creativeImageUrl?.substring(0, 80) + "...",
      },
    });
  } catch (err: any) {
    console.error(`[ads-chat][${VERSION}] create_meta_campaign error:`, err);
    return JSON.stringify({ success: false, error: err.message || "Erro ao criar campanha" });
  }
}

async function triggerAutopilotAnalysis(supabase: any, tenantId: string, channel: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ tenant_id: tenantId, channel, trigger_type: "manual" }),
    });
    const result = await response.text();
    let parsed;
    try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }
    return JSON.stringify({
      success: response.ok,
      message: response.ok ? `Análise do Autopilot (${channel}) disparada.` : `Falha (HTTP ${response.status})`,
      details: parsed,
    });
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

async function getAutopilotActions(supabase: any, tenantId: string, status?: string, limit?: number) {
  const query = supabase
    .from("ads_autopilot_actions")
    .select("id, action_type, channel, status, reasoning, confidence, error_message, executed_at, created_at, action_data")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit || 15);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    actions: (data || []).map((a: any) => ({
      action_type: a.action_type, channel: a.channel, status: a.status,
      reasoning: a.reasoning?.substring(0, 200), confidence: a.confidence,
      error: a.error_message,
      campaign_name: a.action_data?.campaign_name,
      daily_budget: a.action_data?.daily_budget_cents ? `R$ ${(a.action_data.daily_budget_cents / 100).toFixed(2)}` : null,
      executed_at: a.executed_at, created_at: a.created_at,
    })),
  });
}

async function getAutopilotInsights(supabase: any, tenantId: string, status?: string) {
  const query = supabase
    .from("ads_autopilot_insights")
    .select("id, title, body, category, priority, sentiment, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(15);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ total: data?.length || 0, insights: data || [] });
}

// ============ NEW: URL ANALYSIS (Firecrawl) ============

async function analyzeUrl(url: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    return JSON.stringify({ error: "Firecrawl não configurado. Não é possível analisar URLs." });
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const result = await response.text();
    let parsed;
    try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }

    if (!response.ok) {
      return JSON.stringify({ error: `Falha ao analisar URL (HTTP ${response.status})`, details: parsed });
    }

    const markdown = parsed?.data?.markdown || "";
    const metadata = parsed?.data?.metadata || {};

    // Truncate to avoid context bloat
    const truncated = markdown.length > 3000 ? markdown.substring(0, 3000) + "\n\n[...conteúdo truncado]" : markdown;

    return JSON.stringify({
      success: true,
      url,
      title: metadata.title || "",
      description: metadata.description || "",
      content: truncated,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Erro ao acessar URL: ${err.message}` });
  }
}

// ============ NEW TOOL EXECUTORS (v4.0) ============

async function getGoogleCampaigns(supabase: any, tenantId: string, adAccountId?: string) {
  const query = supabase
    .from("google_ad_campaigns")
    .select("id, google_campaign_id, name, status, campaign_type, daily_budget_cents, ad_account_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  const { data: campaigns, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const { data: insights } = await supabase
    .from("google_ad_insights")
    .select("google_campaign_id, spend_cents, impressions, clicks, conversions, ctr, cpc_cents, date_start")
    .eq("tenant_id", tenantId)
    .gte("date_start", sevenDaysAgo)
    .limit(500);

  const insightMap: Record<string, any> = {};
  for (const i of (insights || [])) {
    if (!insightMap[i.google_campaign_id]) insightMap[i.google_campaign_id] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    const m = insightMap[i.google_campaign_id];
    m.spend += (i.spend_cents || 0) / 100;
    m.impressions += i.impressions || 0;
    m.clicks += i.clicks || 0;
    m.conversions += i.conversions || 0;
  }

  return JSON.stringify({
    total: campaigns?.length || 0,
    campaigns: (campaigns || []).map((c: any) => {
      const perf = insightMap[c.google_campaign_id] || {};
      return {
        name: c.name, status: c.status, type: c.campaign_type,
        daily_budget: `R$ ${((c.daily_budget_cents || 0) / 100).toFixed(2)}`,
        spend_7d: `R$ ${(perf.spend || 0).toFixed(2)}`,
        impressions_7d: perf.impressions || 0, clicks_7d: perf.clicks || 0, conversions_7d: perf.conversions || 0,
      };
    }),
  });
}

async function getTikTokCampaigns(supabase: any, tenantId: string, advertiserId?: string) {
  const query = supabase
    .from("tiktok_ad_campaigns")
    .select("id, tiktok_campaign_id, campaign_name, status, objective_type, budget_cents, advertiser_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (advertiserId) query.eq("advertiser_id", advertiserId);
  const { data: campaigns, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const { data: insights } = await supabase
    .from("tiktok_ad_insights")
    .select("tiktok_campaign_id, spend_cents, impressions, clicks, conversions, date_start")
    .eq("tenant_id", tenantId)
    .gte("date_start", sevenDaysAgo)
    .limit(500);

  const insightMap: Record<string, any> = {};
  for (const i of (insights || [])) {
    if (!insightMap[i.tiktok_campaign_id]) insightMap[i.tiktok_campaign_id] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    const m = insightMap[i.tiktok_campaign_id];
    m.spend += (i.spend_cents || 0) / 100;
    m.impressions += i.impressions || 0;
    m.clicks += i.clicks || 0;
    m.conversions += i.conversions || 0;
  }

  return JSON.stringify({
    total: campaigns?.length || 0,
    campaigns: (campaigns || []).map((c: any) => {
      const perf = insightMap[c.tiktok_campaign_id] || {};
      return {
        name: c.campaign_name, status: c.status, objective: c.objective_type,
        budget: `R$ ${((c.budget_cents || 0) / 100).toFixed(2)}`,
        spend_7d: `R$ ${(perf.spend || 0).toFixed(2)}`,
        impressions_7d: perf.impressions || 0, clicks_7d: perf.clicks || 0, conversions_7d: perf.conversions || 0,
      };
    }),
  });
}

async function getMetaAdsets(supabase: any, tenantId: string, adAccountId?: string, status?: string) {
  const query = supabase
    .from("meta_ad_adsets")
    .select("id, meta_adset_id, name, status, daily_budget_cents, lifetime_budget_cents, targeting, pixel_id, ad_account_id, optimization_goal, bid_strategy, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    adsets: (data || []).map((a: any) => ({
      name: a.name, status: a.status, meta_adset_id: a.meta_adset_id,
      daily_budget: a.daily_budget_cents ? `R$ ${(a.daily_budget_cents / 100).toFixed(2)}` : null,
      lifetime_budget: a.lifetime_budget_cents ? `R$ ${(a.lifetime_budget_cents / 100).toFixed(2)}` : null,
      has_pixel: !!a.pixel_id, optimization_goal: a.optimization_goal, bid_strategy: a.bid_strategy,
      targeting_summary: a.targeting ? JSON.stringify(a.targeting).substring(0, 200) : null,
    })),
  });
}

async function getMetaAds(supabase: any, tenantId: string, adAccountId?: string) {
  const query = supabase
    .from("meta_ad_ads")
    .select("id, meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, ad_account_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  const adIds = (data || []).map((a: any) => a.meta_ad_id).filter(Boolean);
  let creatives: any[] = [];
  if (adIds.length > 0) {
    const { data: cData } = await supabase
      .from("meta_ad_creatives")
      .select("meta_ad_id, name, title, body, image_url, thumbnail_url, call_to_action_type")
      .eq("tenant_id", tenantId)
      .in("meta_ad_id", adIds);
    creatives = cData || [];
  }
  const creativeMap: Record<string, any> = {};
  for (const c of creatives) creativeMap[c.meta_ad_id] = c;

  return JSON.stringify({
    total: data?.length || 0,
    ads: (data || []).map((a: any) => {
      const cr = creativeMap[a.meta_ad_id];
      return {
        name: a.name, status: a.status, effective_status: a.effective_status, meta_ad_id: a.meta_ad_id,
        creative: cr ? { title: cr.title, body: cr.body?.substring(0, 100), cta: cr.call_to_action_type, has_image: !!cr.image_url } : null,
      };
    }),
  });
}

async function getAudiences(supabase: any, tenantId: string, channel?: string) {
  const result: any = {};
  if (!channel || channel === "meta") {
    const { data } = await supabase
      .from("meta_ad_audiences")
      .select("id, name, audience_type, approximate_count, ad_account_id, created_at")
      .eq("tenant_id", tenantId).limit(30);
    result.meta = (data || []).map((a: any) => ({ name: a.name, type: a.audience_type, size: a.approximate_count }));
  }
  if (!channel || channel === "google") {
    const { data } = await supabase
      .from("google_ad_audiences")
      .select("id, name, audience_type, size_estimate, ad_account_id, created_at")
      .eq("tenant_id", tenantId).limit(30);
    result.google = (data || []).map((a: any) => ({ name: a.name, type: a.audience_type, size: a.size_estimate }));
  }
  return JSON.stringify(result);
}

async function getAutopilotConfig(supabase: any, tenantId: string, adAccountId?: string) {
  const { data: globalConfigs } = await supabase
    .from("ads_autopilot_configs")
    .select("*")
    .eq("tenant_id", tenantId);

  const accQuery = supabase
    .from("ads_autopilot_account_configs")
    .select("*")
    .eq("tenant_id", tenantId);
  if (adAccountId) accQuery.eq("ad_account_id", adAccountId);
  const { data: accountConfigs } = await accQuery;

  return JSON.stringify({
    global: (globalConfigs || []).map((g: any) => ({
      channel: g.channel, is_enabled: g.is_enabled, kill_switch: g.kill_switch,
      budget: `R$ ${((g.budget_cents || 0) / 100).toFixed(2)}/dia`,
      total_budget: g.total_budget_cents ? `R$ ${(g.total_budget_cents / 100).toFixed(2)}` : null,
      objective: g.objective, strategy_mode: g.strategy_mode,
      human_approval_mode: g.human_approval_mode, funnel_splits: g.funnel_splits,
      user_instructions: g.user_instructions?.substring(0, 300),
      last_analysis: g.last_analysis_at, total_actions: g.total_actions_executed,
    })),
    accounts: (accountConfigs || []).map((a: any) => ({
      ad_account_id: a.ad_account_id, channel: a.channel,
      is_ai_enabled: a.is_ai_enabled, kill_switch: a.kill_switch,
      budget: `R$ ${((a.budget_cents || 0) / 100).toFixed(2)}/dia`,
      target_roi: a.target_roi, strategy_mode: a.strategy_mode,
      human_approval_mode: a.human_approval_mode, funnel_splits: a.funnel_splits,
      user_instructions: a.user_instructions?.substring(0, 300),
    })),
  });
}

async function updateAutopilotConfig(supabase: any, tenantId: string, adAccountId: string, channel: string, updates: any) {
  if (!adAccountId || !channel) return JSON.stringify({ error: "ad_account_id e channel são obrigatórios" });
  const safeFields: Record<string, any> = {};
  const allowed = ["target_roi", "budget_cents", "strategy_mode", "is_ai_enabled", "user_instructions", "human_approval_mode"];
  for (const key of allowed) {
    if (updates[key] !== undefined) safeFields[key] = updates[key];
  }
  if (Object.keys(safeFields).length === 0) return JSON.stringify({ error: "Nenhum campo válido para atualizar" });
  safeFields.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("ads_autopilot_account_configs")
    .update(safeFields)
    .eq("tenant_id", tenantId)
    .eq("ad_account_id", adAccountId)
    .eq("channel", channel);

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, updated_fields: Object.keys(safeFields).filter(k => k !== "updated_at"), message: "Configurações atualizadas com sucesso." });
}

async function getExperiments(supabase: any, tenantId: string, status?: string) {
  const query = supabase
    .from("ads_autopilot_experiments")
    .select("id, hypothesis, variable_type, channel, status, start_at, end_at, budget_cents, results, winner_variant_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(15);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    experiments: (data || []).map((e: any) => ({
      hypothesis: e.hypothesis, variable: e.variable_type, channel: e.channel,
      status: e.status, budget: e.budget_cents ? `R$ ${(e.budget_cents / 100).toFixed(2)}` : null,
      has_winner: !!e.winner_variant_id, start: e.start_at, end: e.end_at,
    })),
  });
}

async function getTrackingHealth(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from("ads_tracking_health")
    .select("channel, status, indicators, alerts, ad_account_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    tracking: (data || []).map((t: any) => ({
      channel: t.channel, status: t.status, ad_account_id: t.ad_account_id,
      indicators: t.indicators, alerts: t.alerts, checked_at: t.created_at,
    })),
  });
}

async function getAutopilotSessions(supabase: any, tenantId: string, limit?: number) {
  const { data, error } = await supabase
    .from("ads_autopilot_sessions")
    .select("id, channel, trigger_type, motor_type, actions_planned, actions_executed, actions_rejected, cost_credits, duration_ms, created_at, insights_generated")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit || 10);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    sessions: (data || []).map((s: any) => ({
      channel: s.channel, trigger: s.trigger_type, motor: s.motor_type,
      planned: s.actions_planned, executed: s.actions_executed, rejected: s.actions_rejected,
      credits: s.cost_credits, duration_ms: s.duration_ms,
      insights_count: Array.isArray(s.insights_generated) ? s.insights_generated.length : 0,
      ran_at: s.created_at,
    })),
  });
}

// ============ CONTEXT COLLECTOR ============

async function collectBaseContext(supabase: any, tenantId: string, scope: string, adAccountId?: string, channel?: string) {
  const context: any = {};

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantId)
    .single();
  context.storeName = tenant?.name || "Loja";

  const configQuery = supabase
    .from("ads_autopilot_account_configs")
    .select("channel, ad_account_id, is_ai_enabled, budget_cents, target_roi, strategy_mode, funnel_splits, user_instructions")
    .eq("tenant_id", tenantId);
  if (scope === "account" && adAccountId) configQuery.eq("ad_account_id", adAccountId);
  const { data: configs } = await configQuery;
  context.accountConfigs = configs || [];

  const activeConfig = (configs || []).find((c: any) => c.is_ai_enabled && c.ad_account_id === adAccountId);
  context.userInstructions = activeConfig?.user_instructions || (configs || [])?.[0]?.user_instructions || null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("total, payment_status")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo);
  const paid = (orders || []).filter((o: any) => o.payment_status === "paid");
  context.orderStats = {
    paid: paid.length,
    revenue_brl: (paid.reduce((s: number, o: any) => s + (o.total || 0), 0) / 100).toFixed(2),
    avg_ticket_brl: paid.length ? (paid.reduce((s: number, o: any) => s + (o.total || 0), 0) / paid.length / 100).toFixed(2) : "0",
  };

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, status, description, images")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);
  context.products = (products || []).map((p: any) => ({
    id: p.id, name: p.name,
    price_brl: `R$ ${((p.price || 0) / 100).toFixed(2)}`,
    description: p.description?.substring(0, 120) || "",
    has_image: Array.isArray(p.images) && p.images.length > 0,
  }));

  return context;
}

// ============ SYSTEM PROMPT ============

function buildSystemPrompt(scope: string, adAccountId?: string, channel?: string, context?: any) {
  const scopeDesc = scope === "account"
    ? `Focado na conta ${adAccountId} (${channel || "multi-channel"}).`
    : "Visão global de todas as contas.";

  const configs = context?.accountConfigs || [];
  const configSummary = configs.map((c: any) =>
    `- ${c.channel} / ${c.ad_account_id}: IA ${c.is_ai_enabled ? "ON" : "OFF"}, Budget R$ ${((c.budget_cents || 0) / 100).toFixed(2)}/dia, ROI alvo ${c.target_roi || "N/D"}, Splits: ${JSON.stringify(c.funnel_splits || {})}`
  ).join("\n");

  const productsList = (context?.products || []).map((p: any) =>
    `- ${p.name} (${p.price_brl}) ${p.description ? `— ${p.description}` : ""}`
  ).join("\n");

  const userInstructionsBlock = context?.userInstructions
    ? `\n## INSTRUÇÕES ESTRATÉGICAS DO LOJISTA (LEIA COM ATENÇÃO — SEGUIR À RISCA)\n${context.userInstructions}\n`
    : "";

  return `Você é o assistente de tráfego pago da loja "${context?.storeName}". ${scopeDesc}

## REGRA SUPREMA: HONESTIDADE ABSOLUTA
- Você NUNCA mente, inventa ou alucina.
- Se você NÃO SABE algo, diga "Não tenho essa informação agora."
- Se você NÃO PODE fazer algo, diga "Não consigo fazer isso diretamente."
- NUNCA finja que está renderizando artes, fazendo upload ou qualquer processo que você não está executando de fato.
- NUNCA diga frases como "estou finalizando", "estou renderizando", "estou processando" se não estiver de fato executando uma ferramenta.
- NUNCA invente nomes de produtos, preços ou descrições. Use APENAS os produtos listados abaixo no CATÁLOGO REAL.
- Se uma ferramenta retorna erro, informe o erro real ao usuário. Não tente contornar com texto inventado.
- Suas únicas capacidades de execução são as FERRAMENTAS listadas abaixo. Tudo que não está nas ferramentas, você NÃO PODE FAZER.

## SUAS FERRAMENTAS (o que você PODE fazer de verdade)

### Leitura de Dados
1. **get_campaign_performance** → Métricas reais de campanhas Meta (7d)
2. **get_google_campaigns** → Campanhas e performance do Google Ads (7d)
3. **get_tiktok_campaigns** → Campanhas e performance do TikTok Ads (7d)
4. **get_meta_adsets** → Conjuntos de anúncios Meta (orçamento, segmentação, pixel)
5. **get_meta_ads** → Anúncios individuais Meta (status, criativos vinculados)
6. **get_audiences** → Públicos/audiências configurados (Meta e Google)
7. **get_creative_assets** → Criativos existentes e seus status
8. **get_autopilot_config** → Configurações atuais do Autopilot (global + por conta)
9. **get_autopilot_actions** → Ações reais executadas/agendadas pela IA
10. **get_autopilot_insights** → Insights e diagnósticos reais
11. **get_autopilot_sessions** → Histórico de sessões de execução do Autopilot
12. **get_experiments** → Experimentos/testes A/B
13. **get_tracking_health** → Saúde do tracking/pixel

### Execução
14. **trigger_creative_generation** → Disparar geração de BRIEFS criativos (headlines + copy)
15. **generate_creative_image** → Gerar IMAGENS reais via IA (Gemini) para criativos de anúncios. Informe o nome do produto e opcionalmente canal, estilo, formato e variações.
16. **create_meta_campaign** → Criar campanha COMPLETA no Meta Ads (Campanha→AdSet→Ad com criativo). Busca criativos prontos do Drive automaticamente. Campanha criada PAUSADA com ativação agendada para 00:01-04:00 BRT.
17. **trigger_autopilot_analysis** → Disparar análise do Autopilot para um canal
18. **update_autopilot_config** → Alterar configurações do Autopilot (ROI, orçamento, estratégia, etc)

### Análise Externa
19. **analyze_url** → Analisar conteúdo de uma URL (landing page, concorrente, artigo)

## CAPACIDADES MULTIMODAIS
- Você PODE analisar imagens enviadas pelo usuário (screenshots de anúncios, criativos, métricas, etc.)
- Você PODE analisar links/URLs usando a ferramenta analyze_url
- Você PODE analisar documentos/arquivos de texto enviados pelo usuário
- Quando o usuário enviar uma imagem, descreva o que vê e dê feedback relevante sobre tráfego/marketing
- Quando o usuário enviar um link, use analyze_url para extrair o conteúdo

## O QUE VOCÊ NÃO PODE FAZER (NUNCA FINJA QUE PODE)
- Não pode acessar a API da Meta/Google/TikTok diretamente (usa edge functions intermediárias)
- Não pode criar campanhas Google/TikTok diretamente (somente Meta por enquanto)
- Não pode "renderizar" ou "finalizar" nada fora das ferramentas acima

## FLUXO RECOMENDADO PARA CRIAR CAMPANHAS
1. Gere criativos visuais primeiro (generate_creative_image)
2. Aguarde a geração ser concluída (verifique com get_creative_assets)
3. Monte a campanha completa (create_meta_campaign) — ela busca automaticamente os criativos gerados
4. A campanha será ativada automaticamente na janela 00:01-04:00 BRT
${userInstructionsBlock}
## CATÁLOGO DE PRODUTOS REAIS
${productsList || "Nenhum produto ativo no catálogo."}

## CONTEXTO ATUAL
### Configurações
${configSummary || "Nenhuma conta configurada."}

### Vendas (30d)
- Pedidos pagos: ${context?.orderStats?.paid || 0}
- Receita: R$ ${context?.orderStats?.revenue_brl || "0.00"}
- Ticket médio: R$ ${context?.orderStats?.avg_ticket_brl || "0.00"}

## ESTILO
- Respostas diretas, objetivas e em Português BR
- Use Markdown para formatação
- Sempre baseie suas respostas nos dados REAIS das ferramentas
- Quando o usuário perguntar sobre performance, USE get_campaign_performance, get_google_campaigns ou get_tiktok_campaigns conforme o canal
- Quando perguntar sobre conjuntos/ad sets, USE get_meta_adsets
- Quando perguntar sobre anúncios específicos, USE get_meta_ads
- Quando perguntar sobre públicos/audiências, USE get_audiences
- Quando perguntar sobre configurações, USE get_autopilot_config
- Quando pedir para ALTERAR configurações, USE update_autopilot_config
- Quando pedir criativos TEXTUAIS (briefs, copy, headlines), USE trigger_creative_generation
- Quando pedir criativos VISUAIS (imagens, artes, fotos), USE generate_creative_image com o nome do produto
- Quando pedir para CRIAR/MONTAR/PUBLICAR uma campanha Meta, USE create_meta_campaign (ela monta Campanha→AdSet→Ad automaticamente)
- Quando pedir análise, USE trigger_autopilot_analysis
- Quando perguntar sobre tracking/pixel, USE get_tracking_health
- Quando perguntar sobre histórico de execuções, USE get_autopilot_sessions
- Quando perguntar sobre experimentos/testes A/B, USE get_experiments
- Quando enviar link/URL, USE analyze_url
- Se o usuário pedir para criar campanha E não houver criativos prontos, PRIMEIRO gere criativos (generate_creative_image) e avise o usuário. Depois monte a campanha.
- SEMPRE referencie produtos pelo nome real do catálogo acima`;
}

// ============ BUILD MULTIMODAL USER MESSAGE ============

function buildUserMessage(message: string, attachments?: any[]) {
  // If no attachments, return simple text
  if (!attachments || attachments.length === 0) {
    return { role: "user", content: message };
  }

  // Build multimodal content array
  const content: any[] = [];

  // Add text first
  if (message) {
    content.push({ type: "text", text: message });
  }

  // Add images/files
  for (const att of attachments) {
    if (att.mimeType?.startsWith("image/")) {
      content.push({
        type: "image_url",
        image_url: { url: att.url },
      });
    } else {
      // For non-image files, add as text reference
      content.push({
        type: "text",
        text: `[Arquivo anexado: ${att.filename} (${att.mimeType || "desconhecido"})]`,
      });
    }
  }

  return { role: "user", content };
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-chat][${VERSION}] Request received`);

  let body: any;

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    body = await req.json();
    const { conversation_id, message, tenant_id, scope, ad_account_id, channel, attachments } = body;

    if (!tenant_id || (!message && (!attachments || attachments.length === 0))) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or get conversation
    let convId = conversation_id;
    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from("ads_chat_conversations")
        .insert({
          tenant_id,
          scope: scope || "global",
          ad_account_id: ad_account_id || null,
          channel: channel || null,
          title: (message || "Anexo").substring(0, 60),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    // Save user message (with attachments if any)
    await supabase.from("ads_chat_messages").insert({
      conversation_id: convId,
      tenant_id,
      role: "user",
      content: message || null,
      attachments: attachments && attachments.length > 0 ? attachments : null,
    });

    // Load conversation history (last 15 messages)
    const { data: allHistory } = await supabase
      .from("ads_chat_messages")
      .select("role, content, attachments")
      .eq("conversation_id", convId)
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(15);
    const history = (allHistory || []).reverse();

    // Collect base context
    const context = await collectBaseContext(supabase, tenant_id, scope, ad_account_id, channel);
    const systemPrompt = buildSystemPrompt(scope, ad_account_id, channel, context);

    // Build AI messages - handle multimodal for last user message
    const aiMessages: any[] = [{ role: "system", content: systemPrompt }];
    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      if (i === history.length - 1 && m.role === "user" && m.attachments) {
        // Last message with attachments — use multimodal format
        aiMessages.push(buildUserMessage(m.content || "", m.attachments));
      } else {
        aiMessages.push({ role: m.role, content: m.content });
      }
    }

    // Detect if current message has images (use vision model)
    const hasImages = attachments?.some((a: any) => a.mimeType?.startsWith("image/"));
    const modelToUse = hasImages ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // === STEP 1: Non-streaming call WITH tools (45s timeout) ===
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45000);

    let initialResult: any;
    try {
      const initialResponse = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: aiMessages,
          tools: TOOLS,
          stream: false,
        }),
        signal: abortController.signal,
      });
      clearTimeout(timeoutId);

      if (!initialResponse.ok) {
        const errText = await initialResponse.text();
        console.error(`[ads-chat][${VERSION}] AI error: ${initialResponse.status} ${errText}`);
        if (initialResponse.status === 429 || initialResponse.status === 402) {
          const errorMsg = initialResponse.status === 429 ? "Rate limit exceeded" : "Credits required";
          await supabase.from("ads_chat_messages").insert({
            conversation_id: convId, tenant_id, role: "assistant",
            content: `⚠️ Erro temporário: ${errorMsg}. Tente novamente em alguns segundos.`,
          });
          return new Response(JSON.stringify({ error: errorMsg }), {
            status: initialResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${initialResponse.status}`);
      }

      initialResult = await initialResponse.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        console.error(`[ads-chat][${VERSION}] Timeout after 45s`);
        const timeoutMsg = "⚠️ O processamento demorou mais que o esperado. A conversa está muito longa — tente criar uma **nova conversa** para continuar.";
        await supabase.from("ads_chat_messages").insert({
          conversation_id: convId, tenant_id, role: "assistant", content: timeoutMsg,
        });
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: timeoutMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sseData, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId },
        });
      }
      throw err;
    }

    const firstChoice = initialResult.choices?.[0];
    if (!firstChoice) throw new Error("Empty AI response");

    // Check tool calls
    const toolCalls = firstChoice.message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      console.log(`[ads-chat][${VERSION}] Tool calls: ${toolCalls.map((t: any) => t.function.name).join(", ")}`);

      const toolResults: string[] = [];
      for (const tc of toolCalls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty args */ }

        const result = await executeTool(supabase, tenant_id, tc.function.name, args);
        toolResults.push(`[Resultado de ${tc.function.name}]:\n${result}`);

        await supabase.from("ads_chat_messages").insert({
          conversation_id: convId, tenant_id, role: "assistant", content: null,
          tool_calls: [{ id: tc.id, function: { name: tc.function.name, arguments: tc.function.arguments } }],
        });
      }

      const followUpMessages = [
        ...aiMessages,
        { role: "assistant", content: "Vou consultar os dados reais do sistema para responder com precisão." },
        { role: "user", content: `[DADOS REAIS DO SISTEMA — baseie sua resposta EXCLUSIVAMENTE nestes dados]\n\n${toolResults.join("\n\n")}` },
      ];

      const finalAiResponse = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!finalAiResponse.ok) {
        const errText = await finalAiResponse.text();
        throw new Error(`AI final response error: ${finalAiResponse.status} - ${errText}`);
      }

      return streamAndSave(finalAiResponse, supabase, convId, tenant_id, message || "Anexo", history);
    }

    // No tool calls — direct text response
    const directContent = firstChoice.message?.content;
    if (directContent) {
      await supabase.from("ads_chat_messages").insert({
        conversation_id: convId, tenant_id, role: "assistant", content: directContent,
      });
      const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: directContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseData, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId },
      });
    }

    // Fallback: stream a new call
    const streamResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) throw new Error(`Stream error: ${streamResponse.status}`);

    return streamAndSave(streamResponse, supabase, convId, tenant_id, message || "Anexo", history);
  } catch (e: any) {
    console.error(`[ads-chat][${VERSION}] Error:`, e);
    try {
      const errMsg = `⚠️ Ocorreu um erro ao processar sua mensagem: ${e.message || "Erro interno"}. Tente novamente.`;
      if (body?.conversation_id || body?.tenant_id) {
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sseData, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    } catch { /* ignore secondary errors */ }
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============ STREAM & SAVE ============

function streamAndSave(
  aiResponse: Response,
  supabase: any,
  convId: string,
  tenantId: string,
  userMessage: string,
  history: any[] | null
) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const decoder = new TextDecoder();
  let fullContent = "";

  (async () => {
    try {
      const reader = aiResponse.body!.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writer.write(value);

        buffer += decoder.decode(value, { stream: true });
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullContent += delta;
          } catch { /* partial */ }
        }
      }

      if (fullContent) {
        await supabase.from("ads_chat_messages").insert({
          conversation_id: convId,
          tenant_id: tenantId,
          role: "assistant",
          content: fullContent,
        });

        if ((history || []).length <= 1) {
          await supabase
            .from("ads_chat_conversations")
            .update({ title: userMessage.substring(0, 60), updated_at: new Date().toISOString() })
            .eq("id", convId);
        }
      }
    } catch (e) {
      console.error(`[ads-chat][${VERSION}] Stream error:`, e);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "X-Conversation-Id": convId,
    },
  });
}
