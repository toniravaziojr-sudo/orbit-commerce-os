// =====================================================
// IMPORT INSTITUTIONAL PAGES - Sistema Universal
// =====================================================
// Importa páginas institucionais de QUALQUER plataforma
// detectando pelo CONTEÚDO (texto puro), não por slugs
// 
// FLUXO:
// 1. Descobrir TODOS os links do site via Firecrawl
// 2. Filtrar candidatos por URL (excluir funcionais)
// 3. Validar cada candidato pelo CONTEÚDO
// 4. Converter markdown para RichText builder block
// 5. Salvar páginas aprovadas
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

// =====================================================
// PADRÕES DE EXCLUSÃO POR URL (páginas funcionais)
// =====================================================
const EXCLUDED_URL_PATTERNS = [
  /^\/?$/,                                    // Home
  /\/cart|\/carrinho|\/sacola|\/bag/i,        // Carrinho
  /\/checkout|\/finalizar/i,                  // Checkout
  /\/login|\/signin|\/sign-in|\/entrar/i,     // Login
  /\/register|\/signup|\/sign-up|\/cadastro|\/criar-conta/i, // Cadastro
  /\/account|\/minha-conta|\/my-account|\/perfil|\/profile/i, // Conta
  /\/wishlist|\/favoritos|\/lista-de-desejos/i, // Favoritos
  /\/search|\/busca|\/pesquisa/i,             // Busca
  /\/track|\/rastreio|\/rastrear|\/rastreamento|\/tracking/i, // Rastreio
  /\/blog|\/artigo|\/article|\/post|\/noticias|\/news/i, // Blog
  /\/contato|\/contact|\/fale-conosco/i,      // Contato (geralmente form)
  /\/ajuda|\/help|\/suporte|\/support|\/central-de-ajuda/i, // Help center
  /\/produto|\/product|\/p\/|\/item\//i,      // Produto
  /\/categoria|\/category|\/colecao|\/collection|\/c\//i, // Categoria
  /\/departamento|\/department/i,             // Departamento
  /\/marca|\/brand/i,                         // Marca
  /\/pedido|\/order|\/orders|\/meus-pedidos/i, // Pedidos
  /\/api\//i,                                 // API
  /\.(?:jpg|jpeg|png|gif|webp|svg|pdf|xml|json|css|js)$/i, // Arquivos
  /\/sitemap|\/robots\.txt|\/feed/i,          // SEO/Feed
  /\/compare|\/comparar/i,                    // Comparação
  /\/newsletter|\/subscribe/i,                // Newsletter
  /\/quiz|\/teste|\/avaliacao/i,              // Quiz/Teste
  /\/cupom|\/coupon|\/desconto|\/promo/i,     // Cupons
  /\/parceiros|\/partners|\/afiliados|\/affiliate/i, // Parceiros
  /\/loja|\/store-locator|\/encontre/i,       // Localizador de loja
  // NOVOS: Listagens genéricas
  /\/todos-|\/all-|\/shop\//i,                // Listagens genéricas
  /\/kit|\/combo|\/bundle/i,                  // Kits/combos
  /\/lancamento|\/novidade|\/new-arrivals/i,  // Novidades
  /\/ofertas|\/promocoes|\/sale/i,            // Promoções
  /\/mais-vendidos|\/best-sellers/i,          // Mais vendidos
];

// =====================================================
// INTERFACES
// =====================================================
interface ImportRequest {
  tenantId: string;
  storeUrl: string;
}

interface CandidatePage {
  url: string;
  slug: string;
}

interface ValidatedPage {
  url: string;
  slug: string;
  title: string;
  content: string;
  wordCount: number;
}

interface ImportedPage {
  id: string;
  title: string;
  slug: string;
  wordCount: number;
}

interface ImportResult {
  success: boolean;
  pages: ImportedPage[];
  skipped: Array<{ url: string; reason: string }>;
  stats: {
    linksDiscovered: number;
    candidates: number;
    validated: number;
    imported: number;
    skipped: number;
    processingTimeMs: number;
  };
  error?: string;
}

