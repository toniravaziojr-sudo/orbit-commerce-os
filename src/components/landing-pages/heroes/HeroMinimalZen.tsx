// =============================================
// HERO: Minimal Zen
// Muito espaço negativo, tipografia fina,
// produto centralizado pequeno, composição clean
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroMinimalZen({ data }: Props) {
  return (
    <section className="relative overflow-hidden" style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)`,
    }}>
      {/* Subtle center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{
        background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`,
        opacity: 0.03,
        filter: 'blur(120px)',
      }} />

      <div className="relative flex flex-col items-center text-center px-[5%] py-32 md:py-0 max-w-[800px] mx-auto" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        
        {/* Minimal badge */}
        <div className="lp-hero-title-enter mb-10">
          <span className="text-[10px] font-medium uppercase tracking-[0.35em]" style={{ color: 'var(--lp-text-muted)' }}>
            — {data.badge} —
          </span>
        </div>

        {/* Thin elegant title */}
        <h1 className="lp-hero-title-enter font-light leading-[1.05] mb-8 tracking-[-0.01em]" style={{
          fontFamily: 'var(--lp-font-display)',
          fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
          animationDelay: '0.15s',
          color: 'var(--lp-text)',
        }}>
          {data.title}
        </h1>

        <p className="lp-hero-title-enter mx-auto mb-12" style={{
          color: 'var(--lp-text-muted)',
          fontFamily: 'var(--lp-font-body)',
          fontSize: 'clamp(0.95rem, 1.2vw, 1.1rem)',
          lineHeight: '1.8',
          animationDelay: '0.3s',
          maxWidth: '520px',
          fontWeight: 300,
        }}>
          {data.subtitle}
        </p>

        {/* Small centered product */}
        {data.productImageUrl && (
          <div className="lp-hero-title-enter mb-14" style={{ animationDelay: '0.4s' }}>
            <ProductPackshot src={data.productImageUrl} maxW="clamp(160px, 18vw, 240px)" maxH="clamp(200px, 30vh, 320px)" />
          </div>
        )}

        {/* Benefits as minimal text */}
        <div className="lp-hero-title-enter flex flex-wrap justify-center gap-6 mb-12" style={{ animationDelay: '0.5s' }}>
          {data.benefits.slice(0, 4).map((b, i) => (
            <span key={i} className="text-xs tracking-widest uppercase" style={{
              color: 'var(--lp-text-muted)',
              fontFamily: 'var(--lp-font-body)',
              opacity: 0.7,
            }}>
              {b}
            </span>
          ))}
        </div>

        {/* Clean CTA */}
        <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
          <a href={data.ctaUrl} className="group inline-flex items-center justify-center gap-3 px-12 py-4 rounded-full text-sm font-medium tracking-[0.1em] transition-all duration-500 hover:-translate-y-1" style={{
            background: 'var(--lp-text)',
            color: 'var(--lp-bg)',
            boxShadow: '0 8px 30px var(--lp-shadow)',
            minWidth: '240px',
          }}>
            {data.ctaText}
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
          {data.priceDisplay && (
            <p className="mt-6 text-xs font-light tracking-wide" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
          )}
        </div>
      </div>

      {/* Thin bottom line */}
      <div className="absolute bottom-0 left-[20%] right-[20%] h-px" style={{ background: 'var(--lp-divider)' }} />
    </section>
  );
}