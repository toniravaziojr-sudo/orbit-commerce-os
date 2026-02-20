// =====================================================
// IMPORT INSTITUTIONAL PAGES - Sistema com IA v3
// =====================================================
// ARQUITETURA NOVA:
// 1. Descobrir links via Firecrawl
// 2. Extrair HTML limpo das páginas candidatas
// 3. Usar LOVABLE AI para analisar e extrair estrutura inteligentemente
// 4. Converter para blocos do builder (FAQ, RichText, etc.)
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

// =====================================================
// TYPES
// =====================================================

interface ExtractedBlock {
  type: 'heading' | 'paragraph' | 'image' | 'video' | 'faq' | 'list' | 'button';
  content: string;
  metadata?: {
    level?: number;
    alt?: string;
    videoId?: string;
    items?: Array<{ question: string; answer: string }>;
    listItems?: string[];
    // Button metadata
    url?: string;
    variant?: 'primary' | 'secondary' | 'outline';
  };
}

interface AIExtractionResult {
  title: string;
  pageType: 'faq' | 'policy' | 'about' | 'general';
  blocks: ExtractedBlock[];
}

interface PageCandidate {
  url: string;
  slug: string;
  title: string;
  blocks: ExtractedBlock[];
}

// =====================================================
// PADRÕES DE URL
// =====================================================
const INSTITUTIONAL_URL_PATTERNS = [
  /\/(?:pages?|pagina|paginas|policies|policy|institucional)\//i,
  /\/(?:sobre|about|quem-somos|nossa-historia|about-us)/i,
  /\/(?:politica|privacy|privacidade|lgpd)/i,
  /\/(?:termos|terms|condicoes|regulamento|terms-of-service)/i,
  /\/(?:troca|devolucao|exchange|return|refund|trocas-e-devolucoes)/i,
  /\/(?:entrega|shipping|frete|envio|delivery|prazos)/i,
  /\/(?:garantia|warranty)/i,
  /\/(?:faq|perguntas|duvidas|ajuda-frequente|perguntas-frequentes)/i,
  /\/(?:como-comprar|how-to-buy|passo-a-passo)/i,
  /\/(?:seguranca|security)/i,
  /\/(?:pagamento|payment|formas-de-pagamento)/i,
  /\/(?:como-funciona|how-it-works|funciona)/i,
  /\/(?:feedback|depoimentos|testimonials)/i,
  /\/(?:consulte|consulta)/i,
];

const EXCLUDED_URL_PATTERNS = [
  /^\/?$/,
  /\/cart|\/carrinho|\/sacola|\/bag/i,
  /\/checkout|\/finalizar/i,
  /\/login|\/signin|\/sign-in|\/entrar/i,
  /\/register|\/signup|\/sign-up|\/cadastro/i,
  /\/account|\/minha-conta|\/my-account|\/perfil/i,
  /\/wishlist|\/favoritos/i,
  /\/search|\/busca|\/pesquisa/i,
  /\/track|\/rastreio|\/rastrear|\/tracking/i,
  /\/blog|\/artigo|\/article|\/post|\/news/i,
  /\/contato|\/contact|\/fale-conosco/i,
  /\/produto|\/product|\/p\/|\/item\//i,
  /\/categoria|\/category|\/colecao|\/collection|\/c\//i,
  /\/collections?\/[^/]+/i,
  /\/departamento|\/department/i,
  /\/pedido|\/order|\/orders|\/meus-pedidos/i,
  /\/api\//i,
  /\.(?:jpg|jpeg|png|gif|webp|svg|pdf|xml|json|css|js)$/i,
  /\/shop\/|\/loja\//i,
];

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function extractSlug(pathname: string): string {
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length === 0) return '';
  
  const platformPrefixes = ['pages', 'pagina', 'paginas', 'institucional', 'policies', 'policy', 'info'];
  let slugParts = pathParts;
  if (platformPrefixes.includes(pathParts[0].toLowerCase())) {
    slugParts = pathParts.slice(1);
  }
  
  return slugParts.join('-').toLowerCase() || pathParts[pathParts.length - 1].toLowerCase();
}

function formatTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// =====================================================
// DESCOBERTA DE LINKS - Múltiplas fontes
// =====================================================

