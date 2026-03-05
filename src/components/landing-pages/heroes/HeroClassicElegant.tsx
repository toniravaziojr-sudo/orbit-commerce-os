// =============================================
// HERO: Classic Elegant
// Composição editorial tipo revista, serifada,
// muito espaço, linha decorativa
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroClassicElegant({ data }: Props) {
  return (
    <section className="relative overflow-hidden" style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)`,
    }}>
      {/* Subtle accent glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `var(--lp-accent)`, opacity: 0.15 }} />
      <div className="absolute top-[30%] right-[20%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{
        background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`,
        opacity: 0.04,
        filter: 'blur(100px)',
      }} />

      <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-8 md:gap-0 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        {/* Text — editorial */}
        <div className="max-w-[460px] z-10 md:pr-12">
          <div className="lp-hero-title-enter mb-10">
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em]" style={{ color: 'var(--lp-accent)' }}>
              {data.badge}
            </span>
          </div>

          <h1 className="lp-hero-title-enter leading-[1.0] mb-8" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(2.8rem, 5vw, 4.2rem)',
            fontWeight: 400,
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
            letterSpacing: '-0.01em',
          }}>
            {data.title}
          </h1>

          {/* Decorative line */}
          <div className="lp-hero-title-enter w-16 h-[1px] mb-8" style={{ background: 'var(--lp-accent)', animationDelay: '0.25s' }} />

          <p className="lp-hero-title-enter mb-10" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-body)',
            fontSize: 'clamp(0.95rem, 1.1vw, 1.05rem)',
            lineHeight: '1.85',
            animationDelay: '0.35s',
          }}>
            {data.subtitle}
          </p>

          {/* Benefits as elegant text list */}
          <div className="lp-hero-title-enter space-y-3 mb-12" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <div key={i} className="flex items-baseline gap-3">
                <span className="text-[10px]" style={{ color: 'var(--lp-accent)' }}>◆</span>
                <span className="text-sm" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.6' }}>{b}</span>
              </div>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-10 py-4 text-[13px] font-semibold uppercase tracking-[0.2em] transition-all duration-500 hover:-translate-y-1" style={{
              background: 'transparent',
              color: 'var(--lp-text)',
              border: '1.5px solid var(--lp-text)',
              minWidth: '260px',
            }}>
              {data.ctaText}
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            {data.priceDisplay && (
              <p className="mt-5 text-xs tracking-wide" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        {/* Vertical divider */}
        <div className="hidden md:block w-px self-stretch my-24" style={{ background: `linear-gradient(180deg, transparent, var(--lp-divider), transparent)` }} />

        {/* Product — editorial frame */}
        <div className="flex items-center justify-center md:pl-12 order-first md:order-last">
          {data.productImageUrl && (
            <div className="relative p-8 lp-hero-title-enter" style={{ animationDelay: '0.3s' }}>
              {/* Thin editorial frame */}
              <div className="absolute inset-0" style={{ border: '1px solid var(--lp-divider)' }} />
              <ProductPackshot src={data.productImageUrl} maxW="clamp(220px, 24vw, 340px)" maxH="clamp(280px, 40vh, 440px)" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
