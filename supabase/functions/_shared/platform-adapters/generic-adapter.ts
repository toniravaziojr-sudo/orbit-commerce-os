// =====================================================
// GENERIC PLATFORM ADAPTER (FALLBACK)
// =====================================================
// Default adapter for unknown platforms
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

export const genericAdapter: PlatformExtractionAdapter = {
  platform: 'generic',
  
  detect(): boolean {
    return true; // Always matches as fallback
  },
  
  getMainContentSelector(): string {
    return 'main, [role="main"], article, .content, #content, .main-content';
  },
  
  getSectionSelectors(): string[] {
    return [
      'section',
      '[class*="section"]',
      'article',
      '.container > div',
      '[class*="block"]',
      '[class*="module"]',
    ];
  },
  
  getNoisePatterns(): RegExp[] {
    return [
      /header/i,
      /footer/i,
      /nav/i,
      /menu/i,
      /cookie/i,
      /modal/i,
      /popup/i,
      /sidebar/i,
      /advertisement/i,
      /banner-ad/i,
    ];
  },
  
  getRemoveSelectors(): string[] {
    return [
      'header',
      'footer',
      'nav',
      '.menu',
      '[class*="cookie"]',
      '.modal',
      '.popup',
      'aside',
      '.sidebar',
      '[class*="advertisement"]',
      '.social-share',
    ];
  },
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 3000,
      includeTags: ['main', 'section', 'article'],
      excludeTags: ['nav', 'header', 'footer', 'aside', 'script', 'style'],
    };
  },
  
  getSectionTypeMap(): Record<string, string> {
    return {};
  },
  
  getAIContext(): string {
    return `Plataforma desconhecida. Usar heurísticas genéricas:
- Procurar por elementos semânticos HTML5 (section, article, main)
- Identificar padrões visuais comuns (hero, cards, grids)
- Buscar imagens grandes no topo (hero/banner)
- Identificar vídeos YouTube/Vimeo incorporados
- Extrair textos de headings (h1, h2, h3) para títulos
- Identificar CTAs por botões com texto de ação
- Buscar padrões de depoimentos (foto + nome + texto)
- Identificar listas de benefícios (ícones + texto)
- Procurar FAQ com perguntas e respostas
- Buscar grids de produtos ou categorias`;
  },
};

export default genericAdapter;
