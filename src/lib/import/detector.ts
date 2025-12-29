// =============================================
// DETECTOR DE PLATAFORMA DE E-COMMERCE
// Analisa URL/HTML para identificar a plataforma
// =============================================

import type { PlatformType, PlatformDetectionResult } from './types';

// Padrões de detecção por plataforma
const DETECTION_PATTERNS: Record<PlatformType, DetectionPattern> = {
  shopify: {
    urlPatterns: [
      /\.myshopify\.com/i,
      /cdn\.shopify\.com/i,
    ],
    htmlPatterns: [
      /Shopify\.theme/i,
      /cdn\.shopify\.com/i,
      /shopify-section/i,
      /"shopify"/i,
      /Shopify\.shop/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /shopify/i },
    ],
    scriptPatterns: [
      /shopify\.com\/s\//i,
      /cdn\.shopify\.com\/shopifycloud/i,
    ],
    features: ['checkout', 'collections', 'cart'],
  },
  nuvemshop: {
    urlPatterns: [
      /\.lojavirtualnuvem\.com\.br/i,
      /\.nuvemshop\.com\.br/i,
      /\.mitiendanube\.com/i,
      /d26lpennugtm8s\.cloudfront\.net/i,
    ],
    htmlPatterns: [
      /nuvemshop/i,
      /tiendanube/i,
      /LS\.store/i,
      /d26lpennugtm8s\.cloudfront\.net/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /nuvemshop|tiendanube/i },
    ],
    scriptPatterns: [
      /nuvemshop/i,
      /tiendanube/i,
    ],
    features: ['carrinho', 'categorias', 'checkout'],
  },
  tray: {
    urlPatterns: [
      /\.tray\.com\.br/i,
      /\.traycorp\.com\.br/i,
    ],
    htmlPatterns: [
      /tray/i,
      /traycorp/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /tray/i },
    ],
    scriptPatterns: [
      /tray/i,
    ],
    features: ['tray'],
  },
  vtex: {
    urlPatterns: [
      /\.vtexcommercestable\.com\.br/i,
      /\.vteximg\.com\.br/i,
      /\.vtexassets\.com/i,
    ],
    htmlPatterns: [
      /vtex/i,
      /vtexcommerce/i,
      /vtex-store/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /vtex/i },
    ],
    scriptPatterns: [
      /vtex/i,
      /vteximg/i,
    ],
    features: ['vtex'],
  },
  woocommerce: {
    urlPatterns: [],
    htmlPatterns: [
      /woocommerce/i,
      /wc-block/i,
      /wp-content/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /woocommerce|wordpress/i },
    ],
    scriptPatterns: [
      /woocommerce/i,
      /wp-content/i,
    ],
    features: ['woocommerce', 'wp-json'],
  },
  loja_integrada: {
    urlPatterns: [
      /\.lojaintegrada\.com\.br/i,
    ],
    htmlPatterns: [
      /lojaintegrada/i,
      /loja.integrada/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /loja.?integrada/i },
    ],
    scriptPatterns: [
      /lojaintegrada/i,
    ],
    features: ['lojaintegrada'],
  },
  magento: {
    urlPatterns: [],
    htmlPatterns: [
      /magento/i,
      /Mage\./i,
      /mage-init/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /magento/i },
    ],
    scriptPatterns: [
      /mage\//i,
      /magento/i,
    ],
    features: ['magento'],
  },
  opencart: {
    urlPatterns: [],
    htmlPatterns: [
      /opencart/i,
      /catalog\/view/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /opencart/i },
    ],
    scriptPatterns: [
      /opencart/i,
    ],
    features: ['opencart'],
  },
  prestashop: {
    urlPatterns: [],
    htmlPatterns: [
      /prestashop/i,
      /PrestaShop/i,
    ],
    metaPatterns: [
      { name: 'generator', content: /prestashop/i },
    ],
    scriptPatterns: [
      /prestashop/i,
    ],
    features: ['prestashop'],
  },
  unknown: {
    urlPatterns: [],
    htmlPatterns: [],
    metaPatterns: [],
    scriptPatterns: [],
    features: [],
  },
};

