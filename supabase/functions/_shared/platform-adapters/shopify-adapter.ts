// =====================================================
// SHOPIFY PLATFORM ADAPTER
// =====================================================
// Extraction adapter for Shopify stores
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

export const shopifyAdapter: PlatformExtractionAdapter = {
  platform: 'shopify',
  
  detect(html: string, url: string): boolean {
    const combined = (html + url).toLowerCase();
    return /shopify|myshopify\.com|cdn\.shopify\.com|shopify-section/i.test(combined);
  },
  
  getMainContentSelector(): string {
    return 'main, [role="main"], .main-content, #MainContent';
  },
  
  getSectionSelectors(): string[] {
    return [
      '[id^="shopify-section-"]',
      '.shopify-section',
      '[data-shopify-editor-section]',
      'section[class*="section"]',
      '.section-content',
    ];
  },
  
  getNoisePatterns(): RegExp[] {
    return [
      /shopify-section-group-header-group/i,
      /shopify-section-group-footer-group/i,
      /shopify-section-header/i,
      /shopify-section-footer/i,
      /predictive-search/i,
      /announcement-bar/i,
      /popup/i,
      /modal/i,
      /drawer/i,
      /newsletter-popup/i,
    ];
  },
  
  getRemoveSelectors(): string[] {
    return [
      '.shopify-section-group-header-group',
      '.shopify-section-group-footer-group',
      '[id*="header"]',
      '[id*="footer"]',
      '.announcement-bar',
      '.drawer',
      '.modal',
      'predictive-search',
      '.popup',
      '.newsletter-popup',
      '[class*="cookie"]',
      '.age-gate',
    ];
  },
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 2500,
      includeTags: ['main', 'section', 'article'],
      excludeTags: ['nav', 'header', 'footer', 'aside', 'script', 'style'],
    };
  },
  
  getSectionTypeMap(): Record<string, string> {
    return {
      'hero': 'Hero',
      'slideshow': 'ImageCarousel',
      'image-banner': 'Hero',
      'featured-collection': 'ProductGrid',
      'collection-list': 'CategoryGrid',
      'testimonials': 'Testimonials',
      'rich-text': 'RichText',
      'image-with-text': 'ContentColumns',
      'video': 'YouTubeVideo',
      'multicolumn': 'InfoHighlights',
      'collage': 'ImageGallery',
      'featured-product': 'ProductCard',
      'custom-liquid': 'RichText',
      'newsletter': 'CTA',
      'contact-form': 'CTA',
    };
  },
  
  getAIContext(): string {
    return `Esta página é de uma loja Shopify. Padrões comuns:
- Seções são marcadas com id="shopify-section-*" ou class="shopify-section"
- Hero geralmente é a primeira seção (slideshow, image-banner, hero)
- Testimonials frequentemente usam apps de reviews (Judge.me, Loox, Yotpo, Stamped)
- Produtos usam .product-card, .product-item, ou .product-grid-item
- Coleções/categorias usam .collection-list, .collection-card
- IGNORE: header-group, footer-group, announcement-bar, modals, drawers
- Para testimonials: extraia NOMES REAIS (Milton, Gustavo, etc.) e TEXTOS REAIS
- Widgets de review geralmente têm .review-content, .testimonial-author, .customer-name`;
  },
};

export default shopifyAdapter;
