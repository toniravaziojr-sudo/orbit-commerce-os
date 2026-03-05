import type { LPHeroProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPHeroProps;
  variant?: string;
}

function Particles() {
  return (
    <div className="lp-particles">
      {[...Array(6)].map((_, i) => <div key={i} className="lp-particle" />)}
    </div>
  );
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

// ── VARIANT: split_right (original V7 layout) ──

function HeroSplitRight({ data }: { data: LPHeroProps }) {
  const sceneDesktopUrl = data.heroSceneDesktopUrl || '';
  const sceneMobileUrl = data.heroSceneMobileUrl || sceneDesktopUrl;
  const hasScene = !!sceneDesktopUrl;
  const hasProduct = !!data.productImageUrl;

  const bgStyle: React.CSSProperties = hasScene
    ? { backgroundImage: `url('${sceneDesktopUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : data.backgroundImageUrl
    ? { background: `linear-gradient(135deg, var(--lp-bg, #070A10)ee 0%, var(--lp-bg, #070A10)cc 50%, var(--lp-bg, #070A10)88 100%), url('${data.backgroundImageUrl}') center/cover no-repeat` }
    : {};

  return (
    <section className={`relative overflow-hidden lp-noise ${hasScene ? 'lp-hero-scene' : ''}`} style={{ ...bgStyle, minHeight: hasScene ? '700px' : undefined }}>
      {hasScene && sceneMobileUrl && (
        <style>{`@media (max-width: 767px) { .lp-hero-scene { background-image: url('${sceneMobileUrl}') !important; background-position: center !important; } }`}</style>
      )}
      <Particles />
      {hasScene ? (
        <>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 50%, var(--lp-bg, #070A10)ee 0%, transparent 70%), linear-gradient(to right, var(--lp-bg, #070A10)f0 0%, var(--lp-bg, #070A10)cc 40%, var(--lp-bg, #070A10)66 65%, transparent 100%)` }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, var(--lp-bg, #070A10)cc 100%)' }} />
        </>
      ) : (
        <>
          <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full opacity-[0.09] blur-[150px] pointer-events-none" style={{ background: 'var(--lp-accent)' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[120px] pointer-events-none" style={{ background: 'rgba(255,255,255,0.5)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)55 100%), linear-gradient(180deg, var(--lp-bg) 0%, transparent 15%, transparent 85%, var(--lp-bg-alt) 100%)` }} />
        </>
      )}

      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-16 px-[5%] py-24 md:py-32 max-w-[1140px] mx-auto" style={{ minHeight: hasScene ? '700px' : undefined }}>
        <div className="max-w-[600px]">
          <HeroBadge text={data.badge} />
          <HeroTitle text={data.title} />
          <HeroSubtitle text={data.subtitle} />
          <div className="lp-hero-title-enter" style={{ animationDelay: '0.45s' }}>{renderBenefits(data.benefits)}</div>
          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>{renderCTA(data)}</div>
        </div>
        <div className="flex items-center justify-center order-first md:order-last">
          {hasProduct && <ProductPackshot src={data.productImageUrl} />}
        </div>
      </div>
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }} />
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
    <section className={`relative overflow-hidden lp-noise ${hasScene ? 'lp-hero-scene' : ''}`} style={{ ...bgStyle, minHeight: hasScene ? '700px' : undefined }}>
      {hasScene && (
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, var(--lp-bg, #070A10)dd 0%, var(--lp-bg, #070A10)99 40%, var(--lp-bg, #070A10)cc 100%)` }} />
      )}
      {!hasScene && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-[180px] pointer-events-none" style={{ background: 'var(--lp-accent)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)55 100%)` }} />
        </>
      )}
      <Particles />

      <div className="relative flex flex-col items-center text-center px-[5%] py-24 md:py-32 max-w-[900px] mx-auto" style={{ minHeight: hasScene ? '700px' : undefined }}>
        <HeroBadge text={data.badge} />
        <HeroTitle text={data.title} centered />
        <HeroSubtitle text={data.subtitle} centered />

        {hasProduct && (
          <div className="lp-hero-title-enter my-8" style={{ animationDelay: '0.4s' }}>
            <ProductPackshot src={data.productImageUrl} maxW="clamp(200px, 22vw, 300px)" maxH="clamp(240px, 36vh, 400px)" />
          </div>
        )}

        <div className="lp-hero-title-enter" style={{ animationDelay: '0.5s' }}>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-8">
            {data.benefits.slice(0, 4).map((b, i) => (
              <span key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-accent)', border: '1px solid var(--lp-card-border)' }}>✓</span>
                {b}
              </span>
            ))}
          </div>
        </div>

        <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>{renderCTA(data)}</div>
      </div>
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }} />
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
    <section className={`relative overflow-hidden lp-noise ${hasScene ? 'lp-hero-scene' : ''}`} style={{ ...bgStyle, minHeight: '700px' }}>
      {hasScene && sceneMobileUrl && (
        <style>{`@media (max-width: 767px) { .lp-hero-scene { background-image: url('${sceneMobileUrl}') !important; } }`}</style>
      )}
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
      <Particles />

      <div className="relative flex items-center justify-center px-[5%] py-24 md:py-32 min-h-[700px]">
        <div
          className="relative max-w-[700px] w-full rounded-3xl p-10 md:p-14 text-center"
          style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px rounded-t-3xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
          
          <HeroBadge text={data.badge} />

          {hasProduct && (
            <div className="lp-hero-title-enter mb-6" style={{ animationDelay: '0.2s' }}>
              <ProductPackshot src={data.productImageUrl} maxW="clamp(160px, 18vw, 240px)" maxH="clamp(200px, 30vh, 320px)" />
            </div>
          )}

          <HeroTitle text={data.title} centered />
          <HeroSubtitle text={data.subtitle} centered />

          <div className="lp-hero-title-enter mb-6" style={{ animationDelay: '0.5s' }}>
            <div className="flex flex-wrap justify-center gap-3">
              {data.benefits.slice(0, 3).map((b, i) => (
                <span key={i} className="px-4 py-2 rounded-full text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--lp-text)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  ✓ {b}
                </span>
              ))}
            </div>
          </div>

          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>{renderCTA(data)}</div>
        </div>
      </div>
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }} />
    </section>
  );
}

