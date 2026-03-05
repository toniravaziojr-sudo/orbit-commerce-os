// =============================================
// HERO: Neon Energy
// Fundo escuro com glows neon, bordas luminosas,
// tipografia condensada, alta intensidade
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroNeonEnergy({ data }: Props) {
  const hasScene = !!data.heroSceneDesktopUrl;

  return (
    <section className="relative overflow-hidden lp-noise" style={{
      minHeight: '100vh',
      background: hasScene ? undefined : `linear-gradient(135deg, #050508 0%, #0a0a12 50%, #05050a 100%)`,
      ...(hasScene ? { backgroundImage: `url('${data.heroSceneDesktopUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
    }}>
      {hasScene && (
        <div className="absolute inset-0" style={{ background: `rgba(5,5,10,0.85)` }} />
      )}

      {/* Neon glow spots */}
      <div className="absolute top-[20%] left-[15%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{
        background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`,
        opacity: 0.15,
        filter: 'blur(80px)',
      }} />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{
        background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`,
        opacity: 0.1,
        filter: 'blur(100px)',
      }} />

      {/* Floating particles */}
      <div className="lp-particles">
        {[1,2,3,4,5,6].map(i => <div key={i} className="lp-particle" />)}
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-16 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        <div className="max-w-[600px] z-10">
          {/* Neon badge */}
          <div className="lp-hero-title-enter">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.2em] mb-8" style={{
              color: 'var(--lp-accent)',
              border: '1px solid var(--lp-accent)',
              boxShadow: `0 0 15px rgba(201,169,110,0.2), inset 0 0 15px rgba(201,169,110,0.05)`,
              background: 'rgba(201,169,110,0.05)',
            }}>
              <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)', boxShadow: `0 0 8px var(--lp-accent)` }} />
              {data.badge}
            </span>
          </div>

          <h1 className="lp-hero-title-enter font-bold leading-[0.9] mb-6 uppercase" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(3rem, 6vw, 5.5rem)',
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
            textShadow: `0 0 40px rgba(201,169,110,0.15)`,
          }}>
            {data.title}
          </h1>

          <p className="lp-hero-title-enter max-w-[500px] mb-8" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-body)',
            fontSize: 'clamp(1rem, 1.2vw, 1.15rem)',
            lineHeight: '1.7',
            animationDelay: '0.3s',
          }}>
            {data.subtitle}
          </p>

          {/* Benefits with neon borders */}
          <div className="lp-hero-title-enter flex flex-wrap gap-2 mb-10" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <span key={i} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{
                color: 'var(--lp-text)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(201,169,110,0.2)',
                boxShadow: '0 0 8px rgba(201,169,110,0.05)',
              }}>
                ⚡ {b}
              </span>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 rounded-xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5" style={{
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              boxShadow: `0 0 30px var(--lp-accent), 0 12px 40px var(--lp-shadow)`,
              minWidth: '300px',
            }}>
              {data.ctaText}
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            {data.priceDisplay && (
              <p className="mt-5 text-sm" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.2} />}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `var(--lp-accent)`, boxShadow: `0 0 20px var(--lp-accent)`, opacity: 0.5 }} />
    </section>
  );
}
