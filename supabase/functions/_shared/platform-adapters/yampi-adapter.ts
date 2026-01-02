// =====================================================
// YAMPI PLATFORM ADAPTER
// =====================================================
// Extraction adapter for Yampi stores and landing pages
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

export const yampiAdapter: PlatformExtractionAdapter = {
  platform: 'yampi',
  
  detect(html: string, url: string): boolean {
    const combined = (html + url).toLowerCase();
    return /yampi\.com\.br|yampi\.io|data-yampi|yampi-checkout|dooki\.com\.br/i.test(combined);
  },
  
  getMainContentSelector(): string {
    return 'main, .main-content, #main, .page-content, .landing-content';
  },
  
  getSectionSelectors(): string[] {
    return [
      '[data-yampi-section]',
      '.yampi-section',
      '.landing-section',
      'section[class*="section"]',
      '.home-section',
      '[class*="lp-"]',
      '.section-hero',
      '.section-benefits',
      '.section-testimonials',
      '.section-faq',
    ];
  },
  
  getNoisePatterns(): RegExp[] {
    return [
      /yampi-checkout/i,
      /yampi-cart/i,
      /header-yampi/i,
      /footer-yampi/i,
      /popup/i,
      /modal/i,
      /cookie/i,
    ];
  },
  
  getRemoveSelectors(): string[] {
    return [
      '.yampi-header',
      '.yampi-footer',
      '.yampi-cart',
      '.yampi-checkout',
      '[class*="popup"]',
      '[class*="modal"]',
      '[class*="cookie"]',
    ];
  },
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 3500, // Landing pages podem ter JS pesado
      includeTags: ['main', 'section', 'article', 'div'],
      excludeTags: ['nav', 'header', 'footer', 'script', 'style'],
    };
  },
  
  getSectionTypeMap(): Record<string, string> {
    return {
      'hero': 'Hero',
      'section-hero': 'Hero',
      'video-section': 'YouTubeVideo',
      'testimonials': 'Testimonials',
      'section-testimonials': 'Testimonials',
      'benefits': 'InfoHighlights',
      'section-benefits': 'InfoHighlights',
      'faq': 'FAQ',
      'section-faq': 'FAQ',
      'before-after': 'BeforeAfter',
      'product-showcase': 'ProductCard',
      'cta-section': 'CTA',
      'timer': 'CountdownTimer',
      'garantia': 'TextBanners',
      'section-garantia': 'TextBanners',
    };
  },
  
  getAIContext(): string {
    return `Esta página é de uma loja/landing Yampi. Padrões comuns:
- Yampi é muito usado para landing pages de infoprodutos e e-commerce
- Seções podem ter data-yampi-* attributes
- Landing pages geralmente têm: Hero, Vídeo de vendas, Depoimentos, Garantia, FAQ, CTA
- Prova social é muito importante: buscar nomes reais, fotos, vídeos de clientes
- Elementos de urgência: countdown timer, "últimas unidades", "oferta por tempo limitado"
- Benefícios geralmente em cards com ícones (checkmarks, escudos, etc.)
- Checkout pode estar integrado na página (botão comprar direto)
- Seções de garantia geralmente têm selos e badges de confiança
- Buscar por depoimentos em vídeo (comum em landing pages Yampi)`;
  },
};

export default yampiAdapter;
