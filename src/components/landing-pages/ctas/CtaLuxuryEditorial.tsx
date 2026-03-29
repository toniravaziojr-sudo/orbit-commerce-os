// =============================================
// CTA FINAL: Luxury Editorial
// =============================================

import type { LPCtaFinalProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';
import { ProductPackshot } from '../heroes/shared/ProductPackshot';

interface Props { data: LPCtaFinalProps; }

export function CtaLuxuryEditorial({ data }: Props) {
  const ref = useLPScrollReveal();
  const hasScene = !!data.ctaSceneDesktopUrl;

  return (
    <section ref={ref} className="relative overflow-hidden lp-noise" style={{
      ...(hasScene ? { backgroundImage: `url('${data.ctaSceneDesktopUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '520px' } : { background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }),
    }}>
      {hasScene && <div className="absolute inset-0" style={{ background: `linear-gradient(to right, rgba(7,4,16,0.94) 0%, rgba(7,4,16,0.80) 40%, transparent 100%)` }} />}
      {!hasScene && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, var(--lp-accent), transparent)`, opacity: 0.2 }} />}
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center px-[5%] py-24 md:py-32 max-w-[1100px] mx-auto lp-reveal">
        <div className="text-center md:text-left lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <div className="hidden md:block w-16 h-[1px] mb-8" style={{ background: `linear-gradient(90deg, var(--lp-accent), transparent)`, opacity: 0.5 }} />
          <h2 className="font-bold leading-[1.05] mb-6" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.75rem)', color: 'var(--lp-text)' }}>
            <span className="lp-gradient-text">{data.title}</span>
          </h2>
          <p className="text-base leading-relaxed mb-8 max-w-[500px]" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-display)', fontStyle: 'italic', lineHeight: '1.8' }}>
            {data.description}
          </p>
          {data.priceDisplay && <div className="mb-8" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 rounded-xl text-sm font-bold uppercase tracking-[0.18em] transition-all duration-500 hover:-translate-y-1.5" style={{
            background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 16px 50px var(--lp-shadow)', minWidth: '280px',
          }}>
            {data.ctaText}
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">
          {data.productImageUrl ? <ProductPackshot src={data.productImageUrl} maxW="clamp(200px, 24vw, 340px)" maxH="clamp(240px, 36vh, 400px)" /> : null}
        </div>
      </div>
    </section>
  );
}