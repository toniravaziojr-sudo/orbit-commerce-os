// =============================================
// HERO: Organic Nature
// Formas orgânicas, border-radius irregulares,
// tons terrosos, composição natural fluida
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroOrganicNature({ data }: Props) {
  const hasScene = !!data.heroSceneDesktopUrl;

  return (
    <section className="relative overflow-hidden" style={{
      minHeight: '100vh',
      ...(hasScene ? {
        backgroundImage: `url('${data.heroSceneDesktopUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : {
        background: `linear-gradient(160deg, var(--lp-bg) 0%, var(--lp-bg-alt) 60%, var(--lp-bg) 100%)`,
      }),
    }}>
      {hasScene && (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, var(--lp-bg)f5 0%, var(--lp-bg)cc 50%, var(--lp-bg)88 100%)` }} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 40%, var(--lp-bg)dd 100%)` }} />
        </>
      )}

      {/* Organic blob shapes */}
      {!hasScene && (
        <>
          <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] pointer-events-none" style={{
            background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`,
            opacity: 0.06,
            filter: 'blur(80px)',
            borderRadius: '62% 38% 46% 54% / 56% 62% 38% 44%',
          }} />
          <div className="absolute bottom-[15%] left-[10%] w-[350px] h-[350px] pointer-events-none" style={{
            background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`,
            opacity: 0.04,
            filter: 'blur(60px)',
            borderRadius: '44% 56% 62% 38% / 38% 46% 54% 62%',
          }} />
        </>
      )}

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-10 md:gap-16 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        {/* Text — warm serif */}
        <div className={`max-w-[560px] z-10 ${hasScene ? 'lp-text-legible' : ''}`}>
          <div className="lp-hero-title-enter mb-8">
            <span className="inline-flex items-center gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{
              color: 'var(--lp-accent)',
              border: '1.5px solid var(--lp-accent)',
              borderRadius: '50px 10px 50px 10px',
              opacity: 0.9,
            }}>
              🌿 {data.badge}
            </span>
          </div>

          <h1 className="lp-hero-title-enter font-semibold leading-[1.05] mb-7" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(2.8rem, 5vw, 4.2rem)',
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
            letterSpacing: '-0.01em',
          }}>
            {data.title}
          </h1>

          <p className="lp-hero-title-enter max-w-[480px] mb-10" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-body)',
            fontSize: 'clamp(1rem, 1.2vw, 1.15rem)',
            lineHeight: '1.75',
            animationDelay: '0.3s',
          }}>
            {data.subtitle}
          </p>

          {/* Benefits with organic shapes */}
          <div className="lp-hero-title-enter grid grid-cols-2 gap-3 mb-10" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-3 text-[13px]" style={{
                color: 'var(--lp-text-muted)',
                fontFamily: 'var(--lp-font-body)',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: i % 2 === 0 ? '20px 8px 20px 8px' : '8px 20px 8px 20px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--lp-accent)' }} />
                {b}
              </div>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-12 py-5 text-base font-semibold tracking-[0.08em] transition-all duration-500 hover:-translate-y-1.5" style={{
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              borderRadius: '50px 16px 50px 16px',
              boxShadow: '0 12px 40px var(--lp-shadow)',
              minWidth: '280px',
            }}>
              {data.ctaText}
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            {data.priceDisplay && (
              <p className="mt-5 text-sm" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        {/* Product */}
        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} />}
        </div>
      </div>
    </section>
  );
}
