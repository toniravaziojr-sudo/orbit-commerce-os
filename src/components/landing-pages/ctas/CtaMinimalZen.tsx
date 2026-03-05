// =============================================
// CTA FINAL: Minimal Zen
// =============================================

import type { LPCtaFinalProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';
import { ProductPackshot } from '../heroes/shared/ProductPackshot';

interface Props { data: LPCtaFinalProps; }

export function CtaMinimalZen({ data }: Props) {
  const ref = useLPScrollReveal();

  return (
    <section ref={ref} className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)` }}>
      <div className="relative flex flex-col items-center text-center px-[5%] py-24 md:py-32 max-w-[700px] mx-auto lp-reveal">
        {data.productImageUrl && (
          <div className="lp-scale-in mb-12">
            <ProductPackshot src={data.productImageUrl} maxW="clamp(140px, 16vw, 200px)" maxH="clamp(180px, 26vh, 280px)" />
          </div>
        )}
        <h2 className="lp-reveal lp-reveal-delay-1 font-light leading-[1.1] mb-6" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.5rem, 2.5vw, 2.2rem)', color: 'var(--lp-text)' }}>
          {data.title}
        </h2>
        <p className="lp-reveal lp-reveal-delay-2 mb-10 max-w-[480px]" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', fontSize: '0.95rem', lineHeight: '1.8', fontWeight: 300 }}>
          {data.description}
        </p>
        {data.priceDisplay && <div className="lp-reveal lp-reveal-delay-2 mb-8 text-xs" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
        <a href={data.ctaUrl} className="lp-reveal lp-reveal-delay-3 group inline-flex items-center justify-center gap-3 px-10 py-4 rounded-full text-sm font-medium tracking-[0.1em] transition-all duration-500 hover:-translate-y-1" style={{
          background: 'var(--lp-text)', color: 'var(--lp-bg)', boxShadow: '0 8px 30px var(--lp-shadow)', minWidth: '220px',
        }}>
          {data.ctaText}
          <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </a>
      </div>
    </section>
  );
}
