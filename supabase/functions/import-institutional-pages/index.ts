// =====================================================
// IMPORT INSTITUTIONAL PAGES - Páginas de Texto do Footer
// =====================================================
// Importa APENAS páginas institucionais de texto (políticas, termos, etc.)
// 
// REGRAS RÍGIDAS:
// - Fonte: links do FOOTER prioritariamente
// - Tipo: APENAS páginas de texto (sem forms, vídeos, apps)
// - Conteúdo: Extrai texto REAL, nunca placeholder
// - Deduplicação: Rejeita duplicatas (não cria slug-1, slug-2)
// - Qualidade: Se não extrair conteúdo real, SKIP (nunca salvar vazio)
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

// =====================================================
// SLUGS CONHECIDOS DE PÁGINAS INSTITUCIONAIS
// =====================================================
const INSTITUTIONAL_SLUGS = new Set([
  // Sobre/Empresa
  'sobre', 'about', 'about-us', 'quem-somos', 'nossa-historia', 'nossa-empresa',
  'nossa-missao', 'nosso-time', 'nossa-equipe', 'conheca-nos', 'a-empresa',
  'who-we-are', 'our-story', 'our-team', 'company', 'institucional',
  
  // Políticas
  'politica-de-privacidade', 'privacy-policy', 'privacy', 'privacidade',
  'politica-de-cookies', 'cookies', 'cookie-policy',
  'lgpd', 'gdpr', 'protecao-de-dados', 'data-protection',
  
  // Termos
  'termos-de-uso', 'terms-of-use', 'terms', 'termos', 'termos-e-condicoes',
  'terms-and-conditions', 'terms-of-service', 'tos',
  'condicoes-gerais', 'regulamento',
  
  // Trocas/Devoluções
  'troca-e-devolucao', 'trocas-e-devolucoes', 'devolucao', 'politica-de-troca',
  'exchange', 'returns', 'return-policy', 'refund', 'refund-policy',
  'garantia', 'warranty',
  
  // FAQ/Ajuda (FAQ textual simples, sem formulário)
  'faq', 'perguntas-frequentes', 'duvidas', 'duvidas-frequentes',
  
  // Como comprar/Pagamento
  'como-comprar', 'how-to-buy', 'como-funciona', 'how-it-works',
  'formas-de-pagamento', 'payment-methods', 'pagamento', 'payment',
  'parcelamento', 'installments',
  
  // Entrega/Frete
  'entrega', 'entregas', 'shipping', 'delivery', 'frete', 'envio',
  'prazo-de-entrega', 'delivery-time', 'politica-de-entrega', 'shipping-policy',
  
  // Trabalhe conosco (textual, sem form complexo)
  'trabalhe-conosco', 'careers', 'vagas', 'jobs', 'oportunidades',
  
  // Lojas físicas
  'lojas', 'stores', 'nossas-lojas', 'our-stores', 'onde-encontrar',
]);

// Padrões que EXCLUEM a página (funcionalidades, não texto)
const EXCLUDED_PATTERNS = [
  /login|signin|sign-in|entrar/i,
  /cadastro|cadastrar|register|signup|sign-up|criar-conta/i,
  /minha-conta|my-account|account|conta|perfil|profile/i,
  /carrinho|cart|sacola|bag/i,
  /checkout|finalizar|pagamento/i,
  /pedido|order|orders|meus-pedidos/i,
  /wishlist|favoritos|lista-de-desejos/i,
  /busca|search|pesquisa/i,
  /rastreio|rastrear|rastreamento|tracking|track/i,
  /blog|artigo|article|post|noticias|news/i,
  /contato|contact|fale-conosco/i, // Contato geralmente tem form
  /ajuda|help|suporte|support|central-de-ajuda/i, // Help center geralmente tem busca/form
  /^\/?produto|^\/?product/i,
  /^\/?categoria|^\/?category|^\/?colecao|^\/?collection/i,
  /^\/?departamento/i,
  /api\//i,
  /\.json$|\.xml$/i,
];

// =====================================================
// INTERFACES
// =====================================================
interface ImportRequest {
  tenantId: string;
  storeUrl: string;
}

interface DetectedPage {
  url: string;
  title: string;
  slug: string;
  confidence: number;
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
    detected: number;
    imported: number;
    skipped: number;
    processingTimeMs: number;
  };
  error?: string;
}

