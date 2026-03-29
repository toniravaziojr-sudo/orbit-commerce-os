// =============================================
// AI BLOCK CATALOG - Compact block reference for AI page generation
// =============================================

import { blockRegistry } from './registry';

/**
 * Block types that should NOT be offered to the AI for page generation.
 * These are system/infrastructure blocks that are either:
 * - Injected automatically (Page, Header, Footer, Section)
 * - Specific to system pages (Cart, Checkout, ThankYou, etc.)
 * - Internal containers (Container, Columns)
 */
const EXCLUDED_BLOCK_TYPES = new Set([
  // Infrastructure (auto-injected)
  'Page', 'Header', 'Footer', 'Section', 'Container', 'Columns',
  // System page blocks
  'Cart', 'Checkout', 'ThankYou', 'AccountHub', 'OrdersList', 'OrderDetail',
  'TrackingLookup', 'BlogListing',
  // System ecommerce (context-dependent)
  'CategoryPageLayout', 'ProductDetails', 'CategoryBanner',
  'CheckoutSteps', 'CartSummary', 'ProductCard',
  // Template/content blocks
  'PageContent', 'CustomBlock',
  // Offer slots (system-managed)
  'CompreJuntoSlot', 'CrossSellSlot',
]);

/**
 * Generate a compact, human-readable catalog of available blocks for AI consumption.
 * Used as part of the system prompt for the ai-page-architect edge function.
 */
export function generateAIBlockCatalog(): string {
  const allBlocks = blockRegistry.getAll();
  const availableBlocks = allBlocks.filter(b => !EXCLUDED_BLOCK_TYPES.has(b.type));

  const lines = availableBlocks.map(block => {
    const propsHint = Object.keys(block.propsSchema).slice(0, 4).join(', ');
    return `- ${block.type} (${block.category}) — ${block.label}. Props: ${propsHint || 'nenhuma configurável'}`;
  });

  return lines.join('\n');
}

/**
 * Get the list of valid block types the AI can use.
 */
export function getAvailableBlockTypes(): string[] {
  const allBlocks = blockRegistry.getAll();
  return allBlocks
    .filter(b => !EXCLUDED_BLOCK_TYPES.has(b.type))
    .map(b => b.type);
}

/**
 * Build the complete system prompt for the AI Page Architect.
 * Includes: catalog, composition rules, and few-shot examples.
 */
export function buildAIPageArchitectPrompt(): string {
  const catalog = generateAIBlockCatalog();
  const validTypes = getAvailableBlockTypes();

  return `Você é um arquiteto de páginas web para e-commerce. Sua função é montar a estrutura de uma página usando APENAS os blocos nativos disponíveis no sistema.

## BLOCOS DISPONÍVEIS
${catalog}

## TIPOS VÁLIDOS (use EXATAMENTE estes nomes)
${validTypes.join(', ')}

## REGRAS DE COMPOSIÇÃO
1. Header e Footer são INJETADOS AUTOMATICAMENTE — NÃO inclua na sua resposta
2. Retorne entre 3 e 12 blocos de conteúdo
3. NÃO repita o mesmo tipo de bloco consecutivamente (ex: dois Banner seguidos)
4. Landing pages devem começar com impacto visual (Banner, Image, ou VideoUpload)
5. Páginas promocionais devem ter pelo menos 1 CTA claro (Button ou banner com link)
6. Use Divider ou Spacer com moderação (máximo 2 por página)
7. Finalize com um bloco de engajamento quando fizer sentido (Newsletter, ContactForm, SocialFeed)
8. Varie os blocos — páginas monotônicas (só texto) são ruins

## EXEMPLOS DE ESTRUTURAS BEM MONTADAS

### Landing de Produto (venda direta)
Banner, InfoHighlights, ContentColumns, Testimonials, FAQ, Button

### Home Institucional (loja de cosméticos)
Banner, FeaturedCategories, ProductCarousel, TextBanners, Reviews, Newsletter

### Página de Contato
Banner, RichText, ContactForm, Map, FAQ

### Página Promocional (Black Friday)
Banner, CountdownTimer, ProductGrid, StatsNumbers, Testimonials, Newsletter

### Página Sobre Nós
Banner, RichText, StepsTimeline, LogosCarousel, SocialFeed

## FORMATO DE RESPOSTA
Use APENAS a tool calling fornecida. Retorne um array de blocos na ordem em que devem aparecer na página, com o tipo exato e uma razão curta para cada escolha.`;
}