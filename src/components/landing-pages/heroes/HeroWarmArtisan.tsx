// =============================================
// HERO: Warm Artisan
// Textura de papel, tipografia serif elegante,
// tons quentes, composição artesanal
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroWarmArtisan({ data }: Props) {
  return (
    <section className="relative overflow-hidden" style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)`,
    }}>
      {/* Paper texture overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px',
        opacity: 0.03,
      }} />

      {/* Warm radial glow */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none" style={{
        background: `radial-gradient(ellipse, var(--lp-accent) 0%, transparent 60%)`,
        opacity: 0.05,
        filter: 'blur(100px)',
      }} />

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-10 md:gap-20 px-[5%] py-28 md:py-0 max-w-[1100px] mx-auto" style={{ minHeight: '100vh' }}>
        
        <div className="max-w-[520px] z-10">
          {/* Ornamental mark */}
          <div className="lp-hero-title-enter mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-px" style={{ background: 'var(--lp-accent)', opacity: 0.5 }} />
              <span className="text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: 'var(--lp-accent)', fontFamily: 'var(--lp-font-body)' }}>
                {data.badge}
              </span>
              <div className="w-8 h-px" style={{ background: 'var(--lp-accent)', opacity: 0.5 }} />
            </div>
          </div>

          <h1 className="lp-hero-title-enter leading-[1.05] mb-7" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(2.5rem, 4.5vw, 3.8rem)',
            fontWeight: 500,
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
            letterSpacing: '0.01em',
          }}>
            {data.title}
          </h1>

          {/* Italic subtitle */}
          <p className="lp-hero-title-enter max-w-[440px] mb-10" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(1rem, 1.2vw, 1.15rem)',
            lineHeight: '1.8',
            animationDelay: '0.3s',
          }}>
            {data.subtitle}
          </p>

          {/* Benefits with warm styling */}
          <div className="lp-hero-title-enter space-y-2 mb-12" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--lp-accent)' }}>✦</span>
                <span className="text-sm" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}>{b}</span>
              </div>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-12 py-5 rounded-full text-sm font-semibold tracking-[0.1em] transition-all duration-500 hover:-translate-y-1.5" style={{
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 12px 40px var(--lp-shadow)',
              minWidth: '260px',
            }}>
              {data.ctaText}
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            {data.priceDisplay && (
              <p className="mt-5 text-sm" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} />}
        </div>
      </div>

      {/* Ornamental bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="w-12 h-px" style={{ background: 'var(--lp-divider)' }} />
        <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--lp-text-muted)', opacity: 0.4 }}>•</span>
        <div className="w-12 h-px" style={{ background: 'var(--lp-divider)' }} />
      </div>
    </section>
  );
}