// =====================================================
// FETCH HTML
// =====================================================
async function fetchHtml(url: string): Promise<string> {
  if (FIRECRAWL_API_KEY) {
    try {
      console.log(`[import-inst] Firecrawl: ${url}`);
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
          waitFor: 2000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.html) {
          return data.data.html;
        }
      }
    } catch (e) {
      console.error('[import-inst] Firecrawl error:', e);
    }
  }

  // Fallback direto
  console.log(`[import-inst] Direct fetch: ${url}`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; InstitutionalPageImporter/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }

  return response.text();
}

// =====================================================
// EXTRAIR LINKS DO FOOTER
// =====================================================
function extractFooterLinks(html: string, baseUrl: string): DetectedPage[] {
  const pages: DetectedPage[] = [];
  const seenSlugs = new Set<string>();
  
  // Normalizar base URL
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    console.error('[import-inst] Invalid base URL:', baseUrl);
    return [];
  }
  
  // Extrair footer HTML
  const footerPatterns = [
    /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
    /<div[^>]*(?:class|id)="[^"]*(?:footer|rodape)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?\s*(?:<\/body>|$)/gi,
  ];
  
  let footerHtml = '';
  for (const pattern of footerPatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      footerHtml += match[1];
    }
  }
  
  if (!footerHtml) {
    console.log('[import-inst] Footer não encontrado, usando HTML completo (fallback)');
    footerHtml = html;
  }
  
  // Extrair links
  const linkRegex = /<a[^>]*href=["']([^"'#]+)["'][^>]*>([^<]*(?:<[^/a][^>]*>[^<]*)*)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(footerHtml)) !== null) {
    const [, href, rawText] = match;
    if (!href || href === '/') continue;
    
    // Limpar texto
    const title = rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (title.length < 3 || title.length > 100) continue;
    
    // Normalizar URL
    let fullUrl: string;
    let pathname: string;
    try {
      if (href.startsWith('http')) {
        const urlObj = new URL(href);
        if (urlObj.origin !== origin) continue; // Skip externo
        fullUrl = href;
        pathname = urlObj.pathname;
      } else if (href.startsWith('/')) {
        fullUrl = `${origin}${href}`;
        pathname = href;
      } else {
        continue;
      }
    } catch {
      continue;
    }
    
    // Normalizar pathname
    pathname = pathname.replace(/\/$/, '').toLowerCase();
    
    // Verificar se é página excluída
    if (EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname))) {
      continue;
    }
    
    // Extrair slug
    const pathParts = pathname.split('/').filter(Boolean);
    let slug = pathParts[pathParts.length - 1] || '';
    
    // Remover prefixos comuns (pages/, pagina/, institucional/)
    if (['pages', 'pagina', 'institucional', 'policies'].includes(pathParts[0])) {
      slug = pathParts.slice(1).join('-') || pathParts[0];
    }
    
    if (!slug || seenSlugs.has(slug)) continue;
    
    // Calcular confiança
    let confidence = 0.3; // Base
    
    // Boost se slug conhecido
    if (INSTITUTIONAL_SLUGS.has(slug)) {
      confidence += 0.5;
    }
    
    // Boost se título indica institucional
    const titleLower = title.toLowerCase();
    if (/pol[íi]tica|termos|troca|devolu|sobre|privacidade|entrega|frete|pagamento|garantia|faq|perguntas/i.test(titleLower)) {
      confidence += 0.3;
    }
    
    // Se confiança mínima não atingida e slug não reconhecido, pular
    if (confidence < 0.5) continue;
    
    seenSlugs.add(slug);
    pages.push({
      url: fullUrl,
      title,
      slug,
      confidence,
    });
  }
  
  // Ordenar por confiança
  pages.sort((a, b) => b.confidence - a.confidence);
  
  console.log(`[import-inst] Detectadas ${pages.length} páginas institucionais candidatas`);
  
  return pages;
}