// =====================================================
// 1. DESCOBRIR TODOS OS LINKS DO SITE
// =====================================================
async function discoverAllLinks(storeUrl: string): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) {
    console.error('[import-inst] FIRECRAWL_API_KEY não configurada');
    return [];
  }

  console.log(`[import-inst] Descobrindo links de: ${storeUrl}`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: storeUrl,
        formats: ['links'],
        onlyMainContent: false, // Incluir footer, header, TUDO
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      console.error(`[import-inst] Firecrawl error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const links = data.data?.links || [];
    
    console.log(`[import-inst] Total de links descobertos: ${links.length}`);
    return links;

  } catch (error) {
    console.error('[import-inst] Erro ao descobrir links:', error);
    return [];
  }
}

// =====================================================
// 2. FILTRAR CANDIDATOS POR URL
// =====================================================
function filterCandidatePages(allLinks: string[], origin: string): CandidatePage[] {
  const seen = new Set<string>();
  const candidates: CandidatePage[] = [];

  for (const link of allLinks) {
    // Apenas links do mesmo domínio
    if (!link.startsWith(origin)) continue;

    // Remover query params, anchor e trailing slash para deduplicação
    const cleanUrl = link.split('?')[0].split('#')[0].replace(/\/$/, '');
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    // Extrair pathname
    let pathname: string;
    try {
      pathname = new URL(cleanUrl).pathname.toLowerCase();
    } catch {
      continue;
    }

    // Verificar se é página excluída
    if (EXCLUDED_URL_PATTERNS.some(pattern => pattern.test(pathname))) {
      continue;
    }

    // Extrair slug do pathname
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) continue;

    // Remover prefixos comuns de plataformas
    const platformPrefixes = ['pages', 'pagina', 'paginas', 'institucional', 'policies', 'policy', 'info'];
    let slugParts = pathParts;
    if (platformPrefixes.includes(pathParts[0])) {
      slugParts = pathParts.slice(1);
    }

    const slug = slugParts.join('-') || pathParts[pathParts.length - 1];
    if (!slug || slug.length < 2) continue;

    candidates.push({
      url: cleanUrl,
      slug,
    });
  }

  console.log(`[import-inst] Candidatos após filtro URL: ${candidates.length}`);
  return candidates;
}

// =====================================================
// 3. VALIDAR PÁGINA COMO INSTITUCIONAL (POR CONTEÚDO)
// =====================================================
async function validatePageAsInstitutional(pageUrl: string): Promise<{
  valid: boolean;
  title: string;
  content: string;
  wordCount: number;
  reason?: string;
}> {
  if (!FIRECRAWL_API_KEY) {
    return { valid: false, title: '', content: '', wordCount: 0, reason: 'API key não configurada' };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pageUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: true, // Apenas conteúdo principal
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      return { valid: false, title: '', content: '', wordCount: 0, reason: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const markdown = data.data?.markdown || '';
    const html = data.data?.html || '';
    const title = data.data?.metadata?.title || '';

    // === CRITÉRIOS DE PÁGINA INSTITUCIONAL ===

    // 1. Contar palavras (texto puro)
    const cleanText = markdown.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const wordCount = cleanText.split(/\s+/).filter((w: string) => w.length > 0).length;

    // REJEITAR: menos de 100 palavras (muito curto para ser institucional)
    if (wordCount < 100) {
      return { valid: false, title, content: '', wordCount, reason: 'Conteúdo muito curto (< 100 palavras)' };
    }

    // 2. Verificar proporção texto vs elementos visuais
    const imageCount = (markdown.match(/!\[/g) || []).length;
    
    // REJEITAR: mais de 10 imagens (página de produtos/galeria)
    if (imageCount > 10) {
      return { valid: false, title, content: '', wordCount, reason: 'Muitas imagens (> 10)' };
    }

    // 3. Verificar ratio links/palavras
    const linkCount = (markdown.match(/\]\(/g) || []).length;
    const linkRatio = linkCount / wordCount;
    
    // REJEITAR: ratio links/palavras muito alto (página de navegação)
    if (linkRatio > 0.3) {
      return { valid: false, title, content: '', wordCount, reason: 'Muitos links (ratio > 30%)' };
    }

    // 4. Verificar formulários pelo CONTEÚDO (markdown), não pelo HTML
    // Footer/header têm forms (busca, newsletter) que poluem o HTML
    // Verificamos apenas se o CONTEÚDO principal é um formulário de contato
    const isContactFormPage = (
      /preencha|formulário|envie sua mensagem|entre em contato|send.*message/i.test(markdown) &&
      /(?:nome|name|email|telefone|phone|mensagem|message)\s*[\n:]/i.test(markdown) &&
      wordCount < 200 // Página de contato tem pouco texto próprio
    );
    if (isContactFormPage) {
      return { valid: false, title, content: '', wordCount, reason: 'Página de formulário de contato' };
    }

    // 5. Verificar vídeos embed - só rejeitar se for página predominantemente de vídeo
    const videoCount = (html.match(/<iframe[^>]*(?:youtube|vimeo|youtu\.be)/gi) || []).length;
    if (videoCount > 2 || (videoCount > 0 && wordCount < 100)) {
      return { valid: false, title, content: '', wordCount, reason: 'Página de vídeo' };
    }

    // 6. Verificar indicadores de produto/comércio no MARKDOWN (conteúdo limpo)
    if (/(?:\$|R\$|€|£)\s*\d+[.,]\d{2}|add.?to.?cart|adicionar.?ao.?carrinho|comprar.?agora|buy.?now/i.test(markdown)) {
      return { valid: false, title, content: '', wordCount, reason: 'Conteúdo de produto/loja' };
    }

    // 7. Verificar se é página de listagem (muitos itens repetidos)
    const productCardPatterns = (html.match(/product-card|product-item|item-produto|card-produto/gi) || []).length;
    if (productCardPatterns > 3) {
      return { valid: false, title, content: '', wordCount, reason: 'Página de listagem de produtos' };
    }

    // === PASSOU EM TODOS OS CRITÉRIOS ===

    // Limpar markdown para nosso formato
    const cleanContent = markdown
      .replace(/!\[.*?\]\(.*?\)/g, '')           // Remover imagens
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // Links -> texto
      .trim();

    return { valid: true, title, content: cleanContent, wordCount };

  } catch (error) {
    console.error(`[import-inst] Erro ao validar ${pageUrl}:`, error);
    return { valid: false, title: '', content: '', wordCount: 0, reason: 'Erro ao buscar página' };
  }
}

// =====================================================
// 4. CONVERTER MARKDOWN PARA BUILDER BLOCK
// =====================================================
function markdownToBuilderBlock(title: string, markdownContent: string): Record<string, unknown> {
  // Converter markdown básico para HTML
  let htmlContent = markdownContent
    // Headings
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold e Italic
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Listas
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // Parágrafos (linhas duplas)
    .replace(/\n\n/g, '</p><p>')
    // Line breaks simples
    .replace(/\n/g, '<br/>');

  // Wrap em parágrafo
  htmlContent = `<p>${htmlContent}</p>`;
  
  // Limpar tags vazias
  htmlContent = htmlContent
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>\s*<br\/>\s*<\/p>/g, '')
    .replace(/<br\/>\s*<br\/>/g, '<br/>');

  // Criar bloco RichText
  const richTextBlock = {
    id: `richtext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'RichText',
    props: {
      content: htmlContent,
      alignment: 'left',
      maxWidth: 'md',
    },
  };

  // Criar estrutura da página
  const blocks: unknown[] = [];

  // Adicionar título se não estiver no conteúdo
  const contentLower = markdownContent.toLowerCase();
  const titleLower = title.toLowerCase();
  if (title && !contentLower.startsWith(`# ${titleLower}`) && !contentLower.includes(`\n# ${titleLower}`)) {
    blocks.push({
      id: `title-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'TextBanners',
      props: {
        title: title,
        subtitle: '',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }

  blocks.push(richTextBlock);

  return {
    type: 'Page',
    id: `page-${Date.now()}`,
    props: { backgroundColor: 'transparent', padding: 'md' },
    children: blocks,
  };
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const importedPages: ImportedPage[] = [];
  const skippedPages: Array<{ url: string; reason: string }> = [];
  let linksDiscovered = 0;
  let candidatesCount = 0;
  let validatedCount = 0;

  try {
    const { tenantId, storeUrl }: ImportRequest = await req.json();

    if (!tenantId || !storeUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'tenantId e storeUrl são obrigatórios',
          pages: [],
          skipped: [],
          stats: { linksDiscovered: 0, candidates: 0, validated: 0, imported: 0, skipped: 0, processingTimeMs: 0 },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'FIRECRAWL_API_KEY não configurada. Conecte o Firecrawl em Integrações.',
          pages: [],
          skipped: [],
          stats: { linksDiscovered: 0, candidates: 0, validated: 0, imported: 0, skipped: 0, processingTimeMs: 0 },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-inst] Iniciando importação universal: ${storeUrl} para tenant ${tenantId}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalizar URL
    let normalizedUrl = storeUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const origin = new URL(normalizedUrl).origin;

    // 1. DESCOBRIR TODOS OS LINKS DO SITE
    const allLinks = await discoverAllLinks(normalizedUrl);
    linksDiscovered = allLinks.length;

    if (allLinks.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível descobrir links do site. Verifique se a URL está correta.',
          pages: [],
          skipped: [],
          stats: { linksDiscovered: 0, candidates: 0, validated: 0, imported: 0, skipped: 0, processingTimeMs: Date.now() - startTime },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. FILTRAR CANDIDATOS POR URL
    const candidates = filterCandidatePages(allLinks, origin);
    candidatesCount = candidates.length;

    // 3. BUSCAR SLUGS EXISTENTES PARA EVITAR DUPLICATAS
    const { data: existingPages } = await supabase
      .from('store_pages')
      .select('slug')
      .eq('tenant_id', tenantId);

    const existingSlugs = new Set((existingPages || []).map(p => p.slug));

    // 4. VALIDAR E PROCESSAR CADA CANDIDATO
    const maxPages = 15; // Limite para evitar timeout
    let processed = 0;

    for (const candidate of candidates) {
      if (processed >= maxPages) {
        console.log('[import-inst] Limite de páginas atingido');
        break;
      }

      // Verificar timeout (45s)
      if (Date.now() - startTime > 45000) {
        console.warn('[import-inst] Timeout, parando importação');
        break;
      }

      // Verificar duplicata
      if (existingSlugs.has(candidate.slug)) {
        skippedPages.push({ url: candidate.url, reason: 'Slug já existe' });
        continue;
      }

      processed++;
      console.log(`[import-inst] Validando: ${candidate.url}`);

      // Validar pelo CONTEÚDO
      const validation = await validatePageAsInstitutional(candidate.url);

      if (!validation.valid) {
        skippedPages.push({ url: candidate.url, reason: validation.reason || 'Não é institucional' });
        console.log(`[import-inst] SKIP: ${candidate.slug} - ${validation.reason}`);
        continue;
      }

      validatedCount++;
      console.log(`[import-inst] ✓ Válida: ${candidate.slug} (${validation.wordCount} palavras)`);

      try {
        // Converter para builder block
        const builderContent = markdownToBuilderBlock(
          validation.title || candidate.slug.replace(/-/g, ' '),
          validation.content
        );

        // Salvar no banco
        const pageTitle = validation.title || candidate.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        const { data: newPage, error: insertError } = await supabase
          .from('store_pages')
          .insert({
            tenant_id: tenantId,
            title: pageTitle,
            slug: candidate.slug,
            type: 'institutional',
            status: 'draft',
            content: builderContent,
            builder_enabled: true,
            seo_title: pageTitle,
            seo_description: validation.content.replace(/[#*_\[\]]/g, '').slice(0, 155).trim(),
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[import-inst] Erro ao salvar ${candidate.slug}:`, insertError);
          skippedPages.push({ url: candidate.url, reason: `Erro: ${insertError.message}` });
          continue;
        }

        // Registrar no import_items para limpeza futura
        const trackingJobId = crypto.randomUUID();
        await supabase
          .from('import_items')
          .insert({
            job_id: trackingJobId,
            tenant_id: tenantId,
            module: 'pages',
            external_id: candidate.url,
            internal_id: newPage.id,
            status: 'success',
            data_raw: { url: candidate.url, slug: candidate.slug },
            data_normalized: { wordCount: validation.wordCount, title: pageTitle },
          });

        importedPages.push({
          id: newPage.id,
          title: pageTitle,
          slug: candidate.slug,
          wordCount: validation.wordCount,
        });

        existingSlugs.add(candidate.slug); // Evitar duplicata no mesmo batch
        console.log(`[import-inst] ✓ Importada: ${candidate.slug}`);

      } catch (e) {
        console.error(`[import-inst] Erro em ${candidate.url}:`, e);
        skippedPages.push({
          url: candidate.url,
          reason: `Erro: ${e instanceof Error ? e.message : 'desconhecido'}`,
        });
      }
    }

    // Resultado final
    const result: ImportResult = {
      success: true,
      pages: importedPages,
      skipped: skippedPages,
      stats: {
        linksDiscovered,
        candidates: candidatesCount,
        validated: validatedCount,
        imported: importedPages.length,
        skipped: skippedPages.length,
        processingTimeMs: Date.now() - startTime,
      },
    };

    console.log(`[import-inst] Concluído:`, result.stats);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[import-inst] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        pages: importedPages,
        skipped: skippedPages,
        stats: {
          linksDiscovered,
          candidates: candidatesCount,
          validated: validatedCount,
          imported: importedPages.length,
          skipped: skippedPages.length,
          processingTimeMs: Date.now() - startTime,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