// 1. Tentar sitemap.xml primeiro (mais rápido e completo)
async function fetchSitemap(origin: string): Promise<string[]> {
  try {
    const sitemapUrls = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/page-sitemap.xml`
    ];
    
    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImportBot/1.0)' }
        });
        
        if (response.ok) {
          const xml = await response.text();
          const urls: string[] = [];
          
          // Extract URLs from sitemap
          const locPattern = /<loc>([^<]+)<\/loc>/gi;
          let match;
          while ((match = locPattern.exec(xml)) !== null) {
            urls.push(match[1]);
          }
          
          if (urls.length > 0) {
            console.log(`[Pages] Sitemap found: ${sitemapUrl} (${urls.length} URLs)`);
            return urls;
          }
        }
      } catch {}
    }
    return [];
  } catch {
    return [];
  }
}

// 2. Extrair links de todas as áreas da página (nav, footer, menus)
function extractLinksFromHtml(html: string, origin: string): string[] {
  const links: string[] = [];
  
  // Áreas prioritárias para links de páginas institucionais
  const areas = [
    // Footers (múltiplos formatos)
    /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
    // Navegação principal
    /<nav[^>]*>([\s\S]*?)<\/nav>/gi,
    // Menus com classe comum
    /<(?:div|ul)[^>]*class="[^"]*(?:menu|navigation|nav-links|site-nav|footer-links|institutional)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|ul)>/gi,
    // Shopify sections de menu
    /<div[^>]*id="[^"]*(?:footer|menu|links)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];
  
  for (const pattern of areas) {
    let areaMatch;
    while ((areaMatch = pattern.exec(html)) !== null) {
      const areaHtml = areaMatch[1] || areaMatch[0];
      const linkPattern = /href=["']([^"']+)["']/gi;
      let linkMatch;
      while ((linkMatch = linkPattern.exec(areaHtml)) !== null) {
        let href = linkMatch[1];
        
        // Normalizar URL
        if (href.startsWith('/') && !href.startsWith('//')) {
          href = origin + href;
        } else if (href.startsWith('//')) {
          href = 'https:' + href;
        }
        
        if (href.startsWith(origin) && !links.includes(href)) {
          links.push(href);
        }
      }
    }
  }
  
  // Também pegar todos os links <a> da página que parecem institucionais
  const allLinksPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = allLinksPattern.exec(html)) !== null) {
    let href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
    
    // Normalizar URL
    if (href.startsWith('/') && !href.startsWith('//')) {
      href = origin + href;
    } else if (href.startsWith('//')) {
      href = 'https:' + href;
    }
    
    // Detectar links institucionais pelo texto do link
    const institutionalTexts = [
      'sobre', 'about', 'quem somos', 'nossa história',
      'política', 'privacidade', 'privacy', 'lgpd',
      'termos', 'terms', 'condições',
      'troca', 'devolução', 'exchange', 'return', 'reembolso',
      'entrega', 'frete', 'shipping', 'envio', 'prazo',
      'garantia', 'warranty',
      'faq', 'perguntas', 'dúvidas', 'ajuda',
      'como comprar', 'como funciona',
      'pagamento', 'formas de pagamento',
      'feedback', 'depoimentos', 'avaliações',
      'consulte', 'consulta',
    ];
    
    if (href.startsWith(origin) && institutionalTexts.some(t => text.includes(t)) && !links.includes(href)) {
      links.push(href);
    }
  }
  
  return links;
}

// 3. Descoberta via Firecrawl (completo)
async function discoverLinks(storeUrl: string): Promise<string[]> {
  const allLinks: string[] = [];
  const origin = new URL(storeUrl).origin;
  
  // Primeiro: tentar sitemap (mais rápido e completo)
  const sitemapLinks = await fetchSitemap(origin);
  if (sitemapLinks.length > 0) {
    allLinks.push(...sitemapLinks);
    console.log(`[Pages] Sitemap: ${sitemapLinks.length} links`);
  }
  
  // Sempre: buscar via Firecrawl para pegar navegação dinâmica
  if (!FIRECRAWL_API_KEY) return allLinks;

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: storeUrl,
        formats: ['html', 'links'],
        onlyMainContent: false,
        waitFor: 4000, // Mais tempo para JS carregar menus
      }),
    });

    if (!response.ok) return allLinks;
    const data = await response.json();
    
    const html = data.data?.html || data?.html || '';
    const firecrawlLinks = data.data?.links || data?.links || [];
    
    // Adicionar links retornados diretamente pelo Firecrawl
    for (const link of firecrawlLinks) {
      if (link.startsWith(origin) && !allLinks.includes(link)) {
        allLinks.push(link);
      }
    }
    
    // Extrair links adicionais do HTML (footers, menus, nav)
    const htmlLinks = extractLinksFromHtml(html, origin);
    for (const link of htmlLinks) {
      if (!allLinks.includes(link)) {
        allLinks.push(link);
      }
    }
    
    console.log(`[Pages] Firecrawl: ${firecrawlLinks.length} diretos + ${htmlLinks.length} do HTML`);
    
    return allLinks;
  } catch (error) {
    console.error('[Pages] Firecrawl error:', error);
    return allLinks;
  }
}

// =====================================================
// FIRECRAWL: EXTRAIR HTML DA PÁGINA
// =====================================================

async function fetchPageHtml(pageUrl: string): Promise<{ html: string; markdown: string } | null> {
  if (!FIRECRAWL_API_KEY) return null;

  try {
    console.log(`[Pages] Fetching HTML: ${pageUrl}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pageUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: true, // Focus on main content
        waitFor: 3000,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    const html = data.data?.html || data?.html || '';
    const markdown = data.data?.markdown || data?.markdown || '';
    
    if (!html && !markdown) return null;
    
    return { html, markdown };
  } catch (error) {
    console.error(`[Pages] Error fetching ${pageUrl}:`, error);
    return null;
  }
}

