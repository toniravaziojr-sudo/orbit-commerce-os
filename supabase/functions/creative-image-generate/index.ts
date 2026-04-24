/**
 * Creative Image Generate — Edge Function v9.0.0 (Unified Engine)
 * 
 * Uses shared visual-engine.ts resilientGenerate() for ALL image generation.
 * No more local duplicate — single pipeline for the entire system.
 * 
 * PIPELINE: GPT Image 1 → Gemini Nativa → OpenAI → Lovable Gateway
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getCredential } from "../_shared/platform-credentials.ts";
import { getFalApiKey } from "../_shared/fal-client.ts";
import {
  resilientGenerate,
  downloadImageAsBase64,
  scoreImageForRealism,
  getActualProviderFromModel,
  type ActualProvider,
  type ResilientGenerateResult,
} from "../_shared/visual-engine.ts";

const VERSION = '9.0.0'; // Unified engine v10.0

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Custos base (em USD)
const COST_PER_IMAGE: Record<string, number> = {
  'fal-ai': 0.04,
  openai: 0.04,
  gemini: 0.02,
  lovable: 0.02,
};
const COST_PER_QA = 0.005;
const COST_MARKUP = 1.5;
const USD_TO_BRL = 5.80;

const QA_PASS_SCORE = 0.70;

type Provider = 'openai' | 'gemini';
type ImageStyle = 'product_natural' | 'person_interacting' | 'promotional';

interface QAScores {
  realism: number;
  quality: number;
  composition: number;
  label: number;
  overall: number;
}

// ========== PROMPT BUILDERS ==========

function detectProductType(productName: string): { isKit: boolean; estimatedItems: number; kitType: string } {
  const name = productName.toLowerCase().trim();
  if (/\bkit\b/i.test(name)) {
    const qtyMatch = name.match(/(\d+)\s*(?:x|un|pç|peças|itens|produtos)/i) || name.match(/kit\s+(?:com\s+)?(\d+)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 3;
    return { isKit: true, estimatedItems: qty, kitType: 'kit' };
  }
  const multiplierMatch = name.match(/\(?\s*(\d+)\s*x\s*\)?/i) || name.match(/\bpack\s+(\d+)/i) || name.match(/(\d+)\s*(?:un|unidade|unidades)\b/i);
  if (multiplierMatch) {
    const qty = parseInt(multiplierMatch[1]);
    if (qty >= 2) return { isKit: true, estimatedItems: qty, kitType: 'pack' };
  }
  if (/\b(combo|conjunto|pack|coleção)\b/i.test(name)) {
    return { isKit: true, estimatedItems: 3, kitType: 'combo' };
  }
  return { isKit: false, estimatedItems: 1, kitType: 'single' };
}

function buildHandInstructions(productName: string): string {
  const { isKit, estimatedItems, kitType } = detectProductType(productName);
  if (!isKit) {
    return `🖐️ REGRA DE MÃOS:\n- A pessoa pode segurar o produto com UMA ou DUAS mãos\n- Segurar pela base/corpo, rótulo frontal VISÍVEL\n- Mãos devem parecer naturais, não forçadas`;
  }
  if (estimatedItems <= 2) {
    return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems} itens):\n- NO MÁXIMO um produto em CADA MÃO (total: 2 nas mãos)\n- Mãos devem segurar com naturalidade\n- Rótulos frontais visíveis em ambos os produtos`;
  }
  return `🖐️ REGRA DE MÃOS (${kitType.toUpperCase()} com ${estimatedItems}+ itens):\n- SE o kit vier em uma embalagem única: a pessoa PODE segurar a embalagem\n- SE forem produtos avulsos: NO MÁXIMO 1 em cada mão (total: 2)\n- Os produtos restantes devem estar DISPOSTOS em uma superfície próxima\n- PROIBIDO: empilhar vários produtos nas mãos`;
}

function buildPromptForStyle(config: {
  productName: string;
  style: ImageStyle;
  styleConfig: Record<string, unknown>;
  contextBrief: string;
  format: string;
}): string {
  const { productName, style, styleConfig, contextBrief, format } = config;
  const formatDesc = {
    '1:1': 'formato quadrado 1:1 (1024x1024)',
    '9:16': 'formato vertical 9:16 (1024x1792)',
    '16:9': 'formato horizontal 16:9 (1792x1024)',
  }[format] || 'formato quadrado 1:1';

  // If user provided a custom prompt, prioritize it over style templates
  if (contextBrief && contextBrief.length > 20) {
    return `FOTOGRAFIA PROFISSIONAL DE PRODUTO — ${formatDesc}

📦 PRODUTO: "${productName}"
A imagem de referência mostra o produto REAL que deve ser fielmente reproduzido.

📝 DIREÇÃO CRIATIVA DO USUÁRIO: ${contextBrief}

REGRAS OBRIGATÓRIAS:
- O produto DEVE ser IDÊNTICO à referência (cores, rótulo, formato)
- Seguir a direção criativa do usuário como prioridade
- Qualidade editorial de revista
- Foco nítido no produto

PROIBIDO:
- Alterar cores, texto ou forma do produto
- Distorcer o rótulo
- Criar variações que não existem`;
  }

  if (style === 'product_natural') {
    const env = (styleConfig?.environment as string) || 'studio';
    const lighting = (styleConfig?.lighting as string) || 'natural';
    const mood = (styleConfig?.mood as string) || 'clean';
    return `FOTOGRAFIA PROFISSIONAL DE PRODUTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nA imagem de referência mostra o produto REAL que deve ser fielmente reproduzido.\n\n🏠 CENÁRIO: ${env}\n💡 ILUMINAÇÃO: ${lighting}\n🎨 MOOD: ${mood}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\nREGRAS OBRIGATÓRIAS:\n- O produto DEVE ser IDÊNTICO à referência (cores, rótulo, formato)\n- Ambiente natural e realista, sem pessoas\n- Iluminação profissional sem sombras duras\n- Foco nítido no produto, fundo levemente desfocado\n- Qualidade editorial de revista\n\nPROIBIDO:\n- Alterar cores, texto ou forma do produto\n- Adicionar elementos não solicitados\n- Distorcer o rótulo`;
  }
  
  if (style === 'person_interacting') {
    const action = (styleConfig?.action as string) || 'holding';
    const personProfile = (styleConfig?.personProfile as string) || '';
    const tone = (styleConfig?.tone as string) || 'lifestyle';
    const actionDesc = { holding: 'segurando o produto pela base/corpo, rótulo frontal visível', using: 'aplicando/usando o produto de forma natural', showing: 'mostrando o produto para câmera com expressão confiante' }[action] || 'segurando o produto';
    const toneDesc = { ugc: 'estilo UGC caseiro e autêntico', demo: 'demonstração profissional do produto em uso', review: 'pessoa fazendo review/avaliação do produto', lifestyle: 'fotografia lifestyle editorial de alta qualidade' }[tone] || 'lifestyle editorial';
    const handRules = buildHandInstructions(productName);
    return `FOTOGRAFIA PROFISSIONAL — PESSOA COM PRODUTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nA imagem de referência mostra o produto REAL.\n\n👤 PESSOA: ${personProfile || 'pessoa atraente com aparência natural e saudável'}\n🎬 AÇÃO: ${actionDesc}\n🎨 TOM: ${toneDesc}\n\n${handRules}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\nREGRAS CRÍTICAS DE FIDELIDADE:\n- O produto será SUBSTITUÍDO por composição (Label Lock)\n- Foque em criar a CENA perfeita (pessoa, mãos, iluminação)\n- Pessoa com aparência fotorrealista, sem cara de IA\n\nQUALIDADE:\n- Resolução 4K, nitidez profissional\n- Iluminação natural ou de estúdio\n- Expressão natural, não forçada`;
  }
  
  if (style === 'promotional') {
    const intensity = (styleConfig?.effectsIntensity as string) || 'medium';
    const elements = (styleConfig?.visualElements as string[]) || [];
    const overlayText = (styleConfig?.overlayText as string) || '';
    const intensityDesc = { low: 'efeitos sutis e elegantes', medium: 'efeitos moderados com impacto visual', high: 'efeitos intensos e dramáticos' }[intensity] || 'efeitos moderados';
    const elementsDesc = elements.length > 0 ? `Elementos visuais: ${elements.join(', ')}` : '';
    return `IMAGEM PROMOCIONAL DE ALTO IMPACTO — ${formatDesc}\n\n📦 PRODUTO: "${productName}"\nCriar imagem publicitária de alto impacto visual.\n\n✨ INTENSIDADE DE EFEITOS: ${intensityDesc}\n${elementsDesc}\n\n${contextBrief ? `📝 BRIEF ADICIONAL: ${contextBrief}` : ''}\n\n${overlayText ? `⚠️ TEXTO OPCIONAL: "${overlayText}"` : ''}\n\nREGRAS:\n- Visual impactante para anúncios\n- Produto deve ser o foco central\n- Preservar cores e identidade do produto\n- Efeitos não devem cobrir o rótulo\n\nESTILO:\n- Publicitário profissional\n- Cores vibrantes e contraste alto\n- Composição dinâmica`;
  }
  
  return `Fotografia profissional do produto "${productName}". ${contextBrief}`;
}

function sanitizeProviderLabel(label: string): string {
  return label.replace(/[^a-z0-9-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'unknown';
}

function getCostBucketFromProvider(provider: ActualProvider): string {
  if (provider === 'fal-ai') return 'fal-ai';
  if (provider === 'gemini') return 'gemini';
  if (provider === 'openai') return 'openai';
  return 'lovable';
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[creative-image-generate v${VERSION}] Starting unified pipeline...`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const openaiApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "OPENAI_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY não configurada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const falApiKey = await getFalApiKey(supabaseUrl, supabaseServiceKey);
    const geminiApiKey = await getCredential(supabaseUrl, supabaseServiceKey, 'GEMINI_API_KEY');
    
    console.log(`[creative-image-generate v${VERSION}] Credentials: FAL=${!!falApiKey} GEMINI=${!!geminiApiKey} OPENAI=${!!openaiApiKey} LOVABLE=✅`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isM2M = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      if (token === supabaseServiceKey) {
        isM2M = true;
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid token' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        userId = authData.user.id;
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      tenant_id, product_id, product_name, product_description, product_image_url,
      prompt, output_folder_id, settings = {},
    } = body;

    if (!tenant_id || !product_id || !product_image_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id, product_id e product_image_url são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isM2M) {
      const { data: userRole } = await supabase
        .from('user_roles').select('role').eq('user_id', userId).eq('tenant_id', tenant_id).maybeSingle();
      if (!userRole) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sem permissão para este tenant' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const {
      providers = ['openai', 'gemini'] as Provider[],
      generation_style = 'product_natural' as ImageStyle,
      format = '1:1',
      variations = 1,
      style_config = {},
      enable_qa = true,
      enable_fallback = true,
      label_lock = true,
    } = settings;

    const numVariations = Math.min(Math.max(1, variations), 4);
    const enabledProviders = providers.filter((p: string) => p === 'openai' || p === 'gemini') as Provider[];
    
    if (enabledProviders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Selecione ao menos um provedor' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure folder
    let folderId: string | null = output_folder_id || null;
    if (folderId) {
      const { data: existingFolder } = await supabase.from('files').select('id').eq('id', folderId).eq('tenant_id', tenant_id).eq('is_folder', true).maybeSingle();
      if (!existingFolder) folderId = null;
    }
    if (!folderId) {
      try {
        const { ensureFolderPathEdge } = await import("../_shared/drive-register.ts");
        folderId = (await ensureFolderPathEdge(supabase, tenant_id, userId as string, "Criativos IA")) || null;
      } catch (e) {
        console.warn("[creative-image] drive-register fallback:", e);
      }
      if (!folderId) {
        const { data: folder } = await supabase.from('files').select('id').eq('tenant_id', tenant_id).eq('filename', 'Criativos IA').eq('is_folder', true).limit(1);
        folderId = folder?.[0]?.id;
        if (!folderId) {
          const { data: newFolder } = await supabase.from('files').insert({
            tenant_id, filename: 'Criativos IA', original_name: 'Criativos IA',
            storage_path: `${tenant_id}/criativos-ia/`, is_folder: true, created_by: userId,
            metadata: { source: 'creatives_module', system_managed: true },
          }).select('id').single();
          folderId = newFolder?.id;
        }
      }
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('creative_jobs')
      .insert({
        tenant_id, type: 'product_image', status: 'running',
        prompt: prompt || '', product_id, product_name, product_image_url,
        settings: {
          providers: enabledProviders, generation_style, format,
          variations: numVariations, style_config, enable_qa, enable_fallback,
          label_lock, pipeline_version: VERSION,
        },
        output_folder_id: folderId, cost_cents: 0, created_by: userId,
      })
      .select().single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar job' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobId = job.id;

    // ========== BACKGROUND PROCESSING ==========
    const processPipeline = async () => {
      try {
        const productBase64 = await downloadImageAsBase64(product_image_url);
        if (!productBase64) {
          await supabase.from('creative_jobs').update({ 
            status: 'failed', error_message: 'Não foi possível baixar a imagem do produto',
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);
          return;
        }

        const descriptionContext = product_description 
          ? `\n\n📋 DESCRIÇÃO DO PRODUTO: ${product_description}` 
          : '';

        const finalPrompt = buildPromptForStyle({
          productName: product_name || 'Produto',
          style: generation_style,
          styleConfig: style_config,
          contextBrief: (prompt || '') + descriptionContext,
          format,
        });

        const allResults: Array<{
          actualProvider: ActualProvider;
          model: string;
          imageBase64: string;
          scores: QAScores;
        }> = [];
        let totalCostCents = 0;

        for (let varIdx = 0; varIdx < numVariations; varIdx++) {
          const variantPrompt = varIdx === 0 
            ? finalPrompt 
            : `${finalPrompt}\n\n🔄 VARIAÇÃO ${varIdx + 1}: Varie sutilmente ângulo, iluminação ou composição.`;

          // Use unified resilientGenerate from visual-engine
          const result = await resilientGenerate({
            lovableApiKey,
            openaiApiKey,
            geminiApiKey,
            falApiKey,
            prompt: variantPrompt,
            referenceImageBase64: productBase64,
            referenceImageUrl: product_image_url,
            outputSize: '1024x1024',
            slotLabel: `product-v${varIdx + 1}`,
          });

          if (!result.imageBase64) {
            console.warn(`[creative-image] Variation ${varIdx + 1} failed: ${result.error}`);
            continue;
          }

          totalCostCents += Math.ceil((COST_PER_IMAGE[getCostBucketFromProvider(result.actualProvider)] || 0.02) * COST_MARKUP * USD_TO_BRL * 100);

          let scores: QAScores = { realism: 7, quality: 7, composition: 7, label: 7, overall: 0.7 };
          if (enable_qa) {
            scores = await scoreImageForRealism(lovableApiKey, result.imageBase64, productBase64, product_name || 'Produto');
            totalCostCents += Math.ceil(COST_PER_QA * COST_MARKUP * USD_TO_BRL * 100);
          }

          allResults.push({
            actualProvider: result.actualProvider,
            model: result.model,
            imageBase64: result.imageBase64,
            scores,
          });
        }

        allResults.sort((a, b) => b.scores.overall - a.scores.overall);

        // Upload results
        const uploadedImages: Array<{
          url: string; actualProvider: ActualProvider; model: string;
          scores: QAScores; isWinner: boolean;
        }> = [];

        for (let i = 0; i < allResults.length; i++) {
          const result = allResults[i];
          const storagePath = `${tenant_id}/${jobId}/${sanitizeProviderLabel(result.actualProvider)}_${i + 1}.png`;
          
          try {
            const binaryData = Uint8Array.from(atob(result.imageBase64), c => c.charCodeAt(0));
            const { error: uploadError } = await supabase.storage.from('media-assets').upload(storagePath, binaryData, { contentType: 'image/png', upsert: true });
            if (uploadError) { console.error('[creative-image] Upload error:', uploadError); continue; }

            const { data: publicUrlData } = supabase.storage.from('media-assets').getPublicUrl(storagePath);
            if (publicUrlData?.publicUrl) {
              uploadedImages.push({
                url: publicUrlData.publicUrl,
                actualProvider: result.actualProvider,
                model: result.model,
                scores: result.scores,
                isWinner: i === 0,
              });
            }
          } catch (error) {
            console.error('[creative-image] Upload error:', error);
          }
        }

        // Save results
        const elapsedMs = Date.now() - startTime;
        const finalStatus = uploadedImages.length > 0 ? 'succeeded' : 'failed';
        const winner = uploadedImages.find(img => img.isWinner);

        await supabase.from('creative_jobs').update({
          status: finalStatus,
          external_model_id: winner?.model || null,
          output_urls: uploadedImages.map(img => img.url),
          cost_cents: totalCostCents,
          processing_time_ms: elapsedMs,
          completed_at: new Date().toISOString(),
          error_message: uploadedImages.length === 0 ? 'Nenhuma imagem gerada com sucesso' : null,
          settings: {
            ...job.settings,
            results: uploadedImages.map(img => ({
              url: img.url,
              actual_provider: img.actualProvider,
              model: img.model,
              scores: img.scores,
              isWinner: img.isWinner,
            })),
            winner_provider: winner?.actualProvider,
            winner_model: winner?.model,
            winner_score: winner?.scores.overall,
          },
        }).eq('id', jobId);

        // Register files in Drive
        for (let i = 0; i < uploadedImages.length; i++) {
          const img = uploadedImages[i];
          const urlMatch = img.url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
          const actualStoragePath = urlMatch ? urlMatch[1] : `${tenant_id}/${jobId}/${sanitizeProviderLabel(img.actualProvider)}_${i + 1}.png`;
          
          const now = new Date();
          const timestamp = `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
          const sanitizedProduct = (product_name || 'Produto').replace(/[^a-zA-Z0-9À-ÿ]/g, '_').substring(0, 30);
          const uniqueFilename = `${sanitizedProduct}_${sanitizeProviderLabel(img.actualProvider)}_${timestamp}${img.isWinner ? '_BEST' : ''}.png`;

          try {
            await supabase.from('files').insert({
              tenant_id, folder_id: folderId, filename: uniqueFilename, original_name: uniqueFilename,
              storage_path: actualStoragePath, mime_type: 'image/png', size_bytes: null, created_by: userId,
              metadata: {
                source: 'creative_job_v3', job_id: jobId, product_id,
                provider: img.actualProvider, is_winner: img.isWinner, scores: img.scores,
                url: img.url, bucket: 'media-assets', system_managed: true,
              },
            });
          } catch (e) {
            console.error('[creative-image] Drive register error:', e);
          }
        }

        // Update ads_creative_assets
        const { data: linkedAssets } = await supabase.from('ads_creative_assets').select('id, meta, session_id').eq('tenant_id', tenant_id).eq('product_id', product_id);
        const assetsToUpdate = (linkedAssets || []).filter((a: any) => (a.meta as any)?.image_job_id === jobId);

        if (uploadedImages.length > 0) {
          const winnerUrl = winner?.url || uploadedImages[0]?.url;
          const winnerStoragePath = (() => { const m = winnerUrl?.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/); return m ? m[1] : null; })();
          
          for (const asset of assetsToUpdate) {
            const existingMeta = asset.meta as any || {};
            await supabase.from('ads_creative_assets').update({
              asset_url: winnerUrl, storage_path: winnerStoragePath, status: 'ready',
              meta: { ...existingMeta, image_status: 'completed', image_job_id: jobId, image_scores: winner?.scores },
            }).eq('id', asset.id);
          }
        } else {
          // Fallback: Drive or catalog image
          let driveFallbackUrl: string | null = null;
          if (product_id) {
            try {
              const { data: driveFolder } = await supabase.from('files').select('id').eq('tenant_id', tenant_id).eq('filename', 'Gestor de Tráfego IA').eq('is_folder', true).maybeSingle();
              if (driveFolder) {
                const { data: driveCreatives } = await supabase.from('files').select('id, filename, metadata, storage_path').eq('tenant_id', tenant_id).eq('folder_id', driveFolder.id).eq('is_folder', false).order('created_at', { ascending: false }).limit(50);
                const matchingCreatives = (driveCreatives || []).filter((f: any) => (f.metadata as any)?.product_id === product_id);
                if (matchingCreatives.length > 0) {
                  matchingCreatives.sort((a: any, b: any) => {
                    const metaA = a.metadata as any || {}; const metaB = b.metadata as any || {};
                    if (metaA.is_winner && !metaB.is_winner) return -1;
                    if (!metaA.is_winner && metaB.is_winner) return 1;
                    return (metaB.scores?.overall || 0) - (metaA.scores?.overall || 0);
                  });
                  const bestMeta = matchingCreatives[0].metadata as any || {};
                  driveFallbackUrl = bestMeta.url || null;
                  if (!driveFallbackUrl && matchingCreatives[0].storage_path) {
                    const bucket = bestMeta.bucket || 'media-assets';
                    const { data: pubUrl } = supabase.storage.from(bucket).getPublicUrl(matchingCreatives[0].storage_path);
                    driveFallbackUrl = pubUrl?.publicUrl || null;
                  }
                }
              }
            } catch (e: any) { console.error('[creative-image] Drive fallback error:', e.message); }
          }

          const fallbackUrl = driveFallbackUrl || product_image_url;
          const fallbackSource = driveFallbackUrl ? 'fallback_drive' : 'fallback_catalog';
          for (const asset of assetsToUpdate) {
            const existingMeta = asset.meta as any || {};
            await supabase.from('ads_creative_assets').update({
              asset_url: fallbackUrl, status: 'ready',
              meta: { ...existingMeta, image_status: fallbackSource, image_job_id: jobId, fallback_reason: 'All AI generation attempts failed', fallback_source: fallbackSource },
            }).eq('id', asset.id);
          }
        }

        // Sequential Pipeline Callback
        if (assetsToUpdate.length > 0) {
          try {
            const assetSessionId = assetsToUpdate[0]?.session_id || null;
            if (assetSessionId) {
              const { data: pendingAssets } = await supabase.from('ads_creative_assets').select('id').eq('tenant_id', tenant_id).eq('session_id', assetSessionId).neq('status', 'ready').limit(1);
              if (!pendingAssets || pendingAssets.length === 0) {
                await supabase.functions.invoke("ads-autopilot-strategist", { body: { tenant_id, trigger: "implement_campaigns", source_session_id: assetSessionId } });
              }
            } else {
              await supabase.functions.invoke("ads-autopilot-analyze", { body: { tenant_id, trigger_type: "creative_ready" } });
            }
          } catch (e: any) { console.error('[creative-image] Callback error:', e.message); }
        }

        console.log(`[creative-image] Pipeline complete: ${uploadedImages.length} images in ${elapsedMs}ms`);
        
      } catch (pipelineError) {
        console.error('[creative-image] Pipeline error:', pipelineError);
        await supabase.from('creative_jobs').update({
          status: 'failed', error_message: String(pipelineError), completed_at: new Date().toISOString(),
        }).eq('id', jobId);
      }
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processPipeline());
    } else {
      processPipeline().catch(console.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          job_id: jobId, status: 'running',
          message: 'Job iniciado. Acompanhe o progresso na lista.',
          pipeline_version: VERSION,
        },
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[creative-image-generate v${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
