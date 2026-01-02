// =====================================================
// TRAY PLATFORM ADAPTER
// =====================================================
// Extraction adapter for Tray Commerce stores
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

export const trayAdapter: PlatformExtractionAdapter = {
  platform: 'tray',
  
  detect(html: string, url: string): boolean {
    const combined = (html + url).toLowerCase();
    return /tray\.com\.br|traycorp|tray-commerce|class="[^"]*tray[^"]*"/i.test(combined);
  },
  
  getMainContentSelector(): string {
    return '#wrapper, .wrapper, main, .conteudo, #conteudo';
  },
  
  getSectionSelectors(): string[] {
    return [
      '.section-home',
      '.banner-home',
      '.vitrine',
      '.depoimentos',
      '.categorias-home',
      '[class*="section-"]',
      '.bloco-home',
      '.banner-principal',
      '.carousel-banner',
    ];
  },
  
  getNoisePatterns(): RegExp[] {
    return [
      /header-topo/i,
      /footer-/i,
      /menu-/i,
      /carrinho/i,
      /cookie/i,
      /whatsapp/i,
      /popup/i,
    ];
  },
  
  getRemoveSelectors(): string[] {
    return [
      '.header-topo',
      '.footer',
      '.menu-lateral',
      '.carrinho-flutuante',
      '.modal',
      '.popup',
      '[class*="cookie"]',
      '.whatsapp-btn',
    ];
  },
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 2000, // Server-rendered com jQuery
      includeTags: ['main', 'section', 'div'],
      excludeTags: ['nav', 'header', 'footer', 'script', 'style'],
    };
  },
  
  getSectionTypeMap(): Record<string, string> {
    return {
      'banner-home': 'ImageCarousel',
      'banner-principal': 'Hero',
      'vitrine': 'ProductGrid',
      'depoimentos': 'Testimonials',
      'categorias-home': 'CategoryGrid',
      'video-home': 'YouTubeVideo',
      'marcas': 'ImageGallery',
      'newsletter': 'CTA',
      'carousel-banner': 'ImageCarousel',
      'bloco-home': 'ContentColumns',
    };
  },
  
  getAIContext(): string {
    return `Esta página é de uma loja Tray Commerce. Padrões comuns:
- Layout mais tradicional (server-rendered com jQuery)
- Seções usam classes .section-*, .banner-*, .vitrine
- Banner principal geralmente em .banner-home, .banner-principal com Owl Carousel ou similar
- Depoimentos em .depoimentos, .avaliacoes, .testemunhos
- Produtos em .vitrine, .produtos-home, .grid-produtos
- Categorias em .categorias-home, .menu-categorias
- Marcas em .marcas, .logos-marcas
- Tray usa muito IDs numéricos para seções
- Campos geralmente em português (nome, descricao, preco)`;
  },
};

export default trayAdapter;