// =====================================================
// LOVABLE AI: EXTRAÇÃO INTELIGENTE DE CONTEÚDO
// =====================================================

async function extractContentWithAI(
  pageUrl: string, 
  html: string, 
  markdown: string
): Promise<AIExtractionResult | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Clean HTML for AI analysis - remove script/style/nav/header/footer
    let cleanHtml = html;
    cleanHtml = cleanHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHtml = cleanHtml.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
    cleanHtml = cleanHtml.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    cleanHtml = cleanHtml.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    cleanHtml = cleanHtml.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    
    // Truncate to avoid token limits (keep first 15000 chars)
    const truncatedHtml = cleanHtml.length > 15000 ? cleanHtml.substring(0, 15000) + '...' : cleanHtml;
    const truncatedMarkdown = markdown.length > 8000 ? markdown.substring(0, 8000) + '...' : markdown;

    const systemPrompt = `Você é um especialista em extração de conteúdo de páginas web para um construtor de sites de e-commerce.

Sua tarefa é analisar o HTML/Markdown de uma página institucional e extrair seu conteúdo de forma estruturada e CONSOLIDADA.

REGRAS CRÍTICAS:
1. Identifique o TÍTULO REAL da página (não URLs, não "YouTube", não lixo de iframes)
2. Detecte se a página é um FAQ (perguntas e respostas em acordeões/listas)
3. Para FAQs: extraia TODAS as perguntas e respostas mantendo a estrutura de categorias se houver
4. Para outras páginas: extraia headings, parágrafos, imagens, vídeos e BOTÕES na ordem correta
5. IGNORE: menus de navegação, headers, footers, widgets de chat, pop-ups, tracking, tabela de parcelas, calculadora de frete
6. AGRUPE parágrafos consecutivos em UM ÚNICO bloco paragraph (máximo 5 blocos de texto por seção)
7. EXTRAIA botões/CTAs importantes (Comprar, Consultar, Saiba Mais, etc.)
8. Retorne APENAS JSON válido, sem markdown ou explicações`;

    const userPrompt = `Analise esta página e extraia seu conteúdo estruturado.

URL: ${pageUrl}

HTML (limpo):
${truncatedHtml}

MARKDOWN:
${truncatedMarkdown}

Retorne um JSON com este formato EXATO:
{
  "title": "Título real da página",
  "pageType": "faq" | "policy" | "about" | "general",
  "blocks": [
    // Para FAQ:
    { "type": "heading", "content": "CATEGORIA (ex: COMPRA & ENTREGA)", "metadata": { "level": 2 } },
    { "type": "faq", "content": "", "metadata": { "items": [
      { "question": "Pergunta 1?", "answer": "Resposta completa 1" },
      { "question": "Pergunta 2?", "answer": "Resposta completa 2" }
    ]}},
    
    // Para outras páginas (parágrafos AGRUPADOS):
    { "type": "heading", "content": "Título da seção", "metadata": { "level": 2 } },
    { "type": "paragraph", "content": "Primeiro parágrafo completo. Segundo parágrafo relacionado. Terceiro parágrafo da mesma seção." },
    { "type": "button", "content": "Consultar agora", "metadata": { "url": "/consulta", "variant": "primary" } },
    { "type": "image", "content": "https://url-da-imagem.jpg", "metadata": { "alt": "descrição" } },
    { "type": "video", "content": "https://youtube.com/watch?v=ID", "metadata": { "videoId": "ID" } },
    { "type": "list", "content": "", "metadata": { "listItems": ["item 1", "item 2"] } }
  ]
}

REGRAS DE AGRUPAMENTO:
- AGRUPE todos os parágrafos consecutivos de uma mesma seção em UM ÚNICO bloco paragraph
- Cada bloco paragraph deve conter MÚLTIPLOS parágrafos separados por ponto final
- NÃO crie um bloco paragraph para cada linha/frase
- Máximo 5-8 blocos de conteúdo total (exceto FAQs)
- IGNORE listas de parcelas (1x, 2x, 3x...), calculadoras de frete, tabelas de preço

BOTÕES - Extraia CTAs importantes:
- Botões de ação (Comprar, Consultar, Saiba Mais, Ver Mais, Entrar em Contato)
- variant: "primary" para ação principal, "secondary" para secundária, "outline" para links

IMPORTANTE: 
- Para FAQs com categorias, crie um heading para cada categoria seguido de um bloco faq com os items
- Extraia as perguntas/respostas COMPLETAS, não resumidas
- Se não conseguir extrair, retorne { "title": "", "pageType": "general", "blocks": [] }`;

    console.log(`[Pages] Calling AI for: ${pageUrl}`);

    resetAIRouterCache();
    const response = await aiChatCompletion('google/gemini-2.5-flash', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: '[Pages]',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Pages] AI API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('[Pages] AI returned empty content');
      return null;
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const result = JSON.parse(jsonStr) as AIExtractionResult;
      console.log(`[Pages] AI extracted: "${result.title}" (${result.pageType}, ${result.blocks.length} blocks)`);
      return result;
    } catch (parseError) {
      console.error('[Pages] Failed to parse AI response:', parseError);
      console.log('[Pages] Raw AI response:', content.substring(0, 500));
      return null;
    }

  } catch (error) {
    console.error('[Pages] AI extraction error:', error);
    return null;
  }
}

