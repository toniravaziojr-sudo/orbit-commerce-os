// =============================================
// LP SCHEMA RENDERER — V7
// Renders LPSchema using real React components
// Uses --lp-* CSS variables for theming
// =============================================

import { useMemo } from 'react';
import type { LPSchema, LPSection, LPSectionType, LPColorScheme } from '@/lib/landing-page-schema';
import { LPHero } from './blocks/LPHero';
import { LPBenefits } from './blocks/LPBenefits';
import { LPTestimonials } from './blocks/LPTestimonials';
import { LPSocialProof } from './blocks/LPSocialProof';
import { LPPricing } from './blocks/LPPricing';
import { LPFaq } from './blocks/LPFaq';
import { LPGuarantee } from './blocks/LPGuarantee';
import { LPCtaFinal } from './blocks/LPCtaFinal';

interface LPSchemaRendererProps {
  schema: LPSchema;
}

function renderSection(section: LPSection) {
  const { id, type, props } = section;
  switch (type) {
    case 'hero':
      return <LPHero key={id} data={props as any} />;
    case 'benefits':
      return <LPBenefits key={id} data={props as any} />;
    case 'testimonials':
      return <LPTestimonials key={id} data={props as any} />;
    case 'social_proof':
      return <LPSocialProof key={id} data={props as any} />;
    case 'pricing':
      return <LPPricing key={id} data={props as any} />;
    case 'faq':
      return <LPFaq key={id} data={props as any} />;
    case 'guarantee':
      return <LPGuarantee key={id} data={props as any} />;
    case 'cta_final':
      return <LPCtaFinal key={id} data={props as any} />;
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
  const cssVars = useMemo(() => buildCssVariables(schema.colorScheme), [schema.colorScheme]);

  return (
    <>
      {/* Font loading */}
      <link rel="stylesheet" href={schema.colorScheme.fontImportUrl} />
      <div
        className="w-full min-h-screen"
        style={{
          ...cssVars,
          backgroundColor: schema.colorScheme.bg,
          fontFamily: schema.colorScheme.fontBody,
          color: schema.colorScheme.text,
          margin: 0,
          padding: 0,
        }}
      >
        {schema.sections.map((section) => renderSection(section as LPSection))}
      </div>
    </>
  );
}
