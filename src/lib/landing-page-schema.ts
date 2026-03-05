// =============================================
// AI LANDING PAGE V7 — Schema Types + Zod Validation
// Schema-first architecture: IA generates structured JSON,
// system renders with React components
// =============================================

import { z } from 'zod';

// ========== COLOR SCHEME ==========

export interface LPColorScheme {
  bg: string;
  bgAlt: string;
  text: string;
  textMuted: string;
  accent: string;
  ctaBg: string;
  ctaText: string;
  cardBg: string;
  cardBorder: string;
  priceCurrent: string;
  priceOld: string;
  badgeBg: string;
  badgeText: string;
  shadow: string;
  divider: string;
  fontDisplay: string;
  fontBody: string;
  fontImportUrl: string;
}

// ========== SECTION TYPES & PROPS ==========

export type LPSectionType =
  | 'hero'
  | 'benefits'
  | 'testimonials'
  | 'social_proof'
  | 'pricing'
  | 'faq'
  | 'guarantee'
  | 'cta_final';

// -- Hero --
export interface LPHeroProps {
  badge: string;
  title: string;
  subtitle: string;
  benefits: string[];
  ctaText: string;
  ctaUrl: string;
  productImageUrl: string;
  backgroundImageUrl?: string;
  priceDisplay?: string; // e.g. "De R$ 199,90 por R$ 149,90"
}

// -- Benefits --
export interface LPBenefitItem {
  label: string;
  title: string;
  description: string;
  imageUrl: string;
}

export interface LPBenefitsProps {
  items: LPBenefitItem[];
}

// -- Testimonials --
export interface LPTestimonialItem {
  name: string;
  rating: number;
  comment: string;
}

export interface LPTestimonialsProps {
  badge: string;
  title: string;
  subtitle: string;
  items: LPTestimonialItem[];
}

// -- Social Proof --
export interface LPSocialProofProps {
  badge: string;
  title: string;
  imageUrls: string[];
}

// -- Pricing --
export interface LPPricingCard {
  name: string;
  imageUrl: string;
  price: number;
  compareAtPrice?: number | null;
  discountPercent?: number | null;
  installments?: string;
  ctaText: string;
  ctaUrl: string;
  isFeatured: boolean;
  featuredBadge?: string;
}

export interface LPPricingProps {
  badge: string;
  title: string;
  subtitle: string;
  cards: LPPricingCard[];
}

// -- FAQ --
export interface LPFaqItem {
  question: string;
  answer: string;
}

export interface LPFaqProps {
  badge: string;
  title: string;
  items: LPFaqItem[];
}

// -- Guarantee --
export interface LPGuaranteeProps {
  title: string;
  description: string;
  badges: string[];
}

// -- CTA Final --
export interface LPCtaFinalProps {
  title: string;
  description: string;
  productImageUrl: string;
  priceDisplay?: string;
  ctaText: string;
  ctaUrl: string;
}

// ========== SECTION UNION ==========

export type LPSectionPropsMap = {
  hero: LPHeroProps;
  benefits: LPBenefitsProps;
  testimonials: LPTestimonialsProps;
  social_proof: LPSocialProofProps;
  pricing: LPPricingProps;
  faq: LPFaqProps;
  guarantee: LPGuaranteeProps;
  cta_final: LPCtaFinalProps;
};

export interface LPSection<T extends LPSectionType = LPSectionType> {
  id: string;
  type: T;
  variant?: string;
  props: LPSectionPropsMap[T];
}

// ========== MAIN SCHEMA ==========

export type LPVisualStyle = 'premium' | 'comercial' | 'minimalista' | 'direto';

export interface LPSchema {
  version: '7.0';
  visualStyle: LPVisualStyle;
  colorScheme: LPColorScheme;
  showHeader: boolean;
  showFooter: boolean;
  sections: LPSection[];
}

// ========== VISUAL STYLE PRESETS ==========
// Derived from V6 getColorScheme — same presets, now as data