// =====================================================
// FALLBACK: EXTRAÇÃO MANUAL (sem IA)
// =====================================================

function extractContentManually(html: string, pageUrl: string): AIExtractionResult {
  const blocks: ExtractedBlock[] = [];
  
  // Clean HTML
  let cleanHtml = html;
  cleanHtml = cleanHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleanHtml = cleanHtml.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  cleanHtml = cleanHtml.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  cleanHtml = cleanHtml.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  cleanHtml = cleanHtml.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  
  // Find main content
  const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                   cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const contentArea = mainMatch ? mainMatch[1] : cleanHtml;
  
  // Extract title
  const h1Match = contentArea.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
  
  // Fallback to og:title
  if (!title || title.length < 3) {
    const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogMatch) title = ogMatch[1].trim();
  }
  
  // Fallback to formatted slug
  if (!title || title.length < 3) {
    const slug = extractSlug(new URL(pageUrl).pathname);
    title = formatTitle(slug);
  }
  
  // Extract headings
  const headingPattern = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = headingPattern.exec(contentArea)) !== null) {
    const level = parseInt(match[1].charAt(1));
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 2 && text.length < 200) {
      blocks.push({ type: 'heading', content: text, metadata: { level } });
    }
  }
  
  // Extract paragraphs
  const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = pPattern.exec(contentArea)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 20) {
      blocks.push({ type: 'paragraph', content: text });
    }
  }
  
  return { title, pageType: 'general', blocks };
}

// =====================================================
// CHECK IF PAGE IS PRODUCT GRID
// =====================================================

function isProductPage(html: string): boolean {
  const productPrices = html.match(/class="[^"]*price[^"]*"[^>]*>[^<]*R\$[^<]*/gi) || [];
  const productCards = html.match(/class="[^"]*(?:product-card|product-item|card-product)[^"]*"/gi) || [];
  const addToCart = html.match(/(?:add.?to.?cart|adicionar.?ao.?carrinho|comprar)/gi) || [];
  
  return productPrices.length >= 5 || productCards.length >= 3 || addToCart.length >= 4;
}

// =====================================================
// BUILD PAGE CONTENT FOR BUILDER
// =====================================================

