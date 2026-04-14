/**
 * Media Process Generation Queue — v10.0 (Unified Engine)
 * 
 * Uses shared visual-engine.ts resilientGenerate() for ALL image generation.
 * No more local duplicate.
 * 
 * PIPELINE: GPT Image 1 → Gemini Nativa → OpenAI → Lovable Gateway
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { getFalApiKey } from "../_shared/fal-client.ts";
import {
  resilientGenerate,
  downloadImageAsBase64,
  scoreImageForRealism,
} from "../_shared/visual-engine.ts";

const VERSION = '10.0.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Provider = 'gemini' | 'openai';

interface GenerationSettings {
  use_packshot?: boolean;
  content_type?: string;
  packshot_url?: string;
  reference_source?: string;
  matched_products?: Array<{ id: string; name: string; image_url: string | null; is_kit?: boolean }>;
  needs_product_image?: boolean;
  is_kit_scenario?: boolean;
  image_size?: string;
  asset_type?: "image" | "video";
  duration?: number;
  aspect_ratio?: string;
  source_image_url?: string;
  product_name?: string;
  providers?: Provider[];
  enable_qa?: boolean;
}

interface QAScores {
  realism: number;
  quality: number;
  composition: number;
  label: number;
  overall: number;
}

// ========== ENSURE MEDIA MONTH FOLDER (Drive) ==========

const MEDIA_ROOT_FOLDER = 'Mídias Sociais';

async function ensureMediaMonthFolderEdge(
  supabase: any, tenantId: string, userId: string, campaignStartDate: string
): Promise<string | null> {
  try {
    let rootFolderId: string | null = null;
    const { data: existingRootArr } = await supabase.from('files').select('id').eq('tenant_id', tenantId).eq('filename', MEDIA_ROOT_FOLDER).eq('is_folder', true).is('folder_id', null).order('created_at', { ascending: true }).limit(1);
    const existingRoot = existingRootArr?.[0];

    if (existingRoot) {
      rootFolderId = existingRoot.id;
    } else {
      const { data: createdRoot, error: rootErr } = await supabase.from('files').insert({
        tenant_id: tenantId, folder_id: null, filename: MEDIA_ROOT_FOLDER, original_name: MEDIA_ROOT_FOLDER,
        storage_path: `${tenantId}/midias-sociais/`, is_folder: true, is_system_folder: false, created_by: userId,
        metadata: { source: 'media_module', system_managed: true },
      }).select('id').single();
      if (rootErr || !createdRoot) return null;
      rootFolderId = createdRoot.id;
    }

    const date = new Date(campaignStartDate + 'T00:00:00');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const monthSlug = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const { data: existingMonthArr } = await supabase.from('files').select('id').eq('tenant_id', tenantId).eq('folder_id', rootFolderId).eq('filename', monthName).eq('is_folder', true).order('created_at', { ascending: true }).limit(1);
    if (existingMonthArr?.[0]) return existingMonthArr[0].id;

    const { data: createdMonth, error: monthErr } = await supabase.from('files').insert({
      tenant_id: tenantId, folder_id: rootFolderId, filename: monthName, original_name: monthName,
      storage_path: `${tenantId}/midias-sociais/${monthSlug}/`, is_folder: true, is_system_folder: false, created_by: userId,
      metadata: { source: 'media_campaign', system_managed: true, month: monthSlug },
    }).select('id').single();

    if (monthErr || !createdMonth) return null;
    return createdMonth.id;
  } catch (err) {
    console.error('⚠️ ensureMediaMonthFolderEdge error:', err);
    return null;
  }
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || null;

  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "LOVABLE_API_KEY não configurada" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const geminiApiKey = await getCredential(supabaseUrl, supabaseServiceKey, 'GEMINI_API_KEY');
  const falApiKeyValue = await getFalApiKey(supabaseUrl, supabaseServiceKey);

  console.log(`[media-process-generation-queue v${VERSION}] Credentials: FAL=${!!falApiKeyValue} GEMINI=${!!geminiApiKey} OPENAI=${!!openaiApiKey} LOVABLE=✅`);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: generations, error: fetchError } = await supabase
      .from("media_asset_generations").select("*").eq("status", "queued")
      .order("created_at", { ascending: true }).limit(3);

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar fila" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!generations || generations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Fila vazia", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[media-process-generation-queue v${VERSION}] Processing ${generations.length} queued generations`);

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const generation of generations) {
      const genStartTime = Date.now();
      const genId = generation.id;

      try {
        await supabase.from("media_asset_generations").update({ status: "generating" }).eq("id", genId);

        const settings = (generation.settings || {}) as GenerationSettings;
        const assetType = settings.asset_type || "image";

        if (assetType === "video") {
          throw new Error("Geração de vídeo não disponível. Use o Gestor de Criativos para vídeos.");
        }

        const matchedProducts = settings.matched_products || [];
        const needsProductImage = settings.needs_product_image ?? false;
        const isKitScenario = settings.is_kit_scenario ?? false;
        const enableQA = settings.enable_qa !== false;
        const contentType = settings.content_type || "image";

        const productWithImage = matchedProducts.find((p) => p.image_url);
        let referenceBase64: string | null = null;
        let finalPrompt = generation.prompt_final;

        if (needsProductImage && productWithImage?.image_url) {
          referenceBase64 = await downloadImageAsBase64(productWithImage.image_url);
          if (!referenceBase64) {
            throw new Error(`Não foi possível baixar a imagem do produto "${productWithImage.name}".`);
          }

          const kitInstruction = isKitScenario
            ? `CENÁRIO DE KIT (${matchedProducts.length} produtos):\n- PROIBIDO: pessoa segurando múltiplos produtos na mão\n- OBRIGATÓRIO: apresentar em bancada, flatlay ou ambiente lifestyle\n- Produtos APOIADOS em superfície, organizados elegantemente`
            : `CENÁRIO DE PRODUTO ÚNICO:\n- Pode mostrar modelo segurando de forma natural\n- Máximo 1 produto por mão, pose elegante`;

          finalPrompt = `REGRA ABSOLUTA — PRODUTO IMUTÁVEL:
A imagem anexada é a foto REAL do produto "${productWithImage.name}".
O produto NÃO PODE ser alterado de NENHUMA forma. Ele é SAGRADO e IMUTÁVEL.
- NÃO redesenhe, recrie ou reimagine o produto
- NÃO mude a embalagem, rótulo, formato, cores ou proporções
- NÃO crie variações do produto

VOCÊ PODE APENAS:
- Mudar o AMBIENTE/CENÁRIO ao redor do produto
- Adicionar CONTEXTO (mãos segurando, bancada, flatlay)
- Aplicar efeitos leves de iluminação/sombra NO AMBIENTE

${kitInstruction}

ESTILO: Fotografia profissional editorial/UGC, iluminação premium.
FORMATO: ${contentType === "story" || contentType === "reel" ? "Vertical 9:16" : "Quadrado 1:1"}

PROIBIÇÕES ABSOLUTAS:
- NÃO inventar rótulos/logos
- NÃO alterar cores/design do produto
- NÃO adicionar texto sobreposto

BRIEFING DO CRIATIVO: ${generation.prompt_final}`;
        }

        // Use unified resilientGenerate from visual-engine
        const productImageUrl = productWithImage?.image_url || null;
        const result = await resilientGenerate({
          lovableApiKey,
          openaiApiKey,
          geminiApiKey,
          falApiKey: falApiKeyValue,
          prompt: finalPrompt,
          referenceImageBase64: referenceBase64,
          referenceImageUrl: productImageUrl,
          outputSize: '1024x1024',
          slotLabel: `media-${genId.substring(0, 8)}`,
        });

        if (!result.imageBase64) {
          throw new Error(`Nenhum provedor gerou imagem: ${result.error}`);
        }

        // QA Scoring
        let scores: QAScores = { realism: 7, quality: 7, composition: 7, label: 7, overall: 0.7 };
        if (enableQA) {
          scores = await scoreImageForRealism(lovableApiKey, result.imageBase64, referenceBase64, productWithImage?.name || "Produto");
        }

        // Upload winner to storage
        const binaryData = Uint8Array.from(atob(result.imageBase64), (c) => c.charCodeAt(0));
        const storagePath = `${generation.tenant_id}/${genId}/${result.actualProvider}_winner.png`;

        const { error: uploadError } = await supabase.storage.from("media-assets").upload(storagePath, binaryData, { contentType: "image/png", upsert: true });
        if (uploadError) throw new Error("Falha ao salvar imagem no storage");

        await supabase.from("media_asset_variants").insert({
          generation_id: genId, variant_index: 1, storage_path: storagePath,
          mime_type: "image/png", file_size: binaryData.length, width: 1024, height: 1024,
        });

        const { data: publicUrlData } = supabase.storage.from("media-assets").getPublicUrl(storagePath);
        const publicUrl = publicUrlData?.publicUrl;

        // Update calendar item + register in Drive
        if (publicUrl && generation.calendar_item_id) {
          await supabase.from("media_calendar_items").update({ asset_url: publicUrl, asset_thumbnail_url: publicUrl }).eq("id", generation.calendar_item_id);

          try {
            const { data: calItem } = await supabase.from("media_calendar_items").select("campaign_id").eq("id", generation.calendar_item_id).single();
            if (calItem?.campaign_id) {
              const { data: campaignData } = await supabase.from("media_campaigns").select("start_date, created_by").eq("id", calItem.campaign_id).single();
              if (campaignData?.start_date) {
                const monthFolderId = await ensureMediaMonthFolderEdge(supabase, generation.tenant_id, campaignData.created_by || generation.tenant_id, campaignData.start_date);
                if (monthFolderId) {
                  const filename = `${result.actualProvider}_winner_${genId.slice(0, 8)}.png`;
                  await supabase.from("files").insert({
                    tenant_id: generation.tenant_id, folder_id: monthFolderId, filename, original_name: filename,
                    storage_path: storagePath, mime_type: "image/png", size_bytes: binaryData.length,
                    is_folder: false, is_system_folder: false, created_by: campaignData.created_by,
                    metadata: { source: "media_ai_creative", url: publicUrl, bucket: "media-assets", system_managed: true },
                  });
                }
              }
            }
          } catch (driveErr) {
            console.error("⚠️ Drive registration failed (non-blocking):", driveErr);
          }
        }

        const elapsedMs = Date.now() - genStartTime;

        await supabase.from("media_asset_generations").update({
          status: "succeeded", completed_at: new Date().toISOString(),
          provider: result.actualProvider, model: result.model,
          settings: {
            ...settings,
            processing_time_ms: elapsedMs,
            used_product_reference: !!referenceBase64,
            pipeline_version: VERSION,
            winner: { provider: result.actualProvider, model: result.model, scores },
          },
        }).eq("id", genId);

        processed++;
        results.push({ id: genId, status: "succeeded", winner: result.actualProvider, winnerScore: scores.overall, timeMs: elapsedMs });

      } catch (genError) {
        console.error(`❌ Error processing ${genId}:`, genError);
        const errorMessage = genError instanceof Error ? genError.message : "Erro desconhecido";
        await supabase.from("media_asset_generations").update({
          status: "failed", error_message: errorMessage, completed_at: new Date().toISOString(),
        }).eq("id", genId);
        failed++;
        results.push({ id: genId, status: "failed", error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, failed, results, version: VERSION }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'media', action: 'process-generation-queue' });
  }
});