// ── Shared sub-components ──

function HeroBadge({ text }: { text: string }) {
  return (
    <span
      className="lp-badge-pulse inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-7 lp-hero-title-enter"
      style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)', border: '1px solid var(--lp-card-border)', backdropFilter: 'blur(8px)' }}
    >
      {text}
    </span>
  );
}

function HeroTitle({ text, centered }: { text: string; centered?: boolean }) {
  return (
    <h1
      className={`lp-gradient-text lp-hero-title-enter font-extrabold leading-[1.04] mb-6 tracking-tight ${centered ? 'mx-auto' : ''}`}
      style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)', animationDelay: '0.15s', maxWidth: centered ? '700px' : undefined }}
    >
      {text}
    </h1>
  );
}

function HeroSubtitle({ text, centered }: { text: string; centered?: boolean }) {
  return (
    <p
      className={`leading-relaxed mb-6 lp-hero-title-enter ${centered ? 'mx-auto' : 'max-w-[520px]'}`}
      style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', fontSize: 'clamp(1rem, 1.3vw, 1.2rem)', animationDelay: '0.3s', maxWidth: centered ? '600px' : undefined }}
    >
      {text}
    </p>
  );
}

function ProductPackshot({ src, maxW, maxH }: { src: string; maxW?: string; maxH?: string }) {
  return (
    <div className="relative lp-hero-title-enter flex items-center justify-center" style={{ animationDelay: '0.3s' }}>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[20px] rounded-full blur-[15px] opacity-[0.3]" style={{ background: 'var(--lp-shadow, rgba(0,0,0,0.5))' }} />
      <div className="absolute inset-0 rounded-full blur-[80px] opacity-[0.10] scale-75" style={{ background: 'rgba(255,255,255,0.15)' }} />
      <img
        src={src}
        alt="Produto"
        className="relative w-full object-contain transition-transform duration-700 hover:scale-105"
        style={{ filter: `drop-shadow(0 20px 50px var(--lp-shadow))`, maxWidth: maxW || 'clamp(240px, 28vw, 360px)', maxHeight: maxH || 'clamp(280px, 42vh, 480px)' }}
      />
    </div>
  );
}

function renderBenefits(benefits: string[]) {
  return (
    <ul className="mb-8 space-y-3 lp-stagger">
      {benefits.map((b, i) => (
        <li key={i} className="flex items-start gap-3" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', fontSize: 'clamp(0.9rem, 1.1vw, 1rem)' }}>
          <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-accent)', border: '1px solid var(--lp-card-border)' }}>✓</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function renderCTA(data: LPHeroProps) {
  return (
    <div>
      <a
        href={data.ctaUrl}
        className="lp-cta-btn lp-cta-shimmer inline-block px-14 py-5 rounded-xl text-base font-bold uppercase tracking-wider transition-all duration-300 hover:opacity-90 hover:-translate-y-1 text-center"
        style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 8px 32px var(--lp-shadow), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px rgba(201,169,110,0.12)', minWidth: '300px', letterSpacing: '0.1em' }}
      >
        {data.ctaText}
      </a>
      {data.priceDisplay && (
        <p className="mt-4 text-sm" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }} dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />
      )}
    </div>
  );
}
