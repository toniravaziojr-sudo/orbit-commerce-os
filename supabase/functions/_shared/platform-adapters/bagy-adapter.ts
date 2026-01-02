// =====================================================
// BAGY PLATFORM ADAPTER
// =====================================================
// Extraction adapter for Bagy stores
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

export const bagyAdapter: PlatformExtractionAdapter = {
  platform: 'bagy',
  
  detect(html: string, url: string): boolean {
    const combined = (html + url).toLowerCase();
    return /bagy\.com\.br|bfrota\.com\.br|bagy-store|\.bagy\./i.test(combined);
  },
  
  getMainContentSelector(): string {
    return 'main, .main-content, #content, .page-wrapper, .home-content';
  },
  
  getSectionSelectors(): string[] {
    return [
      '.bagy-section',
      '[data-bagy]',
      '.home-section',
      '.section-destaque',
      '[class*="section-"]',
      '.banner-principal',
      '.vitrine-produtos',
      '.secao-home',
    ];
  },
  
  getNoisePatterns(): RegExp[] {
    return [
      /bagy-header/i,
      /bagy-footer/i,
      /bagy-cart/i,
      /menu-mobile/i,
      /cookie/i,
      /popup/i,
      /modal/i,
    ];
  },
  
  getRemoveSelectors(): string[] {
    return [
      '.bagy-header',
      '.bagy-footer',
      '.menu-mobile',
      '.cart-sidebar',
      '.modal',
      '.popup',
      '[class*="cookie"]',
      '.whatsapp-btn',
    ];
  },
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 2500,
      includeTags: ['main', 'section', 'article', 'div'],
      excludeTags: ['nav', 'header', 'footer', 'script', 'style'],
    };
  },
  
  getSectionTypeMap(): Record<string, string> {
    return {
      'banner-principal': 'ImageCarousel',
      'vitrine-produtos': 'ProductGrid',
      'categorias': 'CategoryGrid',
      'depoimentos': 'Testimonials',
      'marcas': 'ImageGallery',
      'newsletter': 'CTA',
      'video': 'YouTubeVideo',
      'promocoes': 'ProductGrid',
      'secao-home': 'ContentColumns',
      'section-destaque': 'InfoHighlights',
    };
  },
  
  getAIContext(): string {
    return `Esta página é de uma loja Bagy. Padrões comuns:
- Plataforma brasileira com layout customizável
- Seções geralmente com .bagy-* ou .section-*
- Banner principal em .banner-principal ou slider
- Produtos em .vitrine-produtos, .produtos-grid
- Categorias em cards com imagem + título + link
- Depoimentos podem ter nome + foto + texto + estrelas
- Suporte a campos customizados via data-* attributes
- Layout responsivo com breakpoints mobile/tablet/desktop
- Integração com WhatsApp comum
- Buscar por seções de destaque com produtos promocionais`;
  },
};

export default bagyAdapter;
