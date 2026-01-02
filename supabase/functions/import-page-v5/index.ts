// =============================================
// IMPORT PAGE V5 - Sistema de Importação Enterprise
// Arquitetura de 3 Passos com IA Contextual
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzePageStrategically, createFallbackPlan } from '../_shared/ai-strategic-analyzer.ts';
import { extractPageContent, createFallbackExtraction } from '../_shared/ai-content-extractor.ts';
import { optimizePage, applyOptimizations } from '../_shared/ai-marketing-optimizer.ts';
import type { ImportV5Result, ExtractedBlock } from '../_shared/marketing/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

// Fetch HTML usando Firecrawl ou fetch direto
async function fetchPageContent(url: string): Promise<{ html: string; title: string; screenshot?: string }> {
  // Tentar Firecrawl primeiro (melhor para SPAs)
  if (FIRECRAWL_API_KEY) {
    try {
      console.log('[Import v5] Usando Firecrawl para scrape...');
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['html'],
          onlyMainContent: false,
          waitFor: 3000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.html) {
          return {
            html: data.data.html,
            title: data.data.metadata?.title || '',
            screenshot: data.data.screenshot,
          };
        }
      }
      console.log('[Import v5] Firecrawl falhou, tentando fetch direto...');
    } catch (e) {
      console.error('[Import v5] Erro no Firecrawl:', e);
    }
  }

  // Fallback: fetch direto
  console.log('[Import v5] Usando fetch direto...');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PageImporter/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao acessar página: ${response.status}`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  
  return {
    html,
    title: titleMatch?.[1]?.trim() || '',
  };
}

// Converte blocos extraídos para estrutura do Builder
function convertToBuilderBlocks(blocks: ExtractedBlock[]): { type: string; id: string; props: Record<string, unknown>; children: unknown[] }[] {
  return blocks.map((block, index) => ({
    type: block.type,
    id: `imported-${block.type.toLowerCase()}-${index}-${Date.now()}`,
    props: block.props,
    children: [],
  }));
}

// Gera slug a partir de URL ou título
function generateSlug(url: string, title?: string): string {
  if (title) {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  try {
    const urlObj = new URL(url);
    const pathSlug = urlObj.pathname
      .replace(/\/$/, '')
      .split('/')
      .pop() || 'pagina-importada';
    return pathSlug.slice(0, 50);
  } catch {
    return 'pagina-importada';
  }
}

// Handler principal
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let aiCallsCount = 0;

  try {
    const { tenantId, url, slug: customSlug, title: customTitle } = await req.json();

    if (!tenantId || !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId e url são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Import v5] Iniciando importação...', { tenantId, url });

    // ========== PASSO 0: FETCH DO CONTEÚDO ==========
    console.log('[Import v5] Passo 0: Buscando conteúdo da página...');
    const { html, title: extractedTitle, screenshot } = await fetchPageContent(url);
    console.log('[Import v5] HTML obtido:', html.length, 'chars');

    // ========== PASSO 1: ANÁLISE ESTRATÉGICA ==========
    console.log('[Import v5] Passo 1: Análise estratégica...');
    let strategicPlan;
    try {
      const analysis = await analyzePageStrategically(html, url, { screenshotBase64: screenshot });
      strategicPlan = analysis.plan;
      aiCallsCount++;
    } catch (e) {
      console.error('[Import v5] Erro na análise estratégica, usando fallback:', e);
      strategicPlan = createFallbackPlan(url, html);
    }
    console.log('[Import v5] Framework escolhido:', strategicPlan.framework);

    // ========== PASSO 2: EXTRAÇÃO DE CONTEÚDO ==========
    console.log('[Import v5] Passo 2: Extração de conteúdo...');
    let extraction;
    try {
      const extractionResult = await extractPageContent(html, strategicPlan);
      extraction = extractionResult.result;
      aiCallsCount++;
    } catch (e) {
      console.error('[Import v5] Erro na extração, usando fallback:', e);
      extraction = createFallbackExtraction(html);
    }
    console.log('[Import v5] Blocos extraídos:', extraction.blocks.length);

    // ========== PASSO 3: OTIMIZAÇÃO ==========
    console.log('[Import v5] Passo 3: Otimização...');
    let optimization;
    try {
      const optimizationResult = await optimizePage(strategicPlan, extraction, { skipIfHighQuality: true });
      optimization = optimizationResult.result;
      if (optimizationResult.rawResponse) aiCallsCount++;
    } catch (e) {
      console.error('[Import v5] Erro na otimização:', e);
      optimization = {
        qualityScore: extraction.extractionQuality,
        frameworkCompliance: 70,
        issues: [],
        suggestions: [],
        missingElements: [],
      };
    }
    console.log('[Import v5] Score de qualidade:', optimization.qualityScore);

    // Aplicar otimizações se houver
    const finalBlocks = applyOptimizations(extraction.blocks, optimization);

    // ========== SALVAR NO BANCO ==========
    console.log('[Import v5] Salvando página no banco...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const pageTitle = customTitle || extractedTitle || strategicPlan.productName || 'Página Importada';
    const baseSlug = customSlug || generateSlug(url, pageTitle);

    // Verificar slug único
    let finalSlug = baseSlug;
    let slugSuffix = 1;
    while (true) {
      const { data: existing } = await supabase
        .from('store_pages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', finalSlug)
        .maybeSingle();
      
      if (!existing) break;
      finalSlug = `${baseSlug}-${slugSuffix++}`;
    }

    // Construir conteúdo da página
    const pageContent = {
      type: 'Page',
      id: `page-${Date.now()}`,
      props: { backgroundColor: 'transparent', padding: 'none' },
      children: convertToBuilderBlocks(finalBlocks),
    };

    // Inserir página
    const { data: page, error: insertError } = await supabase
      .from('store_pages')
      .insert({
        tenant_id: tenantId,
        title: pageTitle,
        slug: finalSlug,
        type: 'institutional',
        status: 'draft',
        content: pageContent,
        seo_title: pageTitle,
        seo_description: strategicPlan.mainPromise || '',
        builder_enabled: true,
        page_overrides: {
          importedFrom: url,
          importVersion: 'v5',
          strategicPlan: {
            productType: strategicPlan.productType,
            framework: strategicPlan.framework,
            confidence: strategicPlan.confidence,
          },
          optimization: {
            qualityScore: optimization.qualityScore,
            frameworkCompliance: optimization.frameworkCompliance,
          },
        },
      })
      .select('id, title, slug')
      .single();

    if (insertError) {
      console.error('[Import v5] Erro ao inserir página:', insertError);
      throw new Error(`Erro ao salvar página: ${insertError.message}`);
    }

    const processingTimeMs = Date.now() - startTime;
    console.log('[Import v5] Importação concluída em', processingTimeMs, 'ms');

    const result: ImportV5Result = {
      success: true,
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
      },
      strategicPlan,
      extraction,
      optimization,
      stats: {
        blocksCreated: finalBlocks.length,
        aiCallsCount,
        processingTimeMs,
      },
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Import v5] Erro:', error);
    const result: ImportV5Result = {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stats: {
        blocksCreated: 0,
        aiCallsCount,
        processingTimeMs: Date.now() - startTime,
      },
    };
    return new Response(
      JSON.stringify(result),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
