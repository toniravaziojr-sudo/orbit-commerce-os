// =============================================
// CTA NORMALIZATION + ASSET VALIDATION
// Deterministic text limits + asset health checks
// =============================================

const PRICING_CTA_MAX = 18;
const HERO_CTA_MAX = 22;

const PRICING_FALLBACKS = [
  'Comprar agora',
  'Garantir oferta',
  'Aproveitar',
  'Quero meu kit',
];

const HERO_FALLBACKS = [
  'Comprar agora',
  'Garantir oferta',
  'Quero meu kit',
  'Começar tratamento',
];

/**
 * Normalize CTA text to fit within character limits.
 * If text exceeds the limit, replaces with a deterministic fallback.
 */
export function normalizeCTA(
  text: string,
  context: 'pricing' | 'hero' | 'cta_final' = 'hero'
): string {
  if (!text || !text.trim()) {
    return context === 'pricing' ? PRICING_FALLBACKS[0] : HERO_FALLBACKS[0];
  }

  const clean = text.trim();
  const maxLen = context === 'pricing' ? PRICING_CTA_MAX : HERO_CTA_MAX;

  if (clean.length <= maxLen) return clean;

  const fallbacks = context === 'pricing' ? PRICING_FALLBACKS : HERO_FALLBACKS;
  return fallbacks[0];
}

/**
 * Validate that an image URL is structurally valid (not empty, starts with http).
 * Returns the URL if valid, or the fallback.
 */
export function validateAssetUrl(url: string | undefined | null, fallback = ''): string {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed || !trimmed.startsWith('http')) return fallback;
  return trimmed;
}

/**
 * Check if an image URL looks like a raw catalog image (white bg product shot).
 * Used to enforce "catalog only in pricing" rule.
 */
export function isCatalogImage(url: string): boolean {
  if (!url) return false;
  // Catalog images typically come from product_images table and are stored in store-assets
  // Scene images are in lp-creatives/ paths
  return !url.includes('lp-creatives/') && 
         !url.includes('section-hero') && 
         !url.includes('section-cta') &&
         !url.includes('unsplash.com') &&
         !url.includes('stock');
}

/**
 * Normalize all CTAs in an LP schema (mutates nothing, returns new object).
 * Also validates asset URLs with fallbacks.
 */
export function normalizeAllCTAs(sections: any[]): any[] {
  return sections.map(section => {
    const s = { ...section, props: { ...section.props } };
    
    switch (s.type) {
      case 'hero':
        s.props.ctaText = normalizeCTA(s.props.ctaText, 'hero');
        s.props.productImageUrl = validateAssetUrl(s.props.productImageUrl);
        s.props.heroSceneDesktopUrl = validateAssetUrl(s.props.heroSceneDesktopUrl);
        s.props.heroSceneMobileUrl = validateAssetUrl(s.props.heroSceneMobileUrl);
        s.props.backgroundImageUrl = validateAssetUrl(s.props.backgroundImageUrl);
        break;
      case 'cta_final':
        s.props.ctaText = normalizeCTA(s.props.ctaText, 'cta_final');
        s.props.productImageUrl = validateAssetUrl(s.props.productImageUrl);
        s.props.ctaSceneDesktopUrl = validateAssetUrl(s.props.ctaSceneDesktopUrl);
        s.props.ctaSceneMobileUrl = validateAssetUrl(s.props.ctaSceneMobileUrl);
        break;
      case 'pricing':
        if (s.props.cards) {
          s.props.cards = s.props.cards.map((card: any) => ({
            ...card,
            ctaText: normalizeCTA(card.ctaText, 'pricing'),
            imageUrl: validateAssetUrl(card.imageUrl),
          }));
        }
        break;
      case 'social_proof':
        if (s.props.imageUrls) {
          s.props.imageUrls = s.props.imageUrls
            .map((url: string) => validateAssetUrl(url))
            .filter((url: string) => url !== '');
        }
        break;
      case 'benefits':
        if (s.props.items) {
          s.props.items = s.props.items.map((item: any) => ({
            ...item,
            imageUrl: validateAssetUrl(item.imageUrl),
          }));
        }
        break;
    }
    
    return s;
  });
}
