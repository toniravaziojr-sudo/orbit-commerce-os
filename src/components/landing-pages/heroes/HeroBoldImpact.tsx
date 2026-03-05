// =============================================
// HERO: Bold Impact
// Bebas Neue enorme, diagonal cortada,
// produto com drop-shadow colorido, alta energia
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroBoldImpact({ data }: Props) {
  const hasScene = !!data.heroSceneDesktopUrl;

  return (
    <section className="relative overflow-hidden lp-noise" style={{ minHeight: '100vh' }}>
      {hasScene && (
        <>
          <div className="absolute inset-0" style={{ backgroundImage: `url('${data.heroSceneDesktopUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, var(--lp-bg, #070A10)ee 0%, var(--lp-bg, #070A10)88 100%)` }} />
        </>
      )}

      {/* Diagonal cut background */}
      {!hasScene && (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }} />
          {/* Diagonal slice */}
          <div className="absolute top-0 right-0 w-[55%] h-full" style={{
            background: `linear-gradient(135deg, var(--lp-accent) 0%, var(--lp-cta-bg) 100%)`,
            clipPath: 'polygon(25% 0, 100% 0, 100% 100%, 0% 100%)',
            opacity: 0.07,
          }} />
          {/* Accent glow */}
          <div className="absolute top-1/2 right-[20%] -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`, opacity: 0.1, filter: 'blur(80px)' }} />
        </>
      )}

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-12 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        {/* Text — BOLD */}
        <div className="max-w-[600px] z-10">
          <div className="lp-hero-title-enter">
            <span className="inline-flex items-center gap-2 px-6 py-3 text-[12px] font-black uppercase tracking-[0.2em] mb-6" style={{
              background: 'var(--lp-accent)',
              color: 'var(--lp-cta-text)',
              clipPath: 'polygon(0 0, 100% 0, 96% 100%, 4% 100%)',
            }}>
              {data.badge}
            </span>
          </div>

          <h1 className="lp-hero-title-enter font-black leading-[0.88] mb-6 uppercase" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(3.5rem, 7vw, 6.5rem)',
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
            letterSpacing: '0.02em',
          }}>
            {data.title}
          </h1>

          <p className="lp-hero-title-enter max-w-[500px] mb-8 text-lg font-medium" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-body)',
            lineHeight: '1.6',
            animationDelay: '0.3s',
          }}>
            {data.subtitle}
          </p>

          {/* Benefits as power chips */}
          <div className="lp-hero-title-enter flex flex-wrap gap-2 mb-10" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <span key={i} className="px-4 py-2 text-xs font-bold uppercase tracking-wider" style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--lp-text)',
                border: '2px solid var(--lp-accent)',
                clipPath: 'polygon(4% 0, 100% 0, 96% 100%, 0% 100%)',
              }}>
                {b}
              </span>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-6 text-lg font-black uppercase tracking-[0.15em] transition-all duration-500 hover:-translate-y-2 hover:scale-105" style={{
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 16px 50px var(--lp-shadow), 0 0 0 3px var(--lp-accent)',
              clipPath: 'polygon(2% 0, 100% 0, 98% 100%, 0% 100%)',
              minWidth: '320px',
            }}>
              {data.ctaText}
              <svg className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            {data.priceDisplay && (
              <p className="mt-4 text-sm font-bold" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        {/* Product — with colorful shadow */}
        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.15} />}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `var(--lp-accent)` }} />
    </section>
  );
}
