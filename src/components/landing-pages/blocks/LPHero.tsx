import type { LPHeroProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPHeroProps;
}

function Particles() {
  return (
    <div className="lp-particles">
      {[...Array(6)].map((_, i) => <div key={i} className="lp-particle" />)}
    </div>
  );
}

export function LPHero({ data }: Props) {
  const sceneDesktopUrl = data.heroSceneDesktopUrl || 
    (data.productImageUrl?.includes('lp-creatives/') || data.productImageUrl?.includes('section-hero') 
      ? data.productImageUrl : '');
  const sceneMobileUrl = data.heroSceneMobileUrl || sceneDesktopUrl;
  const isScene = !!sceneDesktopUrl;

  // ── SCENE MODE ──
  if (isScene) {
    return (
      <section
        className="relative overflow-hidden lp-hero-scene lp-noise"
        style={{
          backgroundImage: `url('${sceneDesktopUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
          minHeight: '700px',
        }}
      >
        <style>{`
          @media (max-width: 767px) {
            .lp-hero-scene { background-image: url('${sceneMobileUrl}') !important; background-position: center !important; }
          }
        `}</style>
        <Particles />
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse at 20% 50%, var(--lp-bg, #070A10)ee 0%, transparent 70%),
            linear-gradient(to right, var(--lp-bg, #070A10)f0 0%, var(--lp-bg, #070A10)cc 40%, var(--lp-bg, #070A10)66 65%, transparent 100%)
          `,
        }} />
        <div className="absolute inset-0 lp-hero-overlay" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, var(--lp-bg, #070A10)cc 100%)',
        }} />
        
        <div className="relative px-[5%] py-24 md:py-32 max-w-[1140px] mx-auto flex items-center" style={{ minHeight: '700px' }}>
          <div className="max-w-[560px] lp-hero-content">
            <span
              className="lp-badge-pulse inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-7 lp-hero-title-enter"
              style={{ 
                background: 'var(--lp-badge-bg)', 
                color: 'var(--lp-badge-text)',
                border: '1px solid var(--lp-card-border)',
                backdropFilter: 'blur(8px)',
                animationDelay: '0s',
              }}
            >
              {data.badge}
            </span>
            <h1
              className="lp-gradient-text lp-hero-title-enter font-extrabold leading-[1.04] mb-6 tracking-tight"
              style={{ 
                fontFamily: 'var(--lp-font-display)',
                fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)',
                animationDelay: '0.15s',
              }}
            >
              {data.title}
            </h1>
            <p
              className="leading-relaxed mb-8 max-w-[520px] lp-hero-title-enter"
              style={{ 
                color: 'var(--lp-text-muted)', 
                fontFamily: 'var(--lp-font-body)',
                fontSize: 'clamp(1rem, 1.3vw, 1.2rem)',
                animationDelay: '0.3s',
              }}
            >
              {data.subtitle}
            </p>
            <div className="lp-hero-title-enter" style={{ animationDelay: '0.45s' }}>
              {renderBenefits(data.benefits)}
            </div>
            <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
              {renderCTA(data)}
            </div>
          </div>
        </div>

        <div 
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }}
        />
      </section>
    );
  }

  // ── STANDARD MODE ──
  const bgStyle: React.CSSProperties = data.backgroundImageUrl
    ? {
        background: `linear-gradient(135deg, var(--lp-bg, #070A10)ee 0%, var(--lp-bg, #070A10)cc 50%, var(--lp-bg, #070A10)88 100%), url('${data.backgroundImageUrl}') center/cover no-repeat`,
      }
    : {};

  return (
    <section className="relative overflow-hidden lp-noise" style={bgStyle}>
      <Particles />
      <div 
        className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full opacity-[0.09] blur-[150px] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      <div 
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[120px] pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.5)' }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)55 100%),
          linear-gradient(180deg, var(--lp-bg) 0%, transparent 15%, transparent 85%, var(--lp-bg-alt) 100%)
        `,
      }} />
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-16 px-[5%] py-24 md:py-32 max-w-[1140px] mx-auto">
        <div className="max-w-[600px]">
          <span
            className="lp-badge-pulse inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-7 lp-hero-title-enter"
            style={{ 
              background: 'var(--lp-badge-bg)', 
              color: 'var(--lp-badge-text)',
              border: '1px solid var(--lp-card-border)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {data.badge}
          </span>
          <h1
            className="lp-gradient-text lp-hero-title-enter font-extrabold leading-[1.04] mb-6 tracking-tight"
            style={{ 
              fontFamily: 'var(--lp-font-display)',
              fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)',
              animationDelay: '0.15s',
            }}
          >
            {data.title}
          </h1>
          <p
            className="leading-relaxed mb-6 max-w-[520px] lp-hero-title-enter"
            style={{ 
              color: 'var(--lp-text-muted)', 
              fontFamily: 'var(--lp-font-body)',
              fontSize: 'clamp(1rem, 1.3vw, 1.2rem)',
              animationDelay: '0.3s',
            }}
          >
            {data.subtitle}
          </p>
          <div className="lp-hero-title-enter" style={{ animationDelay: '0.45s' }}>
            {renderBenefits(data.benefits)}
          </div>
          <div className="lp-hero-title-enter" style={{ animationDelay: '0.6s' }}>
            {renderCTA(data)}
          </div>
        </div>
        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && (
            <div className="relative lp-hero-title-enter" style={{ animationDelay: '0.3s' }}>
              <div 
                className="absolute inset-0 rounded-full blur-[80px] opacity-[0.18] scale-75"
                style={{ background: 'var(--lp-accent)' }}
              />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full max-w-[480px] h-auto object-contain transition-transform duration-700 hover:scale-105"
                style={{ filter: `drop-shadow(0 30px 80px var(--lp-shadow))` }}
              />
            </div>
          )}
        </div>
      </div>
      
      <div 
        className="h-px w-full"
        style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }}
      />
    </section>
  );
}

// ── Shared sub-components ──

function renderBenefits(benefits: string[]) {
  return (
    <ul className="mb-8 space-y-3 lp-stagger">
      {benefits.map((b, i) => (
        <li
          key={i}
          className="flex items-start gap-3"
          style={{ 
            color: 'var(--lp-text-muted)', 
            fontFamily: 'var(--lp-font-body)',
            fontSize: 'clamp(0.9rem, 1.1vw, 1rem)',
          }}
        >
          <span 
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
            style={{ 
              background: 'var(--lp-badge-bg)', 
              color: 'var(--lp-accent)',
              border: '1px solid var(--lp-card-border)',
            }}
          >
            ✓
          </span>
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
      {data.priceDisplay && (
        <p
          className="mt-4 text-sm"
          style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
          dangerouslySetInnerHTML={{ __html: data.priceDisplay }}
        />
      )}
    </div>
  );
}
