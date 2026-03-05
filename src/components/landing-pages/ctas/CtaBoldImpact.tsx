// =============================================
// CTA FINAL: Bold Impact
// =============================================

import type { LPCtaFinalProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';
import { ProductPackshot } from '../heroes/shared/ProductPackshot';

interface Props { data: LPCtaFinalProps; }

export function CtaBoldImpact({ data }: Props) {
  const ref = useLPScrollReveal();

  return (
    <section ref={ref} className="relative overflow-hidden lp-noise" style={{ background: `linear-gradient(135deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }}>
      <div className="absolute top-0 right-0 w-[40%] h-full" style={{ background: `var(--lp-accent)`, clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0% 100%)', opacity: 0.06 }} />
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center px-[5%] py-20 md:py-28 max-w-[1200px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <h2 className="font-black leading-[0.9] mb-6 uppercase" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: 'var(--lp-text)' }}>
            {data.title}
          </h2>
          <p className="text-base mb-8 max-w-[500px] font-medium" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.6' }}>
            {data.description}
          </p>
          {data.priceDisplay && <div className="mb-8 font-bold" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-6 text-lg font-black uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-2" style={{
            background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 12px 40px var(--lp-shadow), 0 0 0 3px var(--lp-accent)', clipPath: 'polygon(2% 0, 100% 0, 98% 100%, 0% 100%)', minWidth: '320px',
          }}>
            {data.ctaText}
            <svg className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.15} />}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'var(--lp-accent)' }} />
    </section>
  );
}
