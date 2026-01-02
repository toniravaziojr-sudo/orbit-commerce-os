// =====================================================
// PLATFORM ADAPTERS REGISTRY
// =====================================================
// Central registry and factory for platform extraction adapters
// =====================================================

import { shopifyAdapter } from './shopify-adapter.ts';
import { nuvemshopAdapter } from './nuvemshop-adapter.ts';
import { trayAdapter } from './tray-adapter.ts';
import { yampiAdapter } from './yampi-adapter.ts';
import { bagyAdapter } from './bagy-adapter.ts';
import { lojaIntegradaAdapter } from './loja-integrada-adapter.ts';
import { genericAdapter } from './generic-adapter.ts';
import type { PlatformExtractionAdapter, PlatformType } from './types.ts';

// Ordered list of adapters (most specific first)
const adapters: PlatformExtractionAdapter[] = [
  shopifyAdapter,
  nuvemshopAdapter,
  trayAdapter,
  yampiAdapter,
  bagyAdapter,
  lojaIntegradaAdapter,
  // genericAdapter is fallback, not included here
];

/**
 * Detect platform and return the appropriate adapter
 */
export function detectAndGetAdapter(html: string, url: string): PlatformExtractionAdapter {
  for (const adapter of adapters) {
    if (adapter.detect(html, url)) {
      console.log(`[PLATFORM] Detected: ${adapter.platform}`);
      return adapter;
    }
  }
  
  console.log('[PLATFORM] No specific platform detected, using generic adapter');
  return genericAdapter;
}

/**
 * Get adapter by platform name
 */
export function getAdapterByPlatform(platform: PlatformType): PlatformExtractionAdapter {
  const found = adapters.find(a => a.platform === platform);
  return found || genericAdapter;
}

/**
 * Get list of supported platforms
 */
export function getSupportedPlatforms(): PlatformType[] {
  return adapters.map(a => a.platform);
}

/**
 * Apply adapter's remove selectors to HTML
 */
export function cleanHtmlWithAdapter(html: string, adapter: PlatformExtractionAdapter): string {
  let cleaned = html;
  
  // Remove elements matching remove selectors
  for (const selector of adapter.getRemoveSelectors()) {
    // Simple regex-based removal (for common patterns)
    const classMatch = selector.match(/^\.(.+)$/);
    const idMatch = selector.match(/^#(.+)$/);
    const tagMatch = selector.match(/^(\w+)$/);
    
    if (classMatch) {
      const className = classMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(
        new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi'),
        ''
      );
    } else if (idMatch) {
      const idName = idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(
        new RegExp(`<[^>]*id="${idName}"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi'),
        ''
      );
    } else if (tagMatch) {
      cleaned = cleaned.replace(
        new RegExp(`<${tagMatch[1]}[\\s\\S]*?<\\/${tagMatch[1]}>`, 'gi'),
        ''
      );
    }
  }
  
  // Filter by noise patterns
  for (const pattern of adapter.getNoisePatterns()) {
    // Find and remove elements containing these patterns
    const patternStr = pattern.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(
      new RegExp(`<[^>]*(?:class|id)="[^"]*${patternStr}[^"]*"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi'),
      ''
    );
  }
  
  return cleaned;
}

/**
 * Extract sections from HTML using adapter's selectors
 */
export function extractSectionsWithAdapter(
  html: string, 
  adapter: PlatformExtractionAdapter
): { html: string; type?: string }[] {
  const sections: { html: string; type?: string }[] = [];
  const sectionTypeMap = adapter.getSectionTypeMap();
  
  for (const selector of adapter.getSectionSelectors()) {
    // Build regex from selector
    const classMatch = selector.match(/^\[class\*="(.+)"\]$/);
    const exactClassMatch = selector.match(/^\.(.+)$/);
    const idMatch = selector.match(/^\[id\^="(.+)"\]$/);
    
    let pattern: RegExp;
    
    if (classMatch) {
      pattern = new RegExp(
        `<(?:section|div)[^>]*class="[^"]*${classMatch[1]}[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:section|div)>`,
        'gi'
      );
    } else if (exactClassMatch) {
      pattern = new RegExp(
        `<(?:section|div)[^>]*class="[^"]*\\b${exactClassMatch[1]}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:section|div)>`,
        'gi'
      );
    } else if (idMatch) {
      pattern = new RegExp(
        `<(?:section|div)[^>]*id="${idMatch[1]}[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:section|div)>`,
        'gi'
      );
    } else if (selector.startsWith('section') || selector === 'section') {
      pattern = /<section[^>]*>([\s\S]*?)<\/section>/gi;
    } else {
      continue;
    }
    
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      if (match[0].length > 100) {
        // Try to determine section type from class
        const classNameMatch = match[0].match(/class="([^"]+)"/);
        const className = classNameMatch?.[1] || '';
        
        let sectionType: string | undefined;
        for (const [key, type] of Object.entries(sectionTypeMap)) {
          if (className.includes(key)) {
            sectionType = type;
            break;
          }
        }
        
        sections.push({ 
          html: match[0], 
          type: sectionType 
        });
      }
    }
  }
  
  return sections;
}

// Re-export types
export * from './types.ts';
export { shopifyAdapter } from './shopify-adapter.ts';
export { nuvemshopAdapter } from './nuvemshop-adapter.ts';
export { trayAdapter } from './tray-adapter.ts';
export { yampiAdapter } from './yampi-adapter.ts';
export { bagyAdapter } from './bagy-adapter.ts';
export { lojaIntegradaAdapter } from './loja-integrada-adapter.ts';
export { genericAdapter } from './generic-adapter.ts';