export const LP_COLOR_PRESETS: Record<LPVisualStyle, (primaryColor: string) => LPColorScheme> = {
  premium: () => ({
    bg: '#0a0a0a',
    bgAlt: '#111111',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.7)',
    accent: '#c9a96e',
    ctaBg: '#c9a96e',
    ctaText: '#0a0a0a',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    priceCurrent: '#c9a96e',
    priceOld: 'rgba(255,255,255,0.4)',
    badgeBg: 'rgba(201,169,110,0.15)',
    badgeText: '#c9a96e',
    shadow: 'rgba(0,0,0,0.5)',
    divider: 'rgba(255,255,255,0.06)',
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap',
  }),
  comercial: (primaryColor) => ({
    bg: '#ffffff',
    bgAlt: '#f8f9fa',
    text: '#111827',
    textMuted: '#6b7280',
    accent: primaryColor || '#ef4444',
    ctaBg: primaryColor || '#ef4444',
    ctaText: '#ffffff',
    cardBg: '#ffffff',
    cardBorder: '#e5e7eb',
    priceCurrent: '#16a34a',
    priceOld: '#9ca3af',
    badgeBg: '#fef2f2',
    badgeText: '#dc2626',
    shadow: 'rgba(0,0,0,0.1)',
    divider: '#f3f4f6',
    fontDisplay: "'Montserrat', -apple-system, sans-serif",
    fontBody: "'Open Sans', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;500;600&display=swap',
  }),
  minimalista: (primaryColor) => ({
    bg: '#fafafa',
    bgAlt: '#ffffff',
    text: '#1a1a1a',
    textMuted: '#666666',
    accent: primaryColor || '#1a1a1a',
    ctaBg: '#1a1a1a',
    ctaText: '#ffffff',
    cardBg: '#ffffff',
    cardBorder: '#e5e7eb',
    priceCurrent: '#1a1a1a',
    priceOld: '#bbbbbb',
    badgeBg: '#f5f5f5',
    badgeText: '#333333',
    shadow: 'rgba(0,0,0,0.06)',
    divider: '#eeeeee',
    fontDisplay: "'Sora', -apple-system, sans-serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
  }),
  direto: (primaryColor) => ({
    bg: '#ffffff',
    bgAlt: '#f9fafb',
    text: '#111827',
    textMuted: '#4b5563',
    accent: primaryColor || '#2563eb',
    ctaBg: primaryColor || '#2563eb',
    ctaText: '#ffffff',
    cardBg: '#ffffff',
    cardBorder: '#e5e7eb',
    priceCurrent: '#16a34a',
    priceOld: '#9ca3af',
    badgeBg: `${primaryColor || '#2563eb'}15`,
    badgeText: primaryColor || '#2563eb',
    shadow: 'rgba(0,0,0,0.08)',
    divider: '#f3f4f6',
    fontDisplay: "'Inter', -apple-system, sans-serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  }),
};

// ========== ZOD VALIDATORS ==========

const zLPHeroProps = z.object({
  badge: z.string().max(100),
  title: z.string().min(3).max(200),
  subtitle: z.string().max(500),
  benefits: z.array(z.string().max(200)).min(1).max(6),
  ctaText: z.string().max(25),
  ctaUrl: z.string().max(200),
  productImageUrl: z.string(),
  backgroundImageUrl: z.string().optional(),
  priceDisplay: z.string().max(100).optional(),
});

const zLPBenefitsProps = z.object({
  items: z.array(z.object({
    label: z.string().max(50),
    title: z.string().max(150),
    description: z.string().max(300),
    imageUrl: z.string(),
  })).min(1).max(6),
});

const zLPTestimonialsProps = z.object({
  badge: z.string().max(50),
  title: z.string().max(150),
  subtitle: z.string().max(200),
  items: z.array(z.object({
    name: z.string().max(100),
    rating: z.number().min(1).max(5),
    comment: z.string().max(500),
  })).min(1).max(10),
});

const zLPSocialProofProps = z.object({
  badge: z.string().max(50),
  title: z.string().max(150),
  imageUrls: z.array(z.string()).min(1).max(8),
});

const zLPPricingProps = z.object({
  badge: z.string().max(50),
  title: z.string().max(150),
  subtitle: z.string().max(200),
  cards: z.array(z.object({
    name: z.string().max(150),
    imageUrl: z.string(),
    price: z.number().min(0),
    compareAtPrice: z.number().nullable().optional(),
    discountPercent: z.number().nullable().optional(),
    installments: z.string().max(100).optional(),
    ctaText: z.string().max(25),
    ctaUrl: z.string().max(300),
    isFeatured: z.boolean(),
    featuredBadge: z.string().max(50).optional(),
  })).min(1).max(6),
});

const zLPFaqProps = z.object({
  badge: z.string().max(50),
  title: z.string().max(150),
  items: z.array(z.object({
    question: z.string().max(300),
    answer: z.string().max(1000),
  })).min(1).max(10),
});

const zLPGuaranteeProps = z.object({
  title: z.string().max(150),
  description: z.string().max(500),
  badges: z.array(z.string().max(50)).min(1).max(6),
});

const zLPCtaFinalProps = z.object({
  title: z.string().max(150),
  description: z.string().max(300),
  productImageUrl: z.string(),
  priceDisplay: z.string().max(100).optional(),
  ctaText: z.string().max(25),
  ctaUrl: z.string().max(200),
});

// Section validator with discriminated union
const zLPSection = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('hero'), variant: z.string().optional(), props: zLPHeroProps }),
  z.object({ id: z.string(), type: z.literal('benefits'), variant: z.string().optional(), props: zLPBenefitsProps }),
  z.object({ id: z.string(), type: z.literal('testimonials'), variant: z.string().optional(), props: zLPTestimonialsProps }),
  z.object({ id: z.string(), type: z.literal('social_proof'), variant: z.string().optional(), props: zLPSocialProofProps }),
  z.object({ id: z.string(), type: z.literal('pricing'), variant: z.string().optional(), props: zLPPricingProps }),
  z.object({ id: z.string(), type: z.literal('faq'), variant: z.string().optional(), props: zLPFaqProps }),
  z.object({ id: z.string(), type: z.literal('guarantee'), variant: z.string().optional(), props: zLPGuaranteeProps }),
  z.object({ id: z.string(), type: z.literal('cta_final'), variant: z.string().optional(), props: zLPCtaFinalProps }),
]);

