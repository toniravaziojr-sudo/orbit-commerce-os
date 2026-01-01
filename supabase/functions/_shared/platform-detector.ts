// =============================================
// DETECTOR DE PLATAFORMA PARA EDGE FUNCTIONS
// Versão simplificada do detector para uso em Deno
// =============================================

export type PlatformType = 
  | 'shopify'
  | 'nuvemshop'
  | 'tray'
  | 'vtex'
  | 'woocommerce'
  | 'loja_integrada'
  | 'magento'
  | 'prestashop'
  | 'bagy'
  | 'yampi'
  | 'wix'
  | 'generic';

interface DetectionResult {
  platform: PlatformType;
  confidence: number;
  matches: string[];
}

/**
 * Detecta a plataforma de e-commerce a partir do HTML e URL
 */
export function detectPlatformFromHtml(html: string, url?: string): DetectionResult {
  const matches: string[] = [];
  let platform: PlatformType = 'generic';
  let confidence = 0;
  
  // Shopify detection
  const shopifyPatterns = [
    { pattern: /cdn\.shopify\.com/i, weight: 30 },
    { pattern: /Shopify\.theme/i, weight: 25 },
    { pattern: /shopify-section/i, weight: 25 },
    { pattern: /<!-- BEGIN sections: header-group -->/i, weight: 20 },
    { pattern: /\.myshopify\.com/i, weight: 30 },
    { pattern: /"shopify"/i, weight: 15 },
    { pattern: /Shopify\.shop/i, weight: 20 },
  ];
  
  let shopifyScore = 0;
  for (const { pattern, weight } of shopifyPatterns) {
    if (pattern.test(html) || (url && pattern.test(url))) {
      shopifyScore += weight;
      matches.push(`shopify: ${pattern.source}`);
    }
  }
  
  if (shopifyScore > confidence) {
    platform = 'shopify';
    confidence = Math.min(shopifyScore, 100);
  }
  
  // Nuvemshop detection
  const nuvemshopPatterns = [
    { pattern: /nuvemshop/i, weight: 30 },
    { pattern: /tiendanube/i, weight: 30 },
    { pattern: /LS\.store/i, weight: 25 },
    { pattern: /d26lpennugtm8s\.cloudfront\.net/i, weight: 25 },
    { pattern: /\.lojavirtualnuvem\.com\.br/i, weight: 30 },
  ];
  
  let nuvemshopScore = 0;
  for (const { pattern, weight } of nuvemshopPatterns) {
    if (pattern.test(html) || (url && pattern.test(url))) {
      nuvemshopScore += weight;
      matches.push(`nuvemshop: ${pattern.source}`);
    }
  }
  
  if (nuvemshopScore > confidence) {
    platform = 'nuvemshop';
    confidence = Math.min(nuvemshopScore, 100);
  }
  
  // WooCommerce detection
  const wooPatterns = [
    { pattern: /woocommerce/i, weight: 30 },
    { pattern: /wc-block/i, weight: 20 },
    { pattern: /wp-content/i, weight: 15 },
    { pattern: /wc-add-to-cart/i, weight: 25 },
  ];
  
  let wooScore = 0;
  for (const { pattern, weight } of wooPatterns) {
    if (pattern.test(html) || (url && pattern.test(url))) {
      wooScore += weight;
      matches.push(`woocommerce: ${pattern.source}`);
    }
  }
  
  if (wooScore > confidence) {
    platform = 'woocommerce';
    confidence = Math.min(wooScore, 100);
  }
  
  // VTEX detection
  const vtexPatterns = [
    { pattern: /vtex/i, weight: 30 },
    { pattern: /\.vteximg\.com/i, weight: 25 },
    { pattern: /vtex-render/i, weight: 25 },
  ];
  
  let vtexScore = 0;
  for (const { pattern, weight } of vtexPatterns) {
    if (pattern.test(html) || (url && pattern.test(url))) {
      vtexScore += weight;
      matches.push(`vtex: ${pattern.source}`);
    }
  }
  
  if (vtexScore > confidence) {
    platform = 'vtex';
    confidence = Math.min(vtexScore, 100);
  }
  
  // Tray detection
  const trayPatterns = [
    { pattern: /tray\.com\.br/i, weight: 30 },
    { pattern: /traycorp/i, weight: 30 },
  ];
  
  let trayScore = 0;
  for (const { pattern, weight } of trayPatterns) {
    if (pattern.test(html) || (url && pattern.test(url))) {
      trayScore += weight;
      matches.push(`tray: ${pattern.source}`);
    }
  }
  
  if (trayScore > confidence) {
    platform = 'tray';
    confidence = Math.min(trayScore, 100);
  }
  
  // Bagy detection
  const bagyPatterns = [
    { pattern: /bagy\.com\.br/i, weight: 30 },
    { pattern: /bfrota/i, weight: 25 },
  ];
  
  let bagyScore = 0;
  for (const { pattern, weight } of bagyPatterns) {
    if (pattern.test(html) || (url && pattern.test(url))) {
      bagyScore += weight;
      matches.push(`bagy: ${pattern.source}`);
    }
  }
  
  if (bagyScore > confidence) {
    platform = 'bagy';
    confidence = Math.min(bagyScore, 100);
  }
  
  // Yampi detection
  const yampiPatterns = [
    { pattern: /yampi/i, weight: 30 },
    { pattern: /assets\.yampi/i, weight: 25 },
  ];
  
  let yampiScore = 0;
  for (const { pattern, weight } of yampiPatterns) {
    if (pattern.test(html) || (url && pattern.test(url))) {
      yampiScore += weight;
      matches.push(`yampi: ${pattern.source}`);
    }
  }
  
  if (yampiScore > confidence) {
    platform = 'yampi';
    confidence = Math.min(yampiScore, 100);
  }
  
  console.log(`[PLATFORM-DETECT] Detected: ${platform} (confidence: ${confidence}%, matches: ${matches.length})`);
  
  return {
    platform,
    confidence,
    matches,
  };
}
