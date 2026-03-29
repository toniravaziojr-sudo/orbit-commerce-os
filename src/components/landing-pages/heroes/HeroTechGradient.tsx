// =============================================
// HERO: Tech Gradient
// Gradientes mesh vibrantes, tipografia geométrica,
// glassmorphism pesado, futurístico
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroTechGradient({ data }: Props) {
  return (
    <section className="relative overflow-hidden" style={{ minHeight: '100vh' }}>
      {/* Mesh gradient background */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 20% 30%, var(--lp-accent) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, var(--lp-cta-bg) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, var(--lp-bg-alt) 0%, transparent 80%),
          var(--lp-bg)
        `,
      }} />
      {/* Darken overlay for readability */}
      <div className="absolute inset-0" style={{ background: 'var(--lp-bg)', opacity: 0.82 }} />

      {/* Grid dots pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
      }} />

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-10 md:gap-16 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        <div className="max-w-[600px] z-10">
          {/* Glass badge */}
          <div className="lp-hero-title-enter">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-[0.15em] mb-8" style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
              color: 'var(--lp-badge-text)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
              <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
              {data.badge}
            </span>
          </div>

          <h1 className="lp-hero-title-enter font-bold leading-[0.95] mb-7 tracking-[-0.03em]" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(2.8rem, 5.5vw, 4.8rem)',
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
          }}>
            <span className="lp-gradient-text">{data.title}</span>
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

          {/* Benefits as glass cards */}
          <div className="lp-hero-title-enter grid grid-cols-2 gap-3 mb-10" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <div key={i} className="px-4 py-3 rounded-xl text-[13px] lp-glass-card" style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--lp-text-muted)',
                fontFamily: 'var(--lp-font-body)',
              }}>
                <span className="mr-2" style={{ color: 'var(--lp-accent)' }}>→</span>
                {b}
              </div>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 rounded-2xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5" style={{
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 16px 50px var(--lp-shadow), 0 0 60px rgba(201,169,110,0.1)',
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
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.12} />}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, var(--lp-accent), transparent)`, opacity: 0.2 }} />
    </section>
  );
}