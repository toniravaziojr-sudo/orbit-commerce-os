// =============================================
// LP TEMPLATE TOKENS — V9.0
// Design tokens per template for CSS variable injection
// Consumed by LPSchemaRenderer and mid-sections
// =============================================

import type { LPPremiumTemplateId } from './landing-page-templates-registry';

export interface LPDesignTokens {
  /** Border radius for cards: e.g. '16px', '24px', '0px' */
  radius: string;
  /** Card style: 'glass' | 'solid' | 'outline' | 'elevated' */
  cardStyle: 'glass' | 'solid' | 'outline' | 'elevated';
  /** Shadow intensity: 'none' | 'subtle' | 'medium' | 'dramatic' */
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'dramatic';
  /** Vertical section spacing */
  sectionPaddingY: string;
  /** Accent glow intensity (0-1) */
  accentGlow: number;
  /** Overlay style for scenes */
  overlayType: 'gradient' | 'vignette' | 'solid' | 'none';
  /** Divider style */
  dividerStyle: 'line' | 'gradient' | 'none';
}

const SHADOW_MAP: Record<LPDesignTokens['shadowIntensity'], string> = {
  none: '0 0 0 transparent',
  subtle: '0 4px 20px rgba(0,0,0,0.08)',
  medium: '0 8px 40px rgba(0,0,0,0.15)',
  dramatic: '0 16px 60px rgba(0,0,0,0.3), 0 0 80px rgba(201,169,110,0.08)',
};

export const LP_TEMPLATE_TOKENS: Record<LPPremiumTemplateId, LPDesignTokens> = {
  luxury_editorial: {
    radius: '20px',
    cardStyle: 'glass',
    shadowIntensity: 'dramatic',
    sectionPaddingY: 'clamp(80px, 10vw, 120px)',
    accentGlow: 0.08,
    overlayType: 'gradient',
    dividerStyle: 'gradient',
  },
  bold_impact: {
    radius: '12px',
    cardStyle: 'solid',
    shadowIntensity: 'medium',
    sectionPaddingY: 'clamp(64px, 8vw, 100px)',
    accentGlow: 0.12,
    overlayType: 'vignette',
    dividerStyle: 'line',
  },
  minimal_zen: {
    radius: '8px',
    cardStyle: 'outline',
    shadowIntensity: 'subtle',
    sectionPaddingY: 'clamp(80px, 12vw, 140px)',
    accentGlow: 0.03,
    overlayType: 'none',
    dividerStyle: 'none',
  },
  organic_nature: {
    radius: '28px',
    cardStyle: 'elevated',
    shadowIntensity: 'medium',
    sectionPaddingY: 'clamp(72px, 9vw, 110px)',
    accentGlow: 0.06,
    overlayType: 'gradient',
    dividerStyle: 'gradient',
  },
  corporate_trust: {
    radius: '12px',
    cardStyle: 'solid',
    shadowIntensity: 'subtle',
    sectionPaddingY: 'clamp(64px, 8vw, 96px)',
    accentGlow: 0.04,
    overlayType: 'solid',
    dividerStyle: 'line',
  },
  neon_energy: {
    radius: '16px',
    cardStyle: 'glass',
    shadowIntensity: 'dramatic',
    sectionPaddingY: 'clamp(72px, 9vw, 110px)',
    accentGlow: 0.2,
    overlayType: 'vignette',
    dividerStyle: 'gradient',
  },
  warm_artisan: {
    radius: '20px',
    cardStyle: 'elevated',
    shadowIntensity: 'medium',
    sectionPaddingY: 'clamp(80px, 10vw, 120px)',
    accentGlow: 0.05,
    overlayType: 'gradient',
    dividerStyle: 'gradient',
  },
  tech_gradient: {
    radius: '24px',
    cardStyle: 'glass',
    shadowIntensity: 'dramatic',
    sectionPaddingY: 'clamp(72px, 9vw, 110px)',
    accentGlow: 0.15,
    overlayType: 'gradient',
    dividerStyle: 'gradient',
  },
  classic_elegant: {
    radius: '4px',
    cardStyle: 'outline',
    shadowIntensity: 'subtle',
    sectionPaddingY: 'clamp(88px, 11vw, 130px)',
    accentGlow: 0.04,
    overlayType: 'gradient',
    dividerStyle: 'line',
  },
  urban_street: {
    radius: '0px',
    cardStyle: 'solid',
    shadowIntensity: 'medium',
    sectionPaddingY: 'clamp(60px, 8vw, 96px)',
    accentGlow: 0.1,
    overlayType: 'vignette',
    dividerStyle: 'none',
  },
};

/**
 * Build CSS variables from design tokens for injection into the LP root container
 */
export function buildTokenCssVariables(templateId?: string): React.CSSProperties {
  const tokens = templateId && templateId in LP_TEMPLATE_TOKENS
    ? LP_TEMPLATE_TOKENS[templateId as LPPremiumTemplateId]
    : LP_TEMPLATE_TOKENS.luxury_editorial;

  return {
    '--lp-radius': tokens.radius,
    '--lp-card-style': tokens.cardStyle,
    '--lp-shadow-card': SHADOW_MAP[tokens.shadowIntensity],
    '--lp-section-py': tokens.sectionPaddingY,
    '--lp-glow-intensity': String(tokens.accentGlow),
    '--lp-divider-style': tokens.dividerStyle,
  } as React.CSSProperties;
}

export function getTemplateTokens(templateId?: string): LPDesignTokens {
  if (templateId && templateId in LP_TEMPLATE_TOKENS) {
    return LP_TEMPLATE_TOKENS[templateId as LPPremiumTemplateId];
  }
  return LP_TEMPLATE_TOKENS.luxury_editorial;
}