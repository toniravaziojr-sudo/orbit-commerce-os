// =============================================
// HERO: Luxury Editorial
// Tipografia gigante serif, packshot flutuante,
// fundo escuro com glow dourado, composição editorial
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';
import { ProductPackshot } from './shared/ProductPackshot';

interface Props { data: LPHeroProps; }

export function HeroLuxuryEditorial({ data }: Props) {
  const hasScene = !!data.heroSceneDesktopUrl;
  const sceneMobileUrl = data.heroSceneMobileUrl || data.heroSceneDesktopUrl || '';

  return (
    <section
      className="relative overflow-hidden lp-noise"
      style={{
        minHeight: '100vh',
        ...(hasScene ? {
          backgroundImage: `url('${data.heroSceneDesktopUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}),
      }}
    >
      {hasScene && sceneMobileUrl && (
        <style>{`@media (max-width: 767px) { .lp-hero-lux { background-image: url('${sceneMobileUrl}') !important; } }`}</style>
      )}

      {/* Overlays */}
      {hasScene ? (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, var(--lp-bg, #070A10)f5 0%, var(--lp-bg, #070A10)cc 40%, transparent 100%)` }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)dd 100%)' }} />
        </>
      ) : (
        <>
          {/* Decorative golden glow */}
          <div className="absolute -top-[300px] -right-[300px] w-[900px] h-[900px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`, opacity: 0.06, filter: 'blur(100px)' }} />
          <div className="absolute -bottom-[200px] -left-[200px] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`, opacity: 0.04, filter: 'blur(80px)' }} />
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 30%, var(--lp-bg)66 100%)` }} />
        </>
      )}

      {/* Content grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-20 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
        
        {/* Text — editorial serif */}
        <div className={`max-w-[600px] z-10 ${hasScene ? 'lp-text-legible' : ''}`}>
          {/* Thin decorative line */}
          <div className="lp-hero-title-enter hidden md:block w-20 h-[1.5px] mb-10" style={{ background: `linear-gradient(90deg, var(--lp-accent), transparent)`, opacity: 0.6 }} />
          
          <div className="lp-hero-title-enter">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.25em] mb-8" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              color: 'var(--lp-badge-text)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
            }}>
              <span className="w-1.5 h-1.5 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
              {data.badge}
            </span>
          </div>

          <h1 className="lp-hero-title-enter font-bold leading-[0.92] mb-8 tracking-[-0.02em]" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(3rem, 5.5vw, 5rem)',
            animationDelay: '0.15s',
            color: 'var(--lp-text)',
          }}>
            <span className="lp-gradient-text">{data.title}</span>
          </h1>

          {/* Elegant italic subtitle */}
          <p className="lp-hero-title-enter max-w-[480px] mb-10" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(1.1rem, 1.4vw, 1.35rem)',
            lineHeight: '1.65',
            animationDelay: '0.3s',
            letterSpacing: '0.02em',
          }}>
            {data.subtitle}
          </p>

          {/* Benefits as elegant list */}
          <div className="lp-hero-title-enter mb-12 lp-stagger" style={{ animationDelay: '0.45s' }}>
            {data.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lp-accent)' }} />
                <span className="text-sm tracking-wide" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}>{b}</span>
              </div>
            ))}
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 rounded-xl text-sm font-bold uppercase tracking-[0.18em] transition-all duration-500 hover:-translate-y-1.5" style={{
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 16px 50px var(--lp-shadow), 0 0 80px rgba(201,169,110,0.12)',
              minWidth: '280px',
            }}>
              {data.ctaText}
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
            {data.priceDisplay && (
              <p className="mt-5 text-sm" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        {/* Product — dramatic float */}
        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && <ProductPackshot src={data.productImageUrl} />}
        </div>
      </div>

      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent 5%, var(--lp-accent) 30%, var(--lp-divider) 50%, var(--lp-accent) 70%, transparent 95%)`, opacity: 0.25 }} />
    </section>
  );
}
