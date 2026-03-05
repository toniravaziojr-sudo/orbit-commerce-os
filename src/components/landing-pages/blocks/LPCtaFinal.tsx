import type { LPCtaFinalProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPCtaFinalProps;
}

export function LPCtaFinal({ data }: Props) {
  const revealRef = useLPScrollReveal();

  const sceneDesktopUrl = data.ctaSceneDesktopUrl || 
    (data.productImageUrl?.includes('lp-creatives/') || data.productImageUrl?.includes('section-cta') 
      ? data.productImageUrl : '');
  const sceneMobileUrl = data.ctaSceneMobileUrl || sceneDesktopUrl;
  const isScene = !!sceneDesktopUrl;
  const hasProductImage = !!data.productImageUrl;

  // ── Scene banner mode ──
  if (isScene) {
    return (
      <section 
        ref={revealRef}
        className="relative overflow-hidden lp-cta-scene lp-noise"
        style={{
          backgroundImage: `url('${sceneDesktopUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '460px',
        }}
      >
        <style>{`
          @media (max-width: 767px) {
            .lp-cta-scene { background-image: url('${sceneMobileUrl}') !important; }
          }
        `}</style>
        {/* Strong overlay for text legibility — safe area */}
        <div className="absolute inset-0" style={{
          background: `
            linear-gradient(to right, var(--lp-bg, #070A10)f2 0%, var(--lp-bg, #070A10)dd 45%, var(--lp-bg, #070A10)88 70%, transparent 100%)
          `,
        }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)cc 100%)',
        }} />

        {/* Safe area layout: text LEFT, product RIGHT */}
        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-center px-[5%] py-20 md:py-28 max-w-[1000px] mx-auto lp-reveal" style={{ minHeight: '460px' }}>
          <div className="text-center md:text-left max-w-[560px]">
            <h2
              className="lp-gradient-text font-extrabold leading-tight mb-5"
              style={{ 
                fontFamily: 'var(--lp-font-display)',
                fontSize: 'clamp(1.5rem, 2.8vw, 2.5rem)',
              }}
            >
              {data.title}
            </h2>
            <p
              className="text-base leading-relaxed mb-7 max-w-[500px]"
              style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
            >
              {data.description}
            </p>
            {data.priceDisplay && (
              <div
                className="mb-7"
                style={{ fontFamily: 'var(--lp-font-display)' }}
                dangerouslySetInnerHTML={{ __html: data.priceDisplay }}
              />
            )}
            <a
              href={data.ctaUrl}
              className="lp-cta-btn lp-cta-shimmer inline-block px-14 py-5 rounded-xl text-base font-bold uppercase tracking-wider transition-all duration-300 hover:opacity-90 hover:-translate-y-1 text-center"
              style={{ 
                background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
                color: 'var(--lp-cta-text)',
                boxShadow: '0 8px 32px var(--lp-shadow), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px rgba(201,169,110,0.12)',
                minWidth: '300px',
                letterSpacing: '0.1em',
              }}
            >
              {data.ctaText}
            </a>
          </div>
        </div>
      </section>
    );
  }

  // ── Standard 2-column mode — product RIGHT, text LEFT (safe area enforced) ──
  return (
    <section 
      ref={revealRef}
      className="relative overflow-hidden px-[5%] py-20 md:py-28 lp-noise" 
      style={{ background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }}
    >
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[200px] opacity-[0.08] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center max-w-[1000px] mx-auto lp-cta-final-grid">
        {/* Text LEFT (always first on desktop) */}
        <div className="text-center md:text-left lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <h2
            className="lp-gradient-text font-extrabold leading-tight mb-5"
            style={{ 
              fontFamily: 'var(--lp-font-display)',
              fontSize: 'clamp(1.5rem, 2.8vw, 2.5rem)',
            }}
          >
            {data.title}
          </h2>
          <p
            className="text-base leading-relaxed mb-7"
            style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
          >
            {data.description}
          </p>
          {data.priceDisplay && (
            <div
              className="mb-7"
              style={{ fontFamily: 'var(--lp-font-display)' }}
              dangerouslySetInnerHTML={{ __html: data.priceDisplay }}
            />
          )}
          <a
            href={data.ctaUrl}
            className="lp-cta-btn lp-cta-shimmer inline-block px-14 py-5 rounded-xl text-base font-bold uppercase tracking-wider transition-all duration-300 hover:opacity-90 hover:-translate-y-1 text-center"
            style={{ 
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 8px 32px var(--lp-shadow), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px rgba(201,169,110,0.12)',
              minWidth: '300px',
              letterSpacing: '0.1em',
            }}
          >
            {data.ctaText}
          </a>
        </div>

        {/* Product RIGHT (safe area — image never overlaps text) */}
        <div className="flex justify-center lp-scale-in order-1 md:order-2">
          {hasProductImage ? (
            <div className="relative group">
              <div 
                className="absolute inset-0 rounded-full blur-[60px] opacity-[0.12] group-hover:opacity-[0.22] transition-opacity duration-500"
                style={{ background: 'var(--lp-accent)' }}
              />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full max-w-[400px] object-contain transition-transform duration-700 group-hover:scale-105"
                style={{ filter: `drop-shadow(0 30px 80px var(--lp-shadow))` }}
              />
            </div>
          ) : (
            /* Premium fallback when no product image (catalog was blocked) */
            <div className="relative w-full max-w-[400px] aspect-square rounded-3xl overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0" style={{
                background: `
                  radial-gradient(ellipse at 40% 40%, var(--lp-accent) 0%, transparent 55%),
                  radial-gradient(ellipse at 60% 60%, var(--lp-card-bg) 0%, transparent 45%),
                  linear-gradient(135deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)
                `,
                opacity: 0.35,
              }} />
              <div className="absolute inset-0 rounded-3xl" style={{
                border: '1px solid var(--lp-card-border)',
              }} />
              <div 
                className="relative w-24 h-24 rounded-full flex items-center justify-center"
                style={{ 
                  background: 'var(--lp-badge-bg)',
                  border: '2px solid var(--lp-card-border)',
                  boxShadow: '0 0 60px var(--lp-shadow)',
                }}
              >
                <span className="text-4xl" style={{ color: 'var(--lp-accent)' }}>★</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