const zLPColorScheme = z.object({
  bg: z.string(),
  bgAlt: z.string(),
  text: z.string(),
  textMuted: z.string(),
  accent: z.string(),
  ctaBg: z.string(),
  ctaText: z.string(),
  cardBg: z.string(),
  cardBorder: z.string(),
  priceCurrent: z.string(),
  priceOld: z.string(),
  badgeBg: z.string(),
  badgeText: z.string(),
  shadow: z.string(),
  divider: z.string(),
  fontDisplay: z.string(),
  fontBody: z.string(),
  fontImportUrl: z.string(),
});

export const zLPSchema = z.object({
  version: z.literal('7.0'),
  visualStyle: z.enum(['premium', 'comercial', 'minimalista', 'direto']),
  colorScheme: zLPColorScheme,
  showHeader: z.boolean(),
  showFooter: z.boolean(),
  sections: z.array(zLPSection).min(2).max(12),
});

/**
 * Validate an LP schema. Returns the parsed schema or throws.
 */
export function validateLPSchema(data: unknown): LPSchema {
  return zLPSchema.parse(data) as LPSchema;
}

/**
 * Safe validation that returns errors instead of throwing.
 */
export function safeParseLPSchema(data: unknown) {
  return zLPSchema.safeParse(data);
}

// ========== UTILITY: Format price ==========

export function formatPriceBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function formatInstallments(price: number, n = 12): string {
  const inst = price / n;
  return `${n}x de R$ ${inst.toFixed(2).replace('.', ',')}`;
}
