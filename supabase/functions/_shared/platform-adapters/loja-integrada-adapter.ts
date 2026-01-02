// =====================================================
// LOJA INTEGRADA PLATFORM ADAPTER
// =====================================================
// Extraction adapter for Loja Integrada stores
// =====================================================

import type { PlatformExtractionAdapter, FirecrawlOptions } from './types.ts';

export const lojaIntegradaAdapter: PlatformExtractionAdapter = {
  platform: 'loja_integrada',
  
  detect(html: string, url: string): boolean {
    const combined = (html + url).toLowerCase();
    return /lojaintegrada\.com\.br|loja-integrada|\.li\./i.test(combined);
  },
  
  getMainContentSelector(): string {
    return '#content, .content, main, .main-container, .home-container';
  },
  
  getSectionSelectors(): string[] {
    return [
      '.modulo-home',
      '.secao-home',
      '[class*="home-"]',
      '.banner-container',
      '.vitrine-container',
      '.depoimentos-container',
      '[class*="secao-"]',
      '.li-section',
    ];
  },
  
  getNoisePatterns(): RegExp[] {
    return [
      /header-loja/i,
      /footer-loja/i,
      /menu-categorias/i,
      /carrinho-flutuante/i,
      /cookie/i,
      /popup/i,
      /whatsapp/i,
    ];
  },
  
  getRemoveSelectors(): string[] {
    return [
      '.header-loja',
      '.footer-loja',
      '.menu-categorias',
      '.carrinho-flutuante',
      '.modal',
      '.popup',
      '.whatsapp-flutuante',
      '[class*="cookie"]',
    ];
  },
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 3000, // Pode ter lazy loading
      includeTags: ['main', 'section', 'article', 'div'],
      excludeTags: ['nav', 'header', 'footer', 'script', 'style'],
    };
  },
  
  getSectionTypeMap(): Record<string, string> {
    return {
      'banner-container': 'ImageCarousel',
      'vitrine-container': 'ProductGrid',
      'categorias-container': 'CategoryGrid',
      'depoimentos-container': 'Testimonials',
      'marcas-container': 'ImageGallery',
      'newsletter-container': 'CTA',
      'video-container': 'YouTubeVideo',
      'modulo-home': 'RichText',
      'secao-home': 'ContentColumns',
    };
  },
  
  getAIContext(): string {
    return `Esta página é de uma loja Loja Integrada. Padrões comuns:
- Plataforma brasileira popular para pequenas e médias lojas
- Módulos de home geralmente com .modulo-home ou .secao-home
- Banners em containers .banner-container
- Vitrines de produtos em .vitrine-container
- Layout pode ser customizado via temas
- Geralmente tem: slider principal, vitrines de produtos, depoimentos, newsletter
- Campos geralmente em português (nome, descricao, preco_venda)
- Imagens de produtos em alta resolução
- Depoimentos podem ter avaliação com estrelas
- Categorias com ícones e imagens de destaque`;
  },
};

export default lojaIntegradaAdapter;
