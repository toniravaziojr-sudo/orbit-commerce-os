import type { LPHeroProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPHeroProps;
  variant?: string;
}

export function LPHero({ data, variant = 'split_right' }: Props) {
  switch (variant) {
    case 'centered':
      return <HeroCentered data={data} />;
    case 'glass_overlay':
      return <HeroGlass data={data} />;
    default:
      return <HeroSplitRight data={data} />;
  }
}

// ── VARIANT: split_right ──

function HeroSplitRight({ data }: { data: LPHeroProps }) {
  const sceneDesktopUrl = data.heroSceneDesktopUrl || '';
  const sceneMobileUrl = data.heroSceneMobileUrl || sceneDesktopUrl;
  const hasScene = !!sceneDesktopUrl;
  const hasProduct = !!data.productImageUrl;

  const bgStyle: React.CSSProperties = hasScene
    ? { backgroundImage: `url('${sceneDesktopUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : data.backgroundImageUrl
    ? { background: `linear-gradient(135deg, rgba(7,4,16,0.93) 0%, rgba(7,4,16,0.80) 50%, rgba(7,4,16,0.53) 100%), url('${data.backgroundImageUrl}') center/cover no-repeat` }
    : {};

  return (
    <section className={`relative overflow-hidden lp-noise ${hasScene ? 'lp-hero-scene' : ''}`} style={{ ...bgStyle, minHeight: hasScene ? '100vh' : '85vh' }}>
      {hasScene && sceneMobileUrl && (
        <style>{`@media (max-width: 767px) { .lp-hero-scene { background-image: url('${sceneMobileUrl}') !important; background-position: center !important; min-height: 100vh !important; } }`}</style>
      )}
      
      {/* Ambient glows */}
      {hasScene ? (
        <>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 50%, rgba(7,4,16,0.94) 0%, transparent 65%), linear-gradient(to right, rgba(7,4,16,0.96) 0%, rgba(7,4,16,0.87) 35%, rgba(7,4,16,0.47) 60%, transparent 100%)` }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(7,4,16,0.87) 100%)' }} />
        </>
      ) : (
        <>
          {/* Top-right accent glow */}
          <div className="absolute -top-[200px] -right-[200px] w-[800px] h-[800px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.07, filter: 'blur(80px)' }} />
          {/* Bottom-left subtle glow */}
          <div className="absolute -bottom-[150px] -left-[150px] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)`, opacity: 0.04, filter: 'blur(100px)' }} />
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 30%, var(--lp-bg, #070A10)66 100%), linear-gradient(180deg, var(--lp-bg) 0%, transparent 12%, transparent 88%, var(--lp-bg-alt) 100%)` }} />
          {/* Mesh gradient pattern */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(at 80% 20%, var(--lp-accent) 0%, transparent 50%), radial-gradient(at 20% 80%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.03 }} />
        </>
      )}

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-16 px-[5%] py-28 md:py-0 max-w-[1200px] mx-auto" style={{ minHeight: hasScene ? '100vh' : '85vh' }}>
        {/* Text column */}
        <div className={`max-w-[600px] z-10 ${hasScene ? 'lp-text-legible' : ''}`}>
          {/* Badge */}
          <div className="lp-hero-title-enter">
            <span
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-8"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                color: 'var(--lp-badge-text)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 20px rgba(201,169,110,0.08)',
              }}
            >
              <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
              {data.badge}
            </span>
          </div>

          {/* Title — editorial sizing */}
          <h1
            className="lp-hero-title-enter font-extrabold leading-[0.95] mb-7 tracking-[-0.03em]"
            style={{
              fontFamily: 'var(--lp-font-display)',
              fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)',
              animationDelay: '0.15s',
              color: 'var(--lp-text)',
            }}
          >
            <span className="lp-gradient-text">{data.title}</span>
          </h1>

          {/* Subtitle — refined */}
          <p
            className="lp-hero-title-enter max-w-[520px] mb-8"
            style={{
              color: 'var(--lp-text-muted)',
              fontFamily: 'var(--lp-font-body)',
              fontSize: 'clamp(1.05rem, 1.3vw, 1.25rem)',
              lineHeight: '1.7',
              animationDelay: '0.3s',
              letterSpacing: '0.01em',
            }}
          >
            {data.subtitle}
          </p>

          {/* Benefits — refined pills */}
          <div className="lp-hero-title-enter mb-10" style={{ animationDelay: '0.45s' }}>
            <div className="flex flex-wrap gap-3">
              {data.benefits.map((b, i) => (
                <span
                  key={i}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-[13px]"
                  style={{
                    color: 'var(--lp-text-muted)',
                    fontFamily: 'var(--lp-font-body)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-cta-text)' }}>✓</span>
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* CTA — dramatic */}
          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a
              href={data.ctaUrl}
              className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-12 py-5 rounded-2xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5"
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
            {data.priceDisplay && (
              <p className="mt-5 text-sm" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
            )}
          </div>
        </div>

        {/* Product column */}
        <div className="flex items-center justify-center order-first md:order-last">
          {hasProduct && <ProductPackshot src={data.productImageUrl} />}
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, var(--lp-accent) 30%, var(--lp-divider) 50%, var(--lp-accent) 70%, transparent 95%)`, opacity: 0.3 }} />
    </section>
  );
}

// ── VARIANT: centered ──

function HeroCentered({ data }: { data: LPHeroProps }) {
  const sceneDesktopUrl = data.heroSceneDesktopUrl || '';
  const hasScene = !!sceneDesktopUrl;
  const hasProduct = !!data.productImageUrl;

  const bgStyle: React.CSSProperties = hasScene
    ? { backgroundImage: `url('${sceneDesktopUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : data.backgroundImageUrl
    ? { background: `linear-gradient(180deg, var(--lp-bg, #070A10)ee 0%, var(--lp-bg, #070A10)bb 100%), url('${data.backgroundImageUrl}') center/cover no-repeat` }
    : {};

  return (
    <section className={`relative overflow-hidden lp-noise ${hasScene ? 'lp-hero-scene' : ''}`} style={{ ...bgStyle, minHeight: '100vh' }}>
      {hasScene && (
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, var(--lp-bg, #070A10)dd 0%, var(--lp-bg, #070A10)99 40%, var(--lp-bg, #070A10)cc 100%)` }} />
      )}
      {!hasScene && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`, opacity: 0.05, filter: 'blur(120px)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)55 100%)` }} />
        </>
      )}

      <div className="relative flex flex-col items-center text-center px-[5%] py-28 md:py-0 max-w-[960px] mx-auto" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div className="lp-hero-title-enter">
          <span
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-8"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
              color: 'var(--lp-badge-text)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
            {data.badge}
          </span>
        </div>

        <h1
          className="lp-hero-title-enter font-extrabold leading-[0.92] mb-7 tracking-[-0.03em] mx-auto"
          style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(3rem, 6vw, 5rem)', animationDelay: '0.15s', maxWidth: '800px', color: 'var(--lp-text)' }}
        >
          <span className="lp-gradient-text">{data.title}</span>
        </h1>

        <p
          className="lp-hero-title-enter mx-auto mb-8"
          style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', fontSize: 'clamp(1.05rem, 1.3vw, 1.25rem)', lineHeight: '1.7', animationDelay: '0.3s', maxWidth: '600px' }}
        >
          {data.subtitle}
        </p>

        {hasProduct && (
          <div className="lp-hero-title-enter my-10" style={{ animationDelay: '0.4s' }}>
            <ProductPackshot src={data.productImageUrl} maxW="clamp(220px, 24vw, 320px)" maxH="clamp(260px, 38vh, 420px)" />
          </div>
        )}

        <div className="lp-hero-title-enter mb-8" style={{ animationDelay: '0.5s' }}>
          <div className="flex flex-wrap justify-center gap-3">
            {data.benefits.slice(0, 4).map((b, i) => (
              <span key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px]" style={{ color: 'var(--lp-text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-cta-text)' }}>✓</span>
                {b}
              </span>
            ))}
          </div>
        </div>

        <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
          <a
            href={data.ctaUrl}
            className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-12 py-5 rounded-2xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5"
            style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 12px 40px var(--lp-shadow), 0 0 80px rgba(201,169,110,0.15)', minWidth: '300px' }}
          >
            {data.ctaText}
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
          {data.priceDisplay && (
            <p className="mt-5 text-sm" style={{ color: 'var(--lp-text-muted)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, var(--lp-accent) 30%, var(--lp-divider) 50%, var(--lp-accent) 70%, transparent 95%)`, opacity: 0.3 }} />
    </section>
  );
}

// ── VARIANT: glass_overlay ──

function HeroGlass({ data }: { data: LPHeroProps }) {
  const sceneDesktopUrl = data.heroSceneDesktopUrl || '';
  const sceneMobileUrl = data.heroSceneMobileUrl || sceneDesktopUrl;
  const hasScene = !!sceneDesktopUrl;
  const hasProduct = !!data.productImageUrl;

  const bgStyle: React.CSSProperties = hasScene
    ? { backgroundImage: `url('${sceneDesktopUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : data.backgroundImageUrl
    ? { background: `url('${data.backgroundImageUrl}') center/cover no-repeat` }
    : { background: `linear-gradient(135deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` };

  return (
    <section className={`relative overflow-hidden lp-noise ${hasScene ? 'lp-hero-scene' : ''}`} style={{ ...bgStyle, minHeight: '100vh' }}>
      {hasScene && sceneMobileUrl && (
        <style>{`@media (max-width: 767px) { .lp-hero-scene { background-image: url('${sceneMobileUrl}') !important; } }`}</style>
      )}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />

      <div className="relative flex items-center justify-center px-[5%] py-28 md:py-0" style={{ minHeight: '100vh' }}>
        <div
          className="relative max-w-[720px] w-full rounded-[2rem] p-12 md:p-16 text-center lp-glass-card"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
            backdropFilter: 'blur(24px) saturate(1.2)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 32px 100px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {/* Top shine */}
          <div className="absolute top-0 left-[10%] right-[10%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }} />
          
          <div className="lp-hero-title-enter">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-8" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--lp-badge-text)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
              {data.badge}
            </span>
          </div>

          {hasProduct && (
            <div className="lp-hero-title-enter mb-8" style={{ animationDelay: '0.2s' }}>
              <ProductPackshot src={data.productImageUrl} maxW="clamp(180px, 20vw, 260px)" maxH="clamp(220px, 32vh, 340px)" />
            </div>
          )}

          <h1
            className="lp-hero-title-enter font-extrabold leading-[0.95] mb-6 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', animationDelay: '0.3s', color: 'var(--lp-text)' }}
          >
            <span className="lp-gradient-text">{data.title}</span>
          </h1>

          <p className="lp-hero-title-enter mx-auto mb-8" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', fontSize: 'clamp(1rem, 1.2vw, 1.15rem)', lineHeight: '1.7', animationDelay: '0.4s', maxWidth: '520px' }}>
            {data.subtitle}
          </p>

          <div className="lp-hero-title-enter mb-8" style={{ animationDelay: '0.5s' }}>
            <div className="flex flex-wrap justify-center gap-3">
              {data.benefits.slice(0, 3).map((b, i) => (
                <span key={i} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--lp-text)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  ✓ {b}
                </span>
              ))}
            </div>
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            <a
              href={data.ctaUrl}
              className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-12 py-5 rounded-2xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5"
              style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 12px 40px var(--lp-shadow), 0 0 80px rgba(201,169,110,0.15)', minWidth: '280px' }}
            >
              {data.ctaText}
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent 5%, var(--lp-accent) 30%, var(--lp-divider) 50%, var(--lp-accent) 70%, transparent 95%)`, opacity: 0.3 }} />
    </section>
  );
}

// ── Shared sub-components ──

function ProductPackshot({ src, maxW, maxH }: { src: string; maxW?: string; maxH?: string }) {
  return (
    <div className="relative lp-hero-title-enter flex items-center justify-center" style={{ animationDelay: '0.3s' }}>
      {/* Ambient backlight */}
      <div className="absolute inset-0 scale-90 rounded-full" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.08, filter: 'blur(60px)' }} />
      {/* Contact shadow */}
      <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[60%] h-[20px] rounded-full" style={{ background: 'rgba(0,0,0,0.4)', filter: 'blur(15px)' }} />
      <img
        src={src}
        alt="Produto"
        className="relative w-full object-contain transition-transform duration-700 hover:scale-105"
        style={{ filter: `drop-shadow(0 24px 60px var(--lp-shadow))`, maxWidth: maxW || 'clamp(260px, 30vw, 400px)', maxHeight: maxH || 'clamp(300px, 44vh, 500px)' }}
      />
    </div>
  );
}
