// =============================================
// LP SCHEMA RENDERER — V9.0
// Routes Hero/CTA to premium template components
// Falls back to generic blocks for backward compat
// =============================================

import { useMemo } from 'react';
import type { LPSchema, LPSection, LPSectionType, LPColorScheme } from '@/lib/landing-page-schema';
import { sanitizeLPSectionProps } from '@/lib/sanitizeLPCopy';
import { normalizeAllCTAs } from '@/lib/normalizeLPCta';
import { buildTokenCssVariables } from '@/lib/landing-page-template-tokens';
import { LPHero } from './blocks/LPHero';
import { LPBenefits } from './blocks/LPBenefits';
import { LPTestimonials } from './blocks/LPTestimonials';
import { LPSocialProof } from './blocks/LPSocialProof';
import { LPPricing } from './blocks/LPPricing';
import { LPFaq } from './blocks/LPFaq';
import { LPGuarantee } from './blocks/LPGuarantee';
import { LPCtaFinal } from './blocks/LPCtaFinal';
// Premium Heroes
import { HeroLuxuryEditorial } from './heroes/HeroLuxuryEditorial';
import { HeroBoldImpact } from './heroes/HeroBoldImpact';
import { HeroMinimalZen } from './heroes/HeroMinimalZen';
import { HeroOrganicNature } from './heroes/HeroOrganicNature';
import { HeroCorporateTrust } from './heroes/HeroCorporateTrust';
import { HeroNeonEnergy } from './heroes/HeroNeonEnergy';
import { HeroWarmArtisan } from './heroes/HeroWarmArtisan';
import { HeroTechGradient } from './heroes/HeroTechGradient';
import { HeroClassicElegant } from './heroes/HeroClassicElegant';
import { HeroUrbanStreet } from './heroes/HeroUrbanStreet';
// Premium CTAs
import { CtaLuxuryEditorial } from './ctas/CtaLuxuryEditorial';
import { CtaBoldImpact } from './ctas/CtaBoldImpact';
import { CtaMinimalZen } from './ctas/CtaMinimalZen';
import { CtaOrganicNature, CtaCorporateTrust, CtaNeonEnergy, CtaWarmArtisan, CtaTechGradient, CtaClassicElegant, CtaUrbanStreet } from './ctas/CtaTemplates';
import '@/styles/lp-container-queries.css';
import '@/styles/lp-animations.css';

interface LPSchemaRendererProps {
  schema: LPSchema;
}

const PREMIUM_HEROES: Record<string, React.FC<{ data: any }>> = {
  luxury_editorial: HeroLuxuryEditorial,
  bold_impact: HeroBoldImpact,
  minimal_zen: HeroMinimalZen,
  organic_nature: HeroOrganicNature,
  corporate_trust: HeroCorporateTrust,
  neon_energy: HeroNeonEnergy,
  warm_artisan: HeroWarmArtisan,
  tech_gradient: HeroTechGradient,
  classic_elegant: HeroClassicElegant,
  urban_street: HeroUrbanStreet,
};

const PREMIUM_CTAS: Record<string, React.FC<{ data: any }>> = {
  luxury_editorial: CtaLuxuryEditorial,
  bold_impact: CtaBoldImpact,
  minimal_zen: CtaMinimalZen,
  organic_nature: CtaOrganicNature,
  corporate_trust: CtaCorporateTrust,
  neon_energy: CtaNeonEnergy,
  warm_artisan: CtaWarmArtisan,
  tech_gradient: CtaTechGradient,
  classic_elegant: CtaClassicElegant,
  urban_street: CtaUrbanStreet,
};

function renderSection(section: LPSection, premiumTemplateId?: string) {
  const { id, type, variant } = section;
  const cleanProps = sanitizeLPSectionProps(section.props);

  // Route Hero/CTA to premium template if available
  if (type === 'hero' && premiumTemplateId && PREMIUM_HEROES[premiumTemplateId]) {
    const HeroComp = PREMIUM_HEROES[premiumTemplateId];
    return <HeroComp key={id} data={cleanProps} />;
  }
  if (type === 'cta_final' && premiumTemplateId && PREMIUM_CTAS[premiumTemplateId]) {
    const CtaComp = PREMIUM_CTAS[premiumTemplateId];
    return <CtaComp key={id} data={cleanProps} />;
  }

  // Fallback to generic blocks (backward compat)
  switch (type) {
    case 'hero':
      return <LPHero key={id} data={cleanProps} variant={variant} />;
    case 'benefits':
      return <LPBenefits key={id} data={cleanProps} variant={variant} />;
    case 'testimonials':
      return <LPTestimonials key={id} data={cleanProps} variant={variant} />;
    case 'social_proof':
      return <LPSocialProof key={id} data={cleanProps} />;
    case 'pricing':
      return <LPPricing key={id} data={cleanProps} variant={variant} />;
    case 'faq':
      return <LPFaq key={id} data={cleanProps} />;
    case 'guarantee':
      return <LPGuarantee key={id} data={cleanProps} />;
    case 'cta_final':
      return <LPCtaFinal key={id} data={cleanProps} />;
    default:
      return null;
  }
}

function buildCssVariables(cs: LPColorScheme): React.CSSProperties {
  return {
    '--lp-bg': cs.bg,
    '--lp-bg-alt': cs.bgAlt,
    '--lp-text': cs.text,
    '--lp-text-muted': cs.textMuted,
    '--lp-accent': cs.accent,
    '--lp-cta-bg': cs.ctaBg,
    '--lp-cta-text': cs.ctaText,
    '--lp-card-bg': cs.cardBg,
    '--lp-card-border': cs.cardBorder,
    '--lp-price-current': cs.priceCurrent,
    '--lp-price-old': cs.priceOld,
    '--lp-badge-bg': cs.badgeBg,
    '--lp-badge-text': cs.badgeText,
    '--lp-shadow': cs.shadow,
    '--lp-divider': cs.divider,
    '--lp-font-display': cs.fontDisplay,
    '--lp-font-body': cs.fontBody,
  } as React.CSSProperties;
}

export function LPSchemaRenderer({ schema }: LPSchemaRendererProps) {
  const premiumTemplateId = schema.premiumTemplateId;
  const cssVars = useMemo(() => buildCssVariables(schema.colorScheme), [schema.colorScheme]);
  const tokenVars = useMemo(() => buildTokenCssVariables(premiumTemplateId), [premiumTemplateId]);

  return (
    <>
      <link rel="stylesheet" href={schema.colorScheme.fontImportUrl} />
      <div
        className="w-full min-h-screen"
        style={{
          ...cssVars,
          ...tokenVars,
          backgroundColor: schema.colorScheme.bg,
          fontFamily: schema.colorScheme.fontBody,
          color: schema.colorScheme.text,
          margin: 0,
          padding: 0,
          containerType: 'inline-size',
          containerName: 'lp-root',
        }}
      >
        {normalizeAllCTAs(schema.sections).map((section) => renderSection(section as LPSection, premiumTemplateId))}
      </div>
    </>
  );
}