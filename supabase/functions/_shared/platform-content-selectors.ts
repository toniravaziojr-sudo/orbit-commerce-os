// =============================================
// SELETORES DE CONTEÚDO POR PLATAFORMA
// Define como extrair conteúdo principal de cada plataforma
// =============================================

export type SupportedPlatform = 
  | 'shopify' 
  | 'nuvemshop' 
  | 'woocommerce' 
  | 'vtex' 
  | 'tray' 
  | 'bagy' 
  | 'yampi' 
  | 'loja_integrada'
  | 'magento'
  | 'prestashop'
  | 'wix'
  | 'generic';

export interface PlatformContentConfig {
  // Seletores CSS para encontrar o conteúdo principal
  mainContentSelectors: string[];
  // Seletores CSS para EXCLUIR (header, footer, nav)
  excludeSelectors: string[];
  // Padrões de comentários HTML que delimitam seções
  sectionComments?: {
    headerStart: RegExp;
    headerEnd: RegExp;
    footerStart: RegExp;
    footerEnd: RegExp;
  };
  // Padrões adicionais de comentários para remover (overlay, etc)
  additionalCommentPatterns?: Array<{ start: RegExp; end: RegExp }>;
  // Atributos data-* específicos da plataforma
  dataAttributes?: {
    mainContent?: string[];
    header?: string[];
    footer?: string[];
  };
}

// Configuração de seletores por plataforma
export const PLATFORM_SELECTORS: Record<SupportedPlatform, PlatformContentConfig> = {
  shopify: {
    mainContentSelectors: [
      'main[role="main"]',
      'main.main-content',
      'main#MainContent',
      '[data-section-type="main"]',
      '.shopify-section:not(.shopify-section-group-header-group):not(.shopify-section-group-footer-group)',
    ],
    excludeSelectors: [
      // Tags semânticas
      'header',
      'footer',
      'nav',
      // Shopify section groups
      '.shopify-section-group-header-group',
      '.shopify-section-group-footer-group',
      '.shopify-section-group-overlay-group',
      '[data-section-type="header"]',
      '[data-section-type="footer"]',
      // Announcement bar
      '.announcement-bar',
      '.announcement-bar-section',
      '#shopify-section-announcement-bar',
      'nav[role="navigation"]',
      // PADRÕES GENÉRICOS - qualquer elemento com header/footer no nome
      '[class*="header"]',
      '[class*="footer"]',
      '[id*="header"]',
      '[id*="footer"]',
      // Modais e overlays comuns do Shopify
      '.modal-parcel',
      '.backdrop-modal-parcel',
      '.menu-flutuante',
      '#MenuFlutuante',
      '[class*="modal"]',
      '[class*="overlay"]',
      '[class*="popup"]',
      // Outros elementos comuns de navegação
      '[class*="nav-"]',
      '[class*="menu-"]',
      '[class*="selos-"]',
    ],
    sectionComments: {
      headerStart: /<!-- BEGIN sections: header-group -->/i,
      headerEnd: /<!-- END sections: header-group -->/i,
      footerStart: /<!-- BEGIN sections: footer-group -->/i,
      footerEnd: /<!-- END sections: footer-group -->/i,
    },
    // Comentários adicionais para remover (overlay, etc)
    additionalCommentPatterns: [
      { start: /<!-- BEGIN sections: overlay-group -->/i, end: /<!-- END sections: overlay-group -->/i },
    ],
  },
  
  nuvemshop: {
    mainContentSelectors: [
      '[data-store="main-content"]',
      'main',
      '.page-content',
      '.js-main-content',
      '#content',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '[data-store="header"]',
      '[data-store="footer"]',
      '.js-nav',
      '.js-mobile-nav',
      '.nav-primary',
      '.footer-main',
      '#header',
      '#footer',
    ],
    dataAttributes: {
      mainContent: ['data-store="main-content"'],
      header: ['data-store="header"'],
      footer: ['data-store="footer"'],
    },
  },
  
  woocommerce: {
    mainContentSelectors: [
      'main',
      '#primary',
      '.site-main',
      '.entry-content',
      '.page-content',
      '.woocommerce-page-content',
      '#main-content',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '#masthead',
      '#colophon',
      '.site-header',
      '.site-footer',
      '.header-main',
      '.footer-main',
      '#secondary',
      'aside',
      '.sidebar',
      '.widget-area',
    ],
  },
  
  vtex: {
    mainContentSelectors: [
      '.vtex-render-container',
      '.vtex-flex-layout',
      'main',
      '#main-content',
      '[class*="vtex-store-components"]',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '[class*="vtex-header"]',
      '[class*="vtex-footer"]',
      '.vtex-minicart',
      '.vtex-menu',
      '[data-testid="header"]',
      '[data-testid="footer"]',
    ],
  },
  
  tray: {
    mainContentSelectors: [
      'main',
      '.content-wrapper',
      '.page-content',
      '#content',
      '.container-fluid:not(.header):not(.footer)',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '.header',
      '.footer',
      '.nav-menu',
      '.top-bar',
      '.header-container',
      '.footer-container',
    ],
  },
  
  bagy: {
    mainContentSelectors: [
      'main',
      '.page-content',
      '.content-area',
      '#main',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '.site-header',
      '.site-footer',
      '.nav-container',
    ],
  },
  
  yampi: {
    mainContentSelectors: [
      'main',
      '.content',
      '.page-wrapper',
      '#content',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '.header',
      '.footer',
      '.nav',
    ],
  },
  
  loja_integrada: {
    mainContentSelectors: [
      'main',
      '.content',
      '.page-content',
      '#main-content',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '.header',
      '.footer',
      '.menu',
      '.nav',
    ],
  },
  
  magento: {
    mainContentSelectors: [
      'main#maincontent',
      '.page-main',
      '.column.main',
      '#maincontent',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '.page-header',
      '.page-footer',
      '.nav-sections',
      '.page-sidebar',
    ],
  },
  
  prestashop: {
    mainContentSelectors: [
      'main',
      '#content',
      '#main',
      '.page-content',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '#header',
      '#footer',
      '.header',
      '.footer',
    ],
  },
  
  wix: {
    mainContentSelectors: [
      'main',
      '[data-testid="main"]',
      '#PAGES_CONTAINER',
      '[id*="comp-"]',
    ],
    excludeSelectors: [
      'header',
      'footer',
      '#SITE_HEADER',
      '#SITE_FOOTER',
      '[data-testid="header"]',
      '[data-testid="footer"]',
    ],
  },
  
  // Fallback genérico para plataformas desconhecidas
  generic: {
    mainContentSelectors: [
      'main',
      'main[role="main"]',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '.page-content',
      '#content',
      '#main',
      '#main-content',
    ],
    excludeSelectors: [
      'header',
      'footer',
      'nav',
      'aside',
      '.header',
      '.footer',
      '.nav',
      '.sidebar',
      '.menu',
      '.announcement',
      '.top-bar',
      '#header',
      '#footer',
      '#nav',
      '#sidebar',
    ],
  },
};

// Função para obter config de uma plataforma (com fallback para generic)
export function getPlatformConfig(platform: string): PlatformContentConfig {
  const normalizedPlatform = platform.toLowerCase() as SupportedPlatform;
  return PLATFORM_SELECTORS[normalizedPlatform] || PLATFORM_SELECTORS.generic;
}
