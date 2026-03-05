// =============================================
// LP SCHEMA RENDERER — V7.2
// Renders LPSchema using real React components
// Uses --lp-* CSS variables for theming
// Sanitizes AI copy (strips markdown)
// Container queries for responsive builder preview
// =============================================

import { useMemo } from 'react';
import type { LPSchema, LPSection, LPSectionType, LPColorScheme } from '@/lib/landing-page-schema';
import { sanitizeLPSectionProps } from '@/lib/sanitizeLPCopy';
import { LPHero } from './blocks/LPHero';
import { LPBenefits } from './blocks/LPBenefits';
import { LPTestimonials } from './blocks/LPTestimonials';
import { LPSocialProof } from './blocks/LPSocialProof';
import { LPPricing } from './blocks/LPPricing';
import { LPFaq } from './blocks/LPFaq';
import { LPGuarantee } from './blocks/LPGuarantee';
import { LPCtaFinal } from './blocks/LPCtaFinal';
import '@/styles/lp-container-queries.css';

interface LPSchemaRendererProps {
  schema: LPSchema;
}

function renderSection(section: LPSection) {
  const { id, type } = section;
  const cleanProps = sanitizeLPSectionProps(section.props);
  switch (type) {
    case 'hero':
      return <LPHero key={id} data={cleanProps} />;
    case 'benefits':
      return <LPBenefits key={id} data={cleanProps} />;
    case 'testimonials':
      return <LPTestimonials key={id} data={cleanProps} />;
    case 'social_proof':
      return <LPSocialProof key={id} data={cleanProps} />;
    case 'pricing':
      return <LPPricing key={id} data={cleanProps} />;
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
  const cssVars = useMemo(() => buildCssVariables(schema.colorScheme), [schema.colorScheme]);

  return (
    <>
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
          containerType: 'inline-size',
          containerName: 'lp-root',
        }}
      >
        {schema.sections.map((section) => renderSection(section as LPSection))}
      </div>
    </>
  );
}
