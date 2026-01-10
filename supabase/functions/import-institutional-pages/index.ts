// =====================================================
// IMPORT INSTITUTIONAL PAGES - Sistema Simplificado
// =====================================================
// NOVO COMPORTAMENTO: Apenas identificar URLs de páginas
// institucionais e criar placeholders vazios (usuário preenche depois)
// 
// FLUXO:
// 1. Descobrir TODOS os links do site via Firecrawl
// 2. Filtrar candidatos por padrões de URL institucional
// 3. Criar páginas vazias (slug + título derivado)
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

// =====================================================
// PADRÕES DE URL INSTITUCIONAL (candidatos)
// =====================================================
const INSTITUTIONAL_URL_PATTERNS = [
  /\/(?:pages?|pagina|paginas|policies|policy|institucional)\//i,
  /\/(?:sobre|about|quem-somos|nossa-historia)/i,
  /\/(?:politica|privacy|privacidade|lgpd)/i,
  /\/(?:termos|terms|condicoes|regulamento)/i,
  /\/(?:troca|devolucao|exchange|return|refund)/i,
  /\/(?:entrega|shipping|frete|envio|delivery)/i,
  /\/(?:garantia|warranty)/i,
  /\/(?:faq|perguntas|duvidas|ajuda-frequente)/i,
  /\/(?:como-comprar|how-to-buy|passo-a-passo)/i,
  /\/(?:seguranca|security)/i,
  /\/(?:pagamento|payment)/i,
];

// =====================================================
// PADRÕES DE EXCLUSÃO POR URL (páginas funcionais)
// =====================================================
const EXCLUDED_URL_PATTERNS = [
  /^\/?$/,                                    // Home
  /\/cart|\/carrinho|\/sacola|\/bag/i,        // Carrinho
  /\/checkout|\/finalizar/i,                  // Checkout
  /\/login|\/signin|\/sign-in|\/entrar/i,     // Login
  /\/register|\/signup|\/sign-up|\/cadastro/i, // Cadastro
  /\/account|\/minha-conta|\/my-account|\/perfil/i, // Conta
  /\/wishlist|\/favoritos/i,                  // Favoritos
  /\/search|\/busca|\/pesquisa/i,             // Busca
  /\/track|\/rastreio|\/rastrear|\/tracking/i, // Rastreio (temos nativo)
  /\/blog|\/artigo|\/article|\/post|\/news/i, // Blog
  /\/contato|\/contact|\/fale-conosco/i,      // Contato (geralmente form)
  /\/produto|\/product|\/p\/|\/item\//i,      // Produto
  /\/categoria|\/category|\/colecao|\/collection|\/c\//i, // Categoria
  /\/pedido|\/order|\/orders|\/meus-pedidos/i, // Pedidos
  /\/api\//i,                                 // API
  /\.(?:jpg|jpeg|png|gif|webp|svg|pdf|xml|json|css|js)$/i, // Arquivos
];

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Descobrir links do site
async function discoverLinks(storeUrl: string): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return [];

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
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.links || [];
  } catch {
    return [];
  }
}

// Extrair slug do pathname
function extractSlug(pathname: string): string {
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length === 0) return '';

  // Remover prefixos comuns de plataformas
  const platformPrefixes = ['pages', 'pagina', 'paginas', 'institucional', 'policies', 'policy', 'info'];
  let slugParts = pathParts;
  if (platformPrefixes.includes(pathParts[0].toLowerCase())) {
    slugParts = pathParts.slice(1);
  }

  return slugParts.join('-').toLowerCase() || pathParts[pathParts.length - 1].toLowerCase();
}

// Formatar título a partir do slug
function formatTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, storeUrl } = await req.json();

    if (!tenantId || !storeUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'tenantId e storeUrl são obrigatórios',
          pages: [],
          skipped: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'FIRECRAWL_API_KEY não configurada',
          pages: [],
          skipped: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-pages] Iniciando: ${storeUrl} para tenant ${tenantId}`);

    // Inicializar Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Normalizar URL
    let normalizedUrl = storeUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const origin = new URL(normalizedUrl).origin;

    // 1. DESCOBRIR TODOS OS LINKS
    const allLinks = await discoverLinks(normalizedUrl);
    console.log(`[import-pages] Links descobertos: ${allLinks.length}`);

    if (allLinks.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível descobrir links do site',
          pages: [],
          skipped: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. FILTRAR CANDIDATOS
    const seen = new Set<string>();
    const candidates: Array<{ url: string; slug: string; title: string }> = [];

    for (const link of allLinks) {
      if (!link.startsWith(origin)) continue;

      const cleanUrl = link.split('?')[0].split('#')[0].replace(/\/$/, '');
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);

      let pathname: string;
      try {
        pathname = new URL(cleanUrl).pathname.toLowerCase();
      } catch {
        continue;
      }

      // Excluir páginas funcionais
      if (EXCLUDED_URL_PATTERNS.some(p => p.test(pathname))) continue;

      // Verificar se é padrão institucional
      if (!INSTITUTIONAL_URL_PATTERNS.some(p => p.test(pathname))) continue;

      const slug = extractSlug(pathname);
      if (!slug || slug.length < 2) continue;

      candidates.push({
        url: cleanUrl,
        slug,
        title: formatTitle(slug),
      });
    }

    console.log(`[import-pages] Candidatos: ${candidates.length}`);

    // 3. BUSCAR SLUGS EXISTENTES
    const { data: existingPages } = await supabase
      .from('store_pages')
      .select('slug')
      .eq('tenant_id', tenantId);

    const existingSlugs = new Set((existingPages || []).map(p => p.slug));

    // 4. CRIAR PÁGINAS VAZIAS
    const importedPages: Array<{ id: string; title: string; slug: string }> = [];
    const skippedPages: Array<{ url: string; reason: string }> = [];

    for (const candidate of candidates) {
      if (existingSlugs.has(candidate.slug)) {
        skippedPages.push({ url: candidate.url, reason: 'Slug já existe' });
        continue;
      }

      // Criar página vazia (placeholder)
      const { data, error } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: tenantId,
          slug: candidate.slug,
          title: candidate.title,
          content: '', // VAZIO - usuário preenche depois
          status: 'draft',
          is_published: false,
          builder_enabled: false,
          show_in_header: false,
          show_in_footer: true,
        })
        .select('id, title, slug')
        .single();

      if (error) {
        console.error(`[import-pages] Erro ao criar ${candidate.slug}:`, error.message);
        skippedPages.push({ url: candidate.url, reason: error.message });
        continue;
      }

      if (data) {
        importedPages.push(data);
        existingSlugs.add(candidate.slug); // Evitar duplicatas na mesma execução
        console.log(`[import-pages] Criada: ${candidate.slug}`);
      }
    }

    console.log(`[import-pages] Importadas: ${importedPages.length}, Puladas: ${skippedPages.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        pages: importedPages,
        skipped: skippedPages,
        stats: {
          linksDiscovered: allLinks.length,
          candidates: candidates.length,
          imported: importedPages.length,
          skipped: skippedPages.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[import-pages] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno',
        pages: [],
        skipped: [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
