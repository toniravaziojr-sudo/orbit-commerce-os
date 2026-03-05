// =============================================
// HERO: Product Gradient (Universal Default)
// 
// Layout:
// - Layer 1: Gradient background derived from product/brand colors
// - Layer 2: Title with keyword highlight effect + subtitle + CTA
// - Layer 3: Product image (bg removed) overlaid on gradient
//
// Desktop: text left, product right
// Mobile: title → product → subtitle + CTA
// =============================================

import type { LPHeroProps } from '@/lib/landing-page-schema';

interface Props { data: LPHeroProps; }

/**
 * Extract the longest word from the title to apply the highlight effect.
 * Falls back to first word if all are short.
 */
function getHighlightWord(title: string): { before: string; highlight: string; after: string } {
  const words = title.split(' ');
  if (words.length <= 1) return { before: '', highlight: title, after: '' };
  
  // Pick the longest word (usually the most impactful)
  let maxLen = 0;
  let maxIdx = 0;
  words.forEach((w, i) => {
    if (w.length > maxLen) { maxLen = w.length; maxIdx = i; }
  });
  
  return {
    before: words.slice(0, maxIdx).join(' '),
    highlight: words[maxIdx],
    after: words.slice(maxIdx + 1).join(' '),
  };
}

export function HeroProductGradient({ data }: Props) {
  const { before, highlight, after } = getHighlightWord(data.title);

  return (
    <section
      className="relative overflow-hidden w-full"
      style={{ minHeight: '100svh' }}
    >
      {/* Layer 1: Gradient background using LP color scheme */}
      <div className="absolute inset-0" style={{
        background: `linear-gradient(135deg, var(--lp-bg) 0%, var(--lp-bg-alt) 40%, var(--lp-accent) 100%)`,
      }} />
      
      {/* Subtle radial glow from accent */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[60%] h-[80%] pointer-events-none" style={{
        background: `radial-gradient(ellipse at 70% 50%, var(--lp-accent) 0%, transparent 70%)`,
        opacity: 0.12,
        filter: 'blur(80px)',
      }} />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 lp-noise pointer-events-none" style={{ opacity: 0.4 }} />

      {/* Content grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 items-center gap-6 md:gap-12 px-[5%] max-w-[1200px] mx-auto"
        style={{ minHeight: '100svh', paddingTop: 'clamp(80px, 12vh, 120px)', paddingBottom: 'clamp(40px, 6vh, 80px)' }}
      >
        {/* Text column */}
        <div className="flex flex-col gap-5 z-10 order-1">
          {/* Badge */}
          {data.badge && (
            <div className="lp-hero-title-enter">
              <span className="inline-block px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] rounded-full" style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--lp-accent)',
                border: '1px solid var(--lp-accent)',
                backdropFilter: 'blur(8px)',
              }}>
                {data.badge}
              </span>
            </div>
          )}

          {/* Title with keyword highlight — visible on mobile before product */}
          <h1 className="lp-hero-title-enter font-extrabold leading-[0.95] tracking-tight" style={{
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)',
            color: 'var(--lp-text)',
            animationDelay: '0.1s',
          }}>
            {before && <>{before}{' '}</>}
            <span style={{
              color: 'var(--lp-accent)',
              textShadow: '0 0 40px var(--lp-accent)',
              display: 'inline',
            }}>
              {highlight}
            </span>
            {after && <>{' '}{after}</>}
          </h1>

          {/* Product image — MOBILE ONLY: between title and subtitle */}
          <div className="flex md:hidden items-center justify-center py-4 order-2">
            {data.productImageUrl && (
              <div className="relative lp-hero-title-enter" style={{ animationDelay: '0.2s' }}>
                <div className="absolute inset-0 scale-75 rounded-full pointer-events-none" style={{
                  background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`,
                  opacity: 0.15,
                  filter: 'blur(50px)',
                }} />
                <img
                  src={data.productImageUrl}
                  alt="Produto"
                  className="relative w-full object-contain drop-shadow-2xl"
                  style={{
                    maxWidth: 'min(280px, 70vw)',
                    maxHeight: '300px',
                    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))',
                    mixBlendMode: 'multiply',
                  }}
                />
              </div>
            )}
          </div>

          {/* Subtitle */}
          <p className="lp-hero-title-enter max-w-[480px] text-base md:text-lg order-3" style={{
            color: 'var(--lp-text-muted)',
            fontFamily: 'var(--lp-font-body)',
            lineHeight: 1.7,
            animationDelay: '0.25s',
          }}>
            {data.subtitle}
          </p>

          {/* CTA button — rounded, compact */}
          <div className="lp-hero-title-enter order-4" style={{ animationDelay: '0.4s' }}>
            <a
              href={data.ctaUrl}
              className="lp-cta-btn lp-cta-shimmer inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wider rounded-full transition-all duration-400 hover:-translate-y-1 hover:shadow-xl"
              style={{
                background: 'var(--lp-cta-bg)',
                color: 'var(--lp-cta-text)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                minWidth: '200px',
                textAlign: 'center',
              }}
            >
              {data.ctaText}
            </a>

            {data.priceDisplay && (
              <p className="mt-3 text-sm" style={{ color: 'var(--lp-text-muted)' }}
                dangerouslySetInnerHTML={{ __html: data.priceDisplay }}
              />
            )}
          </div>
        </div>

        {/* Product image — DESKTOP ONLY: right side */}
        <div className="hidden md:flex items-center justify-center order-2">
          {data.productImageUrl && (
            <div className="relative lp-hero-title-enter" style={{ animationDelay: '0.3s' }}>
              {/* Ambient glow */}
              <div className="absolute inset-0 scale-90 rounded-full pointer-events-none" style={{
                background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`,
                opacity: 0.1,
                filter: 'blur(60px)',
              }} />
              {/* Contact shadow */}
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[60%] h-[20px] rounded-full pointer-events-none" style={{
                background: 'rgba(0,0,0,0.35)',
                filter: 'blur(15px)',
              }} />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full object-contain transition-transform duration-700 hover:scale-105"
                style={{
                  filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.4))',
                  maxWidth: 'clamp(260px, 28vw, 420px)',
                  maxHeight: 'clamp(300px, 50vh, 550px)',
                  mixBlendMode: 'multiply',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