function buildPageContent(extraction: AIExtractionResult): any {
  const children: any[] = [];
  
  for (const block of extraction.blocks) {
    switch (block.type) {
      case 'heading':
        children.push({
          id: crypto.randomUUID(),
          type: 'RichText',
          props: {
            content: `<h${block.metadata?.level || 2}>${escapeHtml(block.content)}</h${block.metadata?.level || 2}>`,
            align: 'left'
          }
        });
        break;
      
      case 'paragraph':
        children.push({
          id: crypto.randomUUID(),
          type: 'RichText',
          props: {
            content: `<p>${escapeHtml(block.content)}</p>`,
            align: 'left'
          }
        });
        break;
      
      case 'list':
        if (block.metadata?.listItems && block.metadata.listItems.length > 0) {
          const listHtml = block.metadata.listItems.map(item => `<li>${escapeHtml(item)}</li>`).join('');
          children.push({
            id: crypto.randomUUID(),
            type: 'RichText',
            props: {
              content: `<ul>${listHtml}</ul>`,
              align: 'left'
            }
          });
        }
        break;
      
      case 'faq':
        // Use FAQ block (type is 'FAQ' in BlockRenderer, not 'FAQBlock')
        if (block.metadata?.items && block.metadata.items.length > 0) {
          children.push({
            id: crypto.randomUUID(),
            type: 'FAQ', // CORRETO: BlockRenderer usa 'FAQ', não 'FAQBlock'
            props: {
              title: '',
              items: block.metadata.items.map(item => ({
                question: item.question,
                answer: item.answer
              }))
            }
          });
        }
        break;
      
      case 'image':
        if (block.content && !block.content.includes('data:image')) {
          children.push({
            id: crypto.randomUUID(),
            type: 'ImageBlock',
            props: {
              imageDesktop: block.content,
              alt: block.metadata?.alt || '',
              aspectRatio: 'auto'
            }
          });
        }
        break;
      
      case 'video':
        if (block.metadata?.videoId) {
          children.push({
            id: crypto.randomUUID(),
            type: 'YouTubeVideo',
            props: {
              youtubeUrl: `https://www.youtube.com/watch?v=${block.metadata.videoId}`,
              title: '',
              widthPreset: 'lg',
              aspectRatio: '16:9'
            }
          });
        }
        break;
      
      case 'button':
        // Use ButtonBlock for extracted CTAs
        if (block.content) {
          children.push({
            id: crypto.randomUUID(),
            type: 'Button',
            props: {
              text: block.content,
              url: block.metadata?.url || '#',
              variant: block.metadata?.variant || 'primary',
              size: 'md',
              align: 'left'
            }
          });
        }
        break;
    }
  }
  
  // If no blocks, add placeholder
  if (children.length === 0) {
    children.push({
      id: crypto.randomUUID(),
      type: 'RichText',
      props: {
        content: '<p>Conteúdo da página</p>',
        align: 'left'
      }
    });
  }
  
  // Wrap in standard page structure
  // IMPORTANTE: Blocos diretamente na Section para serem editáveis no sidebar
  // NÃO usar Container intermediário que não aparece no sidebar
  return {
    id: 'root',
    type: 'Page',
    props: {},
    children: [
      {
        id: crypto.randomUUID(),
        type: 'Header',
        props: {}
      },
      {
        id: crypto.randomUUID(),
        type: 'Section',
        props: {
          paddingY: 48,
          paddingX: 16,
          maxWidth: 'md'
        },
        children: children // Blocos diretamente como filhos da Section
      },
      {
        id: crypto.randomUUID(),
        type: 'Footer',
        props: {}
      }
    ]
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
      return jsonResponse({
        success: false,
        error: 'tenantId e storeUrl são obrigatórios',
        pages: [],
        skipped: [],
      });
    }

    if (!FIRECRAWL_API_KEY) {
      return jsonResponse({
        success: false,
        error: 'FIRECRAWL_API_KEY não configurada',
        pages: [],
        skipped: [],
      });
    }

    console.log(`[Pages] Starting AI-powered import: ${storeUrl} for tenant ${tenantId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Normalize URL
    let normalizedUrl = storeUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const origin = new URL(normalizedUrl).origin;

    // 1. DISCOVER ALL LINKS
    const allLinks = await discoverLinks(normalizedUrl);
    console.log(`[Pages] Links discovered: ${allLinks.length}`);

    if (allLinks.length === 0) {
      return jsonResponse({
        success: false,
        error: 'Não foi possível descobrir links do site',
        pages: [],
        skipped: [],
      });
    }

    // 2. FILTER CANDIDATES
    const seen = new Set<string>();
    const candidateUrls: Array<{ url: string; slug: string }> = [];

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

      // Exclude functional pages
      if (EXCLUDED_URL_PATTERNS.some(p => p.test(pathname))) continue;

      // Check if matches institutional patterns
      if (!INSTITUTIONAL_URL_PATTERNS.some(p => p.test(pathname))) continue;

      const slug = extractSlug(pathname);
      if (!slug || slug.length < 2) continue;

      candidateUrls.push({ url: cleanUrl, slug });
    }

    console.log(`[Pages] Candidates to analyze: ${candidateUrls.length}`);

    // 3. GET EXISTING SLUGS
    const { data: existingPages } = await supabase
      .from('store_pages')
      .select('slug')
      .eq('tenant_id', tenantId);

    const existingSlugs = new Set((existingPages || []).map(p => p.slug));

    // 4. ANALYZE EACH CANDIDATE WITH AI
    const importedPages: Array<{ id: string; title: string; slug: string; blocksCount: number; pageType: string }> = [];
    const skippedPages: Array<{ url: string; reason: string }> = [];

    // Limit to 15 pages to avoid timeout
    const limitedCandidates = candidateUrls.slice(0, 15);

    for (const candidate of limitedCandidates) {
      if (existingSlugs.has(candidate.slug)) {
        skippedPages.push({ url: candidate.url, reason: 'Slug já existe' });
        continue;
      }

      // Fetch page HTML
      const pageData = await fetchPageHtml(candidate.url);
      
      if (!pageData) {
        skippedPages.push({ url: candidate.url, reason: 'Não foi possível carregar a página' });
        continue;
      }

      // Check if it's a product page
      if (isProductPage(pageData.html)) {
        skippedPages.push({ url: candidate.url, reason: 'Página de produtos detectada' });
        continue;
      }

      // Extract content with AI (or fallback to manual)
      let extraction: AIExtractionResult | null = null;
      
      {
        extraction = await extractContentWithAI(candidate.url, pageData.html, pageData.markdown);
      }
      
      if (!extraction) {
        console.log(`[Pages] Falling back to manual extraction for: ${candidate.url}`);
        extraction = extractContentManually(pageData.html, candidate.url);
      }

      // Skip if no meaningful content
      if (extraction.blocks.length === 0 && (!extraction.title || extraction.title.length < 3)) {
        skippedPages.push({ url: candidate.url, reason: 'Sem conteúdo extraível' });
        continue;
      }

      // Use extracted title or format from slug
      const title = extraction.title && extraction.title.length > 2 
        ? extraction.title 
        : formatTitle(candidate.slug);

      // Build page content for builder
      const pageContent = buildPageContent(extraction);

      // Create page
      const { data, error } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: tenantId,
          slug: candidate.slug,
          title: title,
          content: pageContent,
          status: 'draft',
          is_published: false,
          builder_enabled: true,
          show_in_menu: true,
          menu_label: title,
        })
        .select('id, title, slug')
        .single();

      if (error) {
        console.error(`[Pages] Error creating ${candidate.slug}:`, error.message);
        skippedPages.push({ url: candidate.url, reason: error.message });
        continue;
      }

      if (data) {
        importedPages.push({
          ...data,
          blocksCount: extraction.blocks.length,
          pageType: extraction.pageType
        });
        existingSlugs.add(candidate.slug);
        
        // Register in import_items
        await supabase.from('import_items').upsert({
          tenant_id: tenantId,
          job_id: 'institutional-pages',
          module: 'pages',
          internal_id: data.id,
          external_id: candidate.url,
          status: 'success',
        }, {
          onConflict: 'tenant_id,module,external_id',
          ignoreDuplicates: false
        });
        
        console.log(`[Pages] ✓ Created: ${candidate.slug} - "${title}" (${extraction.pageType}, ${extraction.blocks.length} blocks)`);
      }

      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[Pages] Import complete: ${importedPages.length} imported, ${skippedPages.length} skipped`);

    return jsonResponse({
      success: true,
      pages: importedPages,
      skipped: skippedPages,
      stats: {
        linksDiscovered: allLinks.length,
        candidates: candidateUrls.length,
        imported: importedPages.length,
        skipped: skippedPages.length,
        aiEnabled: !!LOVABLE_API_KEY,
      },
    });

  } catch (error) {
    console.error('[Pages] Error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
      pages: [],
      skipped: [],
    });
  }
});
