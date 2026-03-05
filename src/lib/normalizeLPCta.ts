// =============================================
// CTA NORMALIZATION — Deterministic text limits
// Ensures CTA buttons stay clean and professional
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

  // Try to find a fallback that fits
  const fallbacks = context === 'pricing' ? PRICING_FALLBACKS : HERO_FALLBACKS;
  return fallbacks[0];
}

/**
 * Normalize all CTAs in an LP schema (mutates nothing, returns new object).
 */
export function normalizeAllCTAs(sections: any[]): any[] {
  return sections.map(section => {
    const s = { ...section, props: { ...section.props } };
    
    switch (s.type) {
      case 'hero':
        s.props.ctaText = normalizeCTA(s.props.ctaText, 'hero');
        break;
      case 'cta_final':
        s.props.ctaText = normalizeCTA(s.props.ctaText, 'cta_final');
        break;
      case 'pricing':
        if (s.props.cards) {
          s.props.cards = s.props.cards.map((card: any) => ({
            ...card,
            ctaText: normalizeCTA(card.ctaText, 'pricing'),
          }));
        }
        break;
    }
    
    return s;
  });
}
