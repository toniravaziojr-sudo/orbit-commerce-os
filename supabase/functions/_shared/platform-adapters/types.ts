// =====================================================
// PLATFORM ADAPTER TYPES
// =====================================================
// Common interfaces for platform-specific extraction adapters
// =====================================================

export type PlatformType = 
  | 'shopify' 
  | 'nuvemshop' 
  | 'tray' 
  | 'woocommerce' 
  | 'yampi' 
  | 'bagy' 
  | 'loja_integrada' 
  | 'vtex' 
  | 'generic';

export interface FirecrawlOptions {
  waitFor?: number;
  includeTags?: string[];
  excludeTags?: string[];
}

export interface PlatformExtractionAdapter {
  // Platform identifier
  platform: PlatformType;
  
  // Detect if HTML/URL is from this platform
  detect(html: string, url: string): boolean;
  
  // CSS selector for main content area
  getMainContentSelector(): string;
  
  // Selectors to extract semantic sections
  getSectionSelectors(): string[];
  
  // Regex patterns for noise to ignore
  getNoisePatterns(): RegExp[];
  
  // Selectors for elements to remove before processing
  getRemoveSelectors(): string[];
  
  // Firecrawl-specific options (waitFor for SPA, etc.)
  getFirecrawlOptions(): FirecrawlOptions;
  
  // Map platform-specific section classes to block types
  getSectionTypeMap(): Record<string, string>;
  
  // Context string to pass to AI for better classification
  getAIContext(): string;
}

// Base adapter with common functionality
export abstract class BasePlatformAdapter implements PlatformExtractionAdapter {
  abstract platform: PlatformType;
  abstract detect(html: string, url: string): boolean;
  
  getMainContentSelector(): string {
    return 'main, [role="main"], .main-content, #content';
  }
  
  getSectionSelectors(): string[] {
    return ['section', '[class*="section"]'];
  }
  
  getNoisePatterns(): RegExp[] {
    return [
      /header/i,
      /footer/i,
      /nav/i,
      /menu/i,
      /cookie/i,
      /modal/i,
      /popup/i,
      /whatsapp/i,
    ];
  }
  
  getRemoveSelectors(): string[] {
    return [
      'header',
      'footer',
      'nav',
      '.menu',
      '[class*="cookie"]',
      '.modal',
      '.popup',
    ];
  }
  
  getFirecrawlOptions(): FirecrawlOptions {
    return {
      waitFor: 2000,
      includeTags: ['main', 'section', 'article'],
      excludeTags: ['nav', 'header', 'footer', 'aside'],
    };
  }
  
  getSectionTypeMap(): Record<string, string> {
    return {};
  }
  
  getAIContext(): string {
    return '';
  }
}