interface DetectionPattern {
  urlPatterns: RegExp[];
  htmlPatterns: RegExp[];
  metaPatterns: { name: string; content: RegExp }[];
  scriptPatterns: RegExp[];
  features: string[];
}

interface DetectionScore {
  platform: PlatformType;
  score: number;
  matches: string[];
}

/**
 * Detecta a plataforma de e-commerce a partir de HTML e URL
 */
export function detectPlatform(html: string, url: string): PlatformDetectionResult {
  const scores: DetectionScore[] = [];
  
  for (const [platform, patterns] of Object.entries(DETECTION_PATTERNS)) {
    if (platform === 'unknown') continue;
    
    const score = calculateScore(html, url, patterns);
    if (score.score > 0) {
      scores.push({
        platform: platform as PlatformType,
        ...score,
      });
    }
  }
  
  // Ordenar por score
  scores.sort((a, b) => b.score - a.score);
  
  if (scores.length === 0 || scores[0].score < 10) {
    return {
      platform: 'unknown',
      confidence: 0,
      version: null,
      features: [],
    };
  }
  
  const best = scores[0];
  const confidence = Math.min(100, best.score);
  
  // Tentar extrair versão
  const version = extractVersion(html, best.platform);
  
  return {
    platform: best.platform,
    confidence,
    version,
    features: best.matches,
  };
}

function calculateScore(html: string, url: string, patterns: DetectionPattern): { score: number; matches: string[] } {
  let score = 0;
  const matches: string[] = [];
  
  // URL patterns (peso alto)
  for (const pattern of patterns.urlPatterns) {
    if (pattern.test(url)) {
      score += 40;
      matches.push(`URL: ${pattern.source}`);
    }
  }
  
  // HTML patterns (peso médio)
  for (const pattern of patterns.htmlPatterns) {
    if (pattern.test(html)) {
      score += 15;
      matches.push(`HTML: ${pattern.source}`);
    }
  }
  
  // Meta tags (peso médio)
  for (const meta of patterns.metaPatterns) {
    const metaRegex = new RegExp(`<meta[^>]*name=["']${meta.name}["'][^>]*content=["']([^"']+)["']`, 'i');
    const match = html.match(metaRegex);
    if (match && meta.content.test(match[1])) {
      score += 25;
      matches.push(`Meta: ${meta.name}`);
    }
  }
  
  // Script patterns (peso médio)
  for (const pattern of patterns.scriptPatterns) {
    if (pattern.test(html)) {
      score += 10;
      matches.push(`Script: ${pattern.source}`);
    }
  }
  
  return { score, matches };
}

function extractVersion(html: string, platform: PlatformType): string | null {
  const versionPatterns: Partial<Record<PlatformType, RegExp>> = {
    shopify: /Shopify\.theme\s*=\s*{[^}]*"theme_store_id":\s*(\d+)/i,
    woocommerce: /WooCommerce\s+([\d.]+)/i,
    magento: /Magento\/([\d.]+)/i,
    prestashop: /PrestaShop\/?([\d.]+)/i,
  };
  
  const pattern = versionPatterns[platform];
  if (!pattern) return null;
  
  const match = html.match(pattern);
  return match ? match[1] : null;
}

/**
 * Detecta plataforma apenas pela URL (rápido, menos preciso)
 */
export function detectPlatformByUrl(url: string): PlatformType {
  for (const [platform, patterns] of Object.entries(DETECTION_PATTERNS)) {
    if (platform === 'unknown') continue;
    
    for (const pattern of patterns.urlPatterns) {
      if (pattern.test(url)) {
        return platform as PlatformType;
      }
    }
  }
  
  return 'unknown';
}

/**
 * Verifica se a URL é de um e-commerce válido
 */
export function isValidEcommerceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Normaliza URL para formato padrão
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();
  
  // Adicionar protocolo se não existir
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  
  // Remover barra final
  normalized = normalized.replace(/\/+$/, '');
  
  return normalized;
}

/**
 * Extrai domínio da URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    return parsed.hostname;
  } catch {
    return url;
  }
}
