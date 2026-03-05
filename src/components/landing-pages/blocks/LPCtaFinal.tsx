import type { LPCtaFinalProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPCtaFinalProps;
}

export function LPCtaFinal({ data }: Props) {
  const revealRef = useLPScrollReveal();

  const sceneDesktopUrl = data.ctaSceneDesktopUrl || '';
  const sceneMobileUrl = data.ctaSceneMobileUrl || sceneDesktopUrl;
  const hasScene = !!sceneDesktopUrl;
  const hasProductImage = !!data.productImageUrl;

  return (
    <section
      ref={revealRef}
      className={`relative overflow-hidden lp-noise ${hasScene ? 'lp-cta-scene' : ''}`}
      style={{
        ...(hasScene ? {
          backgroundImage: `url('${sceneDesktopUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '520px',
        } : {
          background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)`,
        }),
      }}
    >
      {hasScene && sceneMobileUrl && (
        <style>{`@media (max-width: 767px) { .lp-cta-scene { background-image: url('${sceneMobileUrl}') !important; } }`}</style>
      )}

      {/* Overlays */}
      {hasScene ? (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, var(--lp-bg, #070A10)f5 0%, var(--lp-bg, #070A10)dd 40%, var(--lp-bg, #070A10)88 65%, transparent 100%)` }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)cc 100%)' }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 30% 50%, var(--lp-accent) 0%, transparent 60%)`, opacity: 0.04, filter: 'blur(80px)' }} />
          {/* Decorative line top */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, var(--lp-accent) 30%, var(--lp-divider) 50%, var(--lp-accent) 70%, transparent 95%)`, opacity: 0.2 }} />
        </>
      )}

      <div
        className="relative grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center px-[5%] py-24 md:py-32 max-w-[1100px] mx-auto lp-reveal"
        style={{ minHeight: hasScene ? '520px' : undefined }}
      >
        {/* Text LEFT */}
        <div className="text-center md:text-left lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          {/* Accent line */}
          <div className="hidden md:block w-16 h-[3px] rounded-full mb-8" style={{ background: `linear-gradient(90deg, var(--lp-accent), transparent)`, opacity: 0.5 }} />
          
          <h2
            className="font-extrabold leading-[1.05] mb-6 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.75rem)', color: 'var(--lp-text)' }}
          >
            <span className="lp-gradient-text">{data.title}</span>
          </h2>
          <p
            className="text-base leading-relaxed mb-8 max-w-[500px]"
            style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.8' }}
          >
            {data.description}
          </p>
          {data.priceDisplay && (
            <div className="mb-8" style={{ fontFamily: 'var(--lp-font-display)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
          )}
          <a
            href={data.ctaUrl}
            className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 rounded-2xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5"
            style={{
              background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
              color: 'var(--lp-cta-text)',
              boxShadow: '0 12px 40px var(--lp-shadow), 0 0 0 1px rgba(255,255,255,0.08), 0 0 80px rgba(201,169,110,0.15)',
              minWidth: '300px',
            }}
          >
            {data.ctaText}
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>

        {/* Product RIGHT */}
        <div className="flex justify-center lp-scale-in order-1 md:order-2">
          {hasProductImage ? (
            <div className="relative group">
              <div className="absolute inset-0 scale-90 rounded-full" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.08, filter: 'blur(60px)' }} />
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[60%] h-[20px] rounded-full" style={{ background: 'rgba(0,0,0,0.4)', filter: 'blur(15px)' }} />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full object-contain transition-transform duration-700 group-hover:scale-105"
                style={{ filter: `drop-shadow(0 24px 60px var(--lp-shadow))`, maxWidth: 'clamp(220px, 26vw, 360px)', maxHeight: 'clamp(260px, 40vh, 440px)' }}
              />
            </div>
          ) : (
            <div className="relative w-full max-w-[400px] aspect-square rounded-3xl overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 40% 40%, var(--lp-accent) 0%, transparent 55%), radial-gradient(ellipse at 60% 60%, var(--lp-card-bg) 0%, transparent 45%), linear-gradient(135deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)`, opacity: 0.25 }} />
              <div className="absolute inset-0 rounded-3xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }} />
              <div className="relative w-24 h-24 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 60px var(--lp-shadow)' }}>
                <span className="text-4xl" style={{ color: 'var(--lp-accent)' }}>★</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
