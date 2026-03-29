// =============================================
// HERO: Corporate Trust
// Grid estruturado, badges de confiança,
// tipografia sem-serif pesada, profissional
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroCorporateTrust({ data }: Props) {
  return (
    <section className="relative overflow-hidden" style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)`,
    }}>
      {/* Structured grid pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `var(--lp-accent)` }} />

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-10 md:gap-16 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        {/* Text — structured */}
        <div className="max-w-[580px] z-10">
          {/* Trust badges row */}
          <div className="lp-hero-title-enter flex items-center gap-3 mb-8">
            {['⭐ Avaliado', '🛡️ Garantido', '🚀 Entrega Rápida'].map((badge, i) => (
              <span key={i} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md" style={{
                background: 'var(--lp-card-bg)',
                color: 'var(--lp-text-muted)',
                border: '1px solid var(--lp-card-border)',
              }}>
                {badge}
              </span>
            ))}
          </div>

          <div className="lp-hero-title-enter mb-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--lp-accent)' }}>
              {data.badge}
            </span>
          </div>

          <h1 className="lp-hero-title-enter font-extrabold leading-[0.98] mb-6 tracking-tight" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(2.5rem, 4.5vw, 3.8rem)',
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
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

          {/* Benefits as structured list */}
          <div className="lp-hero-title-enter space-y-3 mb-10" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{
                background: 'var(--lp-card-bg)',
                border: '1px solid var(--lp-card-border)',
              }}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-cta-text)' }}>
                  {i + 1}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-body)' }}>{b}</span>
              </div>
            ))}
          </div>

          <div className="lp-hero-title-enter flex items-center gap-4" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-10 py-4 rounded-lg text-sm font-bold uppercase tracking-[0.1em] transition-all duration-500 hover:-translate-y-1" style={{
              background: `var(--lp-cta-bg)`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 8px 30px var(--lp-shadow)',
              minWidth: '260px',
            }}>
              {data.ctaText}
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
          {data.priceDisplay && (
            <p className="mt-4 text-sm" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
          )}
        </div>

        {/* Product */}
        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} />}
        </div>
      </div>
    </section>
  );
}