// =====================================================
// VERIFICAR SE PÁGINA É ELEGÍVEL (texto, sem forms/apps)
// =====================================================
function isPageEligible(html: string): { eligible: boolean; reason?: string } {
  // Verificar se tem formulário (exceto newsletter simples)
  const formCount = (html.match(/<form[^>]*>/gi) || []).length;
  const hasComplexForm = formCount > 1 || 
    /<form[^>]*>[\s\S]{500,}<\/form>/i.test(html) || // Form com muito conteúdo
    /<input[^>]*type=["'](?:password|file|tel)[^>]*>/i.test(html);
  
  if (hasComplexForm) {
    return { eligible: false, reason: 'Página contém formulário complexo' };
  }
  
  // Verificar se tem vídeo embed (YouTube/Vimeo)
  if (/<iframe[^>]*(?:youtube|vimeo|youtu\.be)[^>]*>/i.test(html)) {
    return { eligible: false, reason: 'Página contém vídeo embed' };
  }
  
  // Verificar se tem muitos scripts (indica app/widget)
  const scriptCount = (html.match(/<script[^>]*>/gi) || []).length;
  if (scriptCount > 20) {
    return { eligible: false, reason: 'Página parece ser um aplicativo (muitos scripts)' };
  }
  
  // Verificar se tem conteúdo de texto mínimo
  const textContent = extractTextContent(html);
  if (textContent.wordCount < 50) {
    return { eligible: false, reason: 'Conteúdo textual insuficiente (menos de 50 palavras)' };
  }
  
  return { eligible: true };
}

// =====================================================
// EXTRAIR CONTEÚDO DE TEXTO DA PÁGINA
// =====================================================
interface TextContent {
  title: string;
  content: string;
  wordCount: number;
}

function extractTextContent(html: string): TextContent {
  // Extrair título
  let title = '';
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    title = h1Match[1].trim();
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].split('|')[0].split('-')[0].trim();
    }
  }
  
  // Extrair main content
  let mainHtml = html;
  
  // Tentar <main>
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    mainHtml = mainMatch[1];
  } else {
    // Tentar <article>
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      mainHtml = articleMatch[1];
    } else {
      // Fallback: remover header/footer/nav
      mainHtml = html
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '');
    }
  }
  
  // Remover scripts, styles, comentários
  mainHtml = mainHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  
  // Converter para blocos de conteúdo limpo (preservar estrutura HTML básica)
  let content = mainHtml
    // Preservar headings
    .replace(/<h([1-6])[^>]*>/gi, '\n<h$1>')
    .replace(/<\/h([1-6])>/gi, '</h$1>\n')
    // Preservar parágrafos
    .replace(/<p[^>]*>/gi, '\n<p>')
    .replace(/<\/p>/gi, '</p>\n')
    // Preservar listas
    .replace(/<ul[^>]*>/gi, '<ul>')
    .replace(/<ol[^>]*>/gi, '<ol>')
    .replace(/<li[^>]*>/gi, '<li>')
    // Preservar strong/em
    .replace(/<strong[^>]*>/gi, '<strong>')
    .replace(/<em[^>]*>/gi, '<em>')
    .replace(/<b[^>]*>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i[^>]*>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>')
    // Converter br para parágrafo
    .replace(/<br\s*\/?>/gi, '\n')
    // Remover todas as outras tags exceto as preservadas
    .replace(/<(?!\/?(?:h[1-6]|p|ul|ol|li|strong|em))[^>]+>/gi, ' ')
    // Limpar espaços
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  // Contar palavras (texto puro)
  const textOnly = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = textOnly.split(/\s+/).filter(w => w.length > 0).length;
  
  return { title, content, wordCount };
}

// =====================================================
// CONVERTER CONTEÚDO PARA ESTRUTURA DO BUILDER
// =====================================================
function createBuilderContent(title: string, htmlContent: string): Record<string, unknown> {
  // Criar bloco RichText único com todo o conteúdo
  const richTextBlock = {
    id: `richtext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'RichText',
    props: {
      content: htmlContent,
      alignment: 'left',
      maxWidth: 'md',
    },
  };
  
  // Criar bloco de título se diferente do H1 no conteúdo
  const blocks: unknown[] = [];
  
  if (title && !htmlContent.toLowerCase().includes(`<h1>${title.toLowerCase()}</h1>`)) {
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

  try {
    const { tenantId, storeUrl }: ImportRequest = await req.json();

    if (!tenantId || !storeUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tenantId e storeUrl são obrigatórios',
          pages: [],
          skipped: [],
          stats: { detected: 0, imported: 0, skipped: 0, processingTimeMs: 0 },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-inst] Iniciando importação: ${storeUrl} para tenant ${tenantId}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar HTML da página inicial
    const homeHtml = await fetchHtml(storeUrl);
    console.log(`[import-inst] HTML home: ${homeHtml.length} chars`);

    // 2. Detectar páginas do footer
    const detectedPages = extractFooterLinks(homeHtml, storeUrl);
    console.log(`[import-inst] Páginas detectadas: ${detectedPages.length}`);

    // 3. Buscar slugs existentes para evitar duplicatas
    const { data: existingPages } = await supabase
      .from('store_pages')
      .select('slug')
      .eq('tenant_id', tenantId);
    
    const existingSlugs = new Set((existingPages || []).map(p => p.slug));

    // 4. Processar cada página (limite de 10 para evitar timeout)
    const maxPages = 10;
    let processed = 0;

    for (const page of detectedPages) {
      if (processed >= maxPages) {
        console.log('[import-inst] Limite de páginas atingido');
        break;
      }

      // Verificar timeout (40s)
      if (Date.now() - startTime > 40000) {
        console.warn('[import-inst] Timeout, parando importação');
        break;
      }

      // Verificar duplicata
      if (existingSlugs.has(page.slug)) {
        skippedPages.push({ url: page.url, reason: 'Slug já existe (duplicata)' });
        console.log(`[import-inst] SKIP duplicata: ${page.slug}`);
        continue;
      }

      try {
        console.log(`[import-inst] Processando: ${page.url}`);
        processed++;

        // Buscar HTML da página
        const pageHtml = await fetchHtml(page.url);

        // Verificar elegibilidade
        const eligibility = isPageEligible(pageHtml);
        if (!eligibility.eligible) {
          skippedPages.push({ url: page.url, reason: eligibility.reason! });
          console.log(`[import-inst] SKIP: ${page.slug} - ${eligibility.reason}`);
          continue;
        }

        // Extrair conteúdo
        const textContent = extractTextContent(pageHtml);
        
        if (textContent.wordCount < 30) {
          skippedPages.push({ url: page.url, reason: 'Conteúdo muito curto' });
          console.log(`[import-inst] SKIP: ${page.slug} - conteúdo curto (${textContent.wordCount} palavras)`);
          continue;
        }

        // Criar estrutura do builder
        const builderContent = createBuilderContent(
          textContent.title || page.title,
          textContent.content
        );

        // Salvar no banco
        const { data: newPage, error: insertError } = await supabase
          .from('store_pages')
          .insert({
            tenant_id: tenantId,
            title: textContent.title || page.title,
            slug: page.slug,
            type: 'institutional',
            status: 'draft',
            content: builderContent,
            builder_enabled: true,
            seo_title: textContent.title || page.title,
            seo_description: textContent.content.replace(/<[^>]+>/g, ' ').slice(0, 155).trim(),
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[import-inst] Erro ao salvar ${page.slug}:`, insertError);
          skippedPages.push({ url: page.url, reason: `Erro ao salvar: ${insertError.message}` });
          continue;
        }

        // Registrar no import_items para limpeza futura (campos corretos)
        const trackingJobId = crypto.randomUUID();
        await supabase
          .from('import_items')
          .insert({
            job_id: trackingJobId,
            tenant_id: tenantId,
            module: 'pages',
            external_id: page.url,
            internal_id: newPage.id,
            status: 'success',
            data_raw: { url: page.url, title: page.title, slug: page.slug },
            data_normalized: { wordCount: textContent.wordCount },
          });

        importedPages.push({
          id: newPage.id,
          title: textContent.title || page.title,
          slug: page.slug,
          wordCount: textContent.wordCount,
        });

        existingSlugs.add(page.slug); // Evitar duplicata no mesmo batch
        console.log(`[import-inst] ✓ Importada: ${page.slug} (${textContent.wordCount} palavras)`);

      } catch (e) {
        console.error(`[import-inst] Erro em ${page.url}:`, e);
        skippedPages.push({ 
          url: page.url, 
          reason: `Erro: ${e instanceof Error ? e.message : 'desconhecido'}` 
        });
      }
    }

    // Resultado final
    const result: ImportResult = {
      success: true,
      pages: importedPages,
      skipped: skippedPages,
      stats: {
        detected: detectedPages.length,
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
          detected: 0,
          imported: importedPages.length,
          skipped: skippedPages.length,
          processingTimeMs: Date.now() - startTime,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
