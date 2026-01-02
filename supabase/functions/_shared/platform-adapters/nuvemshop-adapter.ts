// =====================================================
// NUVEMSHOP/TIENDANUBE PLATFORM ADAPTER
// =====================================================
// Extraction adapter for Nuvemshop/Tiendanube stores (SPA heavy)
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

export const nuvemshopAdapter: PlatformExtractionAdapter = {
  platform: 'nuvemshop',
  
  detect(html: string, url: string): boolean {
    const combined = (html + url).toLowerCase();
    return /nuvemshop|tiendanube|lojavirtualnuvem|d26lpennugtm8s\.cloudfront\.net|nuvem\.app/i.test(combined);
  },
  
  getMainContentSelector(): string {
    return '.js-main-container, main, .page-content, #content, .home-content';
  },
  
  getSectionSelectors(): string[] {
    return [
      '[data-nuvemshop]',
      '.js-section',
      '.section-container',
      '[class*="home-"]',
      '.js-product-grid',
      '.section-slider',
      '.section-featured',
      '.section-testimonials',
      '[class*="section-"]',
    ];
  },
  
  getNoisePatterns(): RegExp[] {
    return [
      /js-header/i,
      /js-footer/i,
      /js-cart/i,
      /js-drawer/i,
      /cookie/i,
      /whatsapp/i,
      /js-modal/i,
      /js-popup/i,
    ];
  },
  
  getRemoveSelectors(): string[] {
    return [
      '.js-header',
      '.js-footer',
      '.js-drawer',
      '.js-modal',
      '.whatsapp-btn',
      '.whatsapp-float',
      '[class*="cookie"]',
      '.popup',
      '.cart-notification',
    ];
  },
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 5000, // SPA pesado em JS - precisa de mais tempo
      includeTags: ['main', 'section', 'article', 'div'],
      excludeTags: ['nav', 'header', 'footer', 'script', 'style'],
    };
  },
  
  getSectionTypeMap(): Record<string, string> {
    return {
      'home-slider': 'ImageCarousel',
      'home-featured': 'ProductGrid',
      'home-categories': 'CategoryGrid',
      'home-new': 'ProductGrid',
      'home-brands': 'ImageGallery',
      'home-video': 'YouTubeVideo',
      'home-testimonials': 'Testimonials',
      'home-instagram': 'ImageGallery',
      'section-slider': 'ImageCarousel',
      'section-featured': 'ProductGrid',
      'section-banner': 'Hero',
    };
  },
  
  getAIContext(): string {
    return `Esta página é de uma loja Nuvemshop/Tiendanube. Padrões comuns:
- Layout é SPA (JavaScript renderizado) - conteúdo pode estar em data-* attributes
- Seções usam classes .js-* (js-section, js-product-grid, js-slider)
- Estrutura de dados frequentemente em JSON-LD (script type="application/ld+json")
- Slider de banners geralmente com classe home-slider, section-slider
- Testimonials podem estar em widgets externos ou seções customizadas
- Produtos usam .js-product-card, .product-item, data-product-id
- IMPORTANTE: Nuvemshop renderiza muito conteúdo via JavaScript
- Extrair data-* attributes para informações adicionais
- Buscar informações em meta tags e structured data quando HTML parecer vazio`;
  },
};

export default nuvemshopAdapter;
