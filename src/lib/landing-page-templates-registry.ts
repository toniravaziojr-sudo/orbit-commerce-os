// =============================================
// LP TEMPLATES REGISTRY — V9.0
// 10 curated premium templates with dedicated
// Hero + CTA Final components per template
// =============================================

export type LPPremiumTemplateId =
  | 'luxury_editorial'
  | 'bold_impact'
  | 'minimal_zen'
  | 'organic_nature'
  | 'corporate_trust'
  | 'neon_energy'
  | 'warm_artisan'
  | 'tech_gradient'
  | 'classic_elegant'
  | 'urban_street';

export interface LPTemplateEntry {
  id: LPPremiumTemplateId;
  label: string;
  description: string;
  allowedMoods: string[];
  defaultMood: string;
  fontDisplay: string;
  fontBody: string;
  fontImportUrl: string;
}

export const LP_PREMIUM_TEMPLATES: Record<LPPremiumTemplateId, LPTemplateEntry> = {
  luxury_editorial: {
    id: 'luxury_editorial',
    label: 'Luxury Editorial',
    description: 'Tipografia gigante serif, packshot flutuante, fundo escuro com glow dourado',
    allowedMoods: ['luxury', 'minimal'],
    defaultMood: 'luxury',
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Inter:wght@300;400;500;600&display=swap',
  },
  bold_impact: {
    id: 'bold_impact',
    label: 'Bold Impact',
    description: 'Bebas Neue enorme, diagonal cortada, drop-shadow colorido',
    allowedMoods: ['bold', 'corporate'],
    defaultMood: 'bold',
    fontDisplay: "'Bebas Neue', Impact, sans-serif",
    fontBody: "'Archivo', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@400;500;600;700&display=swap',
  },
  minimal_zen: {
    id: 'minimal_zen',
    label: 'Minimal Zen',
    description: 'Muito espaço negativo, tipografia fina, produto centralizado',
    allowedMoods: ['minimal', 'luxury'],
    defaultMood: 'minimal',
    fontDisplay: "'Sora', -apple-system, sans-serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500&display=swap',
  },
  organic_nature: {
    id: 'organic_nature',
    label: 'Organic Nature',
    description: 'Formas orgânicas, border-radius irregulares, tons terrosos',
    allowedMoods: ['organic', 'minimal'],
    defaultMood: 'organic',
    fontDisplay: "'Lora', Georgia, serif",
    fontBody: "'Montserrat', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap',
  },
  corporate_trust: {
    id: 'corporate_trust',
    label: 'Corporate Trust',
    description: 'Grid estruturado, badges de confiança, sem-serif pesada',
    allowedMoods: ['corporate', 'minimal'],
    defaultMood: 'corporate',
    fontDisplay: "'Plus Jakarta Sans', -apple-system, sans-serif",
    fontBody: "'Plus Jakarta Sans', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap',
  },
  neon_energy: {
    id: 'neon_energy',
    label: 'Neon Energy',
    description: 'Fundo escuro com glows neon, bordas luminosas, tipografia condensada',
    allowedMoods: ['bold', 'luxury'],
    defaultMood: 'bold',
    fontDisplay: "'Oswald', Impact, sans-serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
  },
  warm_artisan: {
    id: 'warm_artisan',
    label: 'Warm Artisan',
    description: 'Textura de papel, tipografia manuscrita + serif, tons quentes',
    allowedMoods: ['organic', 'luxury'],
    defaultMood: 'organic',
    fontDisplay: "'Cormorant Garamond', Georgia, serif",
    fontBody: "'Lato', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lato:wght@300;400;700&display=swap',
  },
  tech_gradient: {
    id: 'tech_gradient',
    label: 'Tech Gradient',
    description: 'Gradientes mesh vibrantes, tipografia geométrica, glassmorphism pesado',
    allowedMoods: ['corporate', 'bold', 'minimal'],
    defaultMood: 'corporate',
    fontDisplay: "'Space Grotesk', -apple-system, sans-serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
  },
  classic_elegant: {
    id: 'classic_elegant',
    label: 'Classic Elegant',
    description: 'Composição editorial tipo revista, serifada, muito espaço, linha decorativa',
    allowedMoods: ['luxury', 'minimal'],
    defaultMood: 'luxury',
    fontDisplay: "'DM Serif Display', Georgia, serif",
    fontBody: "'DM Sans', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600;700&display=swap',
  },
  urban_street: {
    id: 'urban_street',
    label: 'Urban Street',
    description: 'Fonte bold grotesque, elementos gráficos diagonais, alto contraste',
    allowedMoods: ['bold', 'corporate'],
    defaultMood: 'bold',
    fontDisplay: "'Anton', Impact, sans-serif",
    fontBody: "'Barlow', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&display=swap',
  },
};

/**
 * Get a template entry by ID, with fallback to luxury_editorial
 */
export function getTemplateEntry(templateId?: string): LPTemplateEntry {
  if (templateId && templateId in LP_PREMIUM_TEMPLATES) {
    return LP_PREMIUM_TEMPLATES[templateId as LPPremiumTemplateId];
  }
  return LP_PREMIUM_TEMPLATES.luxury_editorial;
}

/**
 * Select a template deterministically from a seed
 */
export function selectTemplateFromSeed(seed: number, allowedIds?: LPPremiumTemplateId[]): LPPremiumTemplateId {
  const pool = allowedIds || (Object.keys(LP_PREMIUM_TEMPLATES) as LPPremiumTemplateId[]);
  return pool[seed % pool.length];
}