// =====================================================
// NUVEMSHOP/TIENDANUBE PLATFORM ADAPTER
// =====================================================
// Extraction adapter for Nuvemshop/Tiendanube stores (SPA heavy)
// VERSION: 2026-01-30.2130 - Enhanced for category/menu extraction
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

// ===========================================
// NUVEMSHOP-SPECIFIC PATTERNS (exported for edge functions)
// ===========================================

export const NUVEMSHOP_PATTERNS = {
  // Category URL patterns
  categoryPatterns: [
    /\/(?:categoria|categorias)\/([^/?#]+)/i,
    /\/(?:c)\/([^/?#]+)/i,
    /\/(?:collections?)\/([^/?#]+)/i,
    /\/(?:departamento|departamentos)\/([^/?#]+)/i,
  ],
  
  // Page URL patterns
  pagePatterns: [
    /\/(?:pagina|paginas|pages?)\/([^/?#]+)/i,
    /\/(?:institucional)\/([^/?#]+)/i,
    /\/(?:politica|politicas)\/([^/?#]+)/i,
    /\/(?:termos|terms)\/([^/?#]+)/i,
    /\/(?:sobre|about|quem-somos)/i,
    /\/(?:contato|contact|fale-conosco)/i,
    /\/(?:faq|ajuda|perguntas)/i,
    /\/(?:troca|devolucao|trocas|devolucoes)/i,
  ],
  
  // Product grid detection patterns (HTML classes/elements)
  productGridPatterns: [
    /<div[^>]*class="[^"]*(?:js-product-table|product-table|js-product-grid)[^"]*"/gi,
    /<div[^>]*class="[^"]*(?:js-item-product|item-product|product-item)[^"]*"/gi,
    /<article[^>]*class="[^"]*(?:js-item-product|item-product|product-item)[^"]*"/gi,
    /<div[^>]*class="[^"]*(?:item-product|js-item-product|product-card)[^"]*"/gi,
    /<[^>]*data-product-id="[^"]+"/gi,
    /<[^>]*data-item-id="[^"]+"/gi,
    /<a[^>]*href="[^"]*\/produtos?\/[^"]+"/gi,
    /<a[^>]*href="[^"]*\/product\/[^"]+"/gi,
  ],
  
  // Header menu patterns
  headerMenuPatterns: [
    /<nav[^>]*class="[^"]*(?:js-nav|js-navigation|nav-primary|main-nav)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
    /<ul[^>]*class="[^"]*(?:js-nav-list|nav-list|nav-desktop|main-menu)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
    /<div[^>]*class="[^"]*(?:js-mobile-nav|mobile-nav|nav-drawer)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*(?:js-mega-menu|mega-menu|dropdown-menu)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ],
  
  // Footer menu patterns
  footerMenuPatterns: [
    /<div[^>]*class="[^"]*(?:footer-column|footer-col|js-footer-column)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*(?:footer-links|footer-nav)[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<ul[^>]*class="[^"]*(?:footer-list|footer-menu|footer-links)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
  ],
  
  // Banner patterns
  bannerDesktopPatterns: [
    /<img[^>]*class="[^"]*(?:category-banner|js-category-banner|banner-category)[^"]*"[^>]*src="([^"]+)"/i,
    /<div[^>]*class="[^"]*(?:category-banner|js-category-banner|banner-category)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i,
    /style="[^"]*background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)[^"]*"/i,
    /<picture[^>]*>[\s\S]*?<source[^>]*media="\(min-width[^"]*"[^>]*srcset="([^"]+)"/i,
  ],
  
  bannerMobilePatterns: [
    /<source[^>]*media="\(max-width[^"]*"[^>]*srcset="([^"]+)"/i,
    /data-mobile-src="([^"]+)"/i,
    /data-src-mobile="([^"]+)"/i,
    /srcset="([^"]+?)(?:\s+320w|\s+480w|\s+375w)/i,
    /<img[^>]*class="[^"]*mobile[^"]*"[^>]*src="([^"]+)"/i,
  ],
};

export const nuvemshopAdapter: PlatformExtractionAdapter = {
  platform: 'nuvemshop',
  
  detect(html: string, url: string): boolean {
    const combined = (html + url).toLowerCase();
    // Enhanced detection patterns for Nuvemshop/Tiendanube
    return /nuvemshop|tiendanube|lojavirtualnuvem|d26lpennugtm8s\.cloudfront\.net|nuvem\.app|vnda\.com\.br/i.test(combined) ||
           // Detect by JS/CSS patterns unique to Nuvemshop
           /js-main-container|js-product-table|js-item-product|data-store="nuvem"/i.test(html);
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
- Buscar informações em meta tags e structured data quando HTML parecer vazio
- Categorias: /categoria/, /c/, /departamento/
- Páginas: /pagina/, /institucional/
- Menus: .js-nav, .nav-primary, footer-column`;
  },
};

export default nuvemshopAdapter;
