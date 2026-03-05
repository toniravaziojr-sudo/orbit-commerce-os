// =============================================
// HERO: Urban Street
// Fonte bold grotesque, elementos gráficos diagonais,
// alto contraste, agressivo
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroUrbanStreet({ data }: Props) {
  const hasScene = !!data.heroSceneDesktopUrl;

  return (
    <section className="relative overflow-hidden lp-noise" style={{
      minHeight: '100vh',
      ...(hasScene ? {
        backgroundImage: `url('${data.heroSceneDesktopUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : {
        background: 'var(--lp-bg)',
      }),
    }}>
      {hasScene && (
        <>
          <div className="absolute inset-0" style={{ background: `rgba(7,4,16,0.85)` }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, rgba(7,4,16,0.96) 0%, rgba(7,4,16,0.73) 50%, transparent 100%)` }} />
        </>
      )}

      {/* Diagonal stripes */}
      {!hasScene && (
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 80px,
            rgba(255,255,255,0.02) 80px,
            rgba(255,255,255,0.02) 82px
          )`,
        }} />
      )}

      {/* Large accent block */}
      <div className="absolute top-0 right-0 w-[200px] h-[200px] md:w-[300px] md:h-[300px]" style={{
        background: 'var(--lp-accent)',
        clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
        opacity: 0.08,
      }} />

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-6 md:gap-12 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        <div className={`max-w-[600px] z-10 ${hasScene ? 'lp-text-legible' : ''}`}>
          {/* Raw badge */}
          <div className="lp-hero-title-enter">
            <span className="inline-block px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] mb-6" style={{
              background: 'var(--lp-accent)',
              color: 'var(--lp-cta-text)',
              transform: 'skewX(-6deg)',
            }}>
              <span style={{ display: 'inline-block', transform: 'skewX(6deg)' }}>{data.badge}</span>
            </span>
          </div>

          <h1 className="lp-hero-title-enter font-black leading-[0.85] mb-6 uppercase" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(4rem, 8vw, 7rem)',
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
            lineHeight: '0.85',
          }}>
            {data.title}
          </h1>

          {/* Thick accent underline */}
          <div className="lp-hero-title-enter w-24 h-1 mb-6" style={{ background: 'var(--lp-accent)', animationDelay: '0.25s' }} />

          <p className="lp-hero-title-enter max-w-[480px] mb-8 font-medium" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-body)',
            fontSize: 'clamp(1rem, 1.3vw, 1.2rem)',
            lineHeight: '1.6',
            animationDelay: '0.35s',
          }}>
            {data.subtitle}
          </p>

          {/* Benefits as raw tags */}
          <div className="lp-hero-title-enter flex flex-wrap gap-2 mb-10" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <span key={i} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider" style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--lp-text)',
                borderLeft: '3px solid var(--lp-accent)',
              }}>
                {b}
              </span>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 text-base font-black uppercase tracking-[0.1em] transition-all duration-500 hover:-translate-y-2" style={{
              background: `var(--lp-accent)`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 12px 40px var(--lp-shadow)',
              minWidth: '300px',
              transform: 'skewX(-3deg)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', transform: 'skewX(3deg)' }}>
                {data.ctaText}
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </span>
            </a>
            {data.priceDisplay && (
              <p className="mt-4 text-sm font-bold" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.1} />}
        </div>
      </div>

      {/* Bottom thick bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: `var(--lp-accent)` }} />
    </section>
  );
}
