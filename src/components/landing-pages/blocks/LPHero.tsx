import type { LPHeroProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPHeroProps;
}

export function LPHero({ data }: Props) {
  const isEnhancedScene = data.productImageUrl?.includes('lp-creatives/') || 
                          data.productImageUrl?.includes('section-hero');

  // ── SCENE MODE: Enhanced image as full-section background ──
  if (isEnhancedScene && data.productImageUrl) {
    return (
      <section
        className="relative overflow-hidden lp-hero-scene"
        style={{
          backgroundImage: `url('${data.productImageUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
          minHeight: '640px',
        }}
      >
        {/* Multi-layer overlay for depth */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse at 20% 50%, var(--lp-bg, #070A10)ee 0%, transparent 70%),
            linear-gradient(to right, var(--lp-bg, #070A10)f0 0%, var(--lp-bg, #070A10)cc 40%, var(--lp-bg, #070A10)66 65%, transparent 100%)
          `,
        }} />
        {/* Vignette */}
        <div className="absolute inset-0 lp-hero-overlay" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, var(--lp-bg, #070A10)cc 100%)',
        }} />
        
        <div className="relative px-[5%] py-20 md:py-28 max-w-[1140px] mx-auto flex items-center" style={{ minHeight: '640px' }}>
          <div className="max-w-[560px] lp-hero-content">
            <span
              className="inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-7"
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
              className="font-extrabold leading-[1.06] mb-6 tracking-tight"
              style={{ 
                color: 'var(--lp-text)', 
                fontFamily: 'var(--lp-font-display)',
                fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              }}
            >
              {data.title}
            </h1>
            <p
              className="leading-relaxed mb-8 max-w-[520px]"
              style={{ 
                color: 'var(--lp-text-muted)', 
                fontFamily: 'var(--lp-font-body)',
                fontSize: 'clamp(0.95rem, 1.2vw, 1.125rem)',
              }}
            >
              {data.subtitle}
            </p>
            {renderBenefits(data.benefits)}
            {renderCTA(data)}
          </div>
        </div>

        <div 
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }}
        />
      </section>
    );
  }

  // ── STANDARD MODE: 2-column grid with product image ──
  const bgStyle: React.CSSProperties = data.backgroundImageUrl
    ? {
        background: `linear-gradient(135deg, var(--lp-bg, #070A10)ee 0%, var(--lp-bg, #070A10)cc 50%, var(--lp-bg, #070A10)88 100%), url('${data.backgroundImageUrl}') center/cover no-repeat`,
      }
    : {};

  return (
    <section className="relative overflow-hidden" style={bgStyle}>
      {/* Radial accent glow */}
      <div 
        className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full opacity-[0.07] blur-[150px] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      {/* Bottom-left subtle glow */}
      <div 
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-[120px] pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.5)' }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at center, transparent 40%, var(--lp-bg, #070A10)55 100%),
          linear-gradient(180deg, var(--lp-bg) 0%, transparent 15%, transparent 85%, var(--lp-bg-alt) 100%)
        `,
      }} />
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-16 px-[5%] py-20 md:py-28 max-w-[1140px] mx-auto">
        <div className="max-w-[600px]">
          <span
            className="inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-7"
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
            className="font-extrabold leading-[1.06] mb-6 tracking-tight"
            style={{ 
              color: 'var(--lp-text)', 
              fontFamily: 'var(--lp-font-display)',
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            }}
          >
            {data.title}
          </h1>
          <p
            className="leading-relaxed mb-6 max-w-[520px]"
            style={{ 
              color: 'var(--lp-text-muted)', 
              fontFamily: 'var(--lp-font-body)',
              fontSize: 'clamp(0.95rem, 1.2vw, 1.125rem)',
            }}
          >
            {data.subtitle}
          </p>
          {renderBenefits(data.benefits)}
          {renderCTA(data)}
        </div>
        <div className="flex items-center justify-center order-first md:order-last">
          {data.productImageUrl && (
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-full blur-[80px] opacity-[0.15] scale-75"
                style={{ background: 'var(--lp-accent)' }}
              />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full max-w-[480px] h-auto object-contain transition-transform duration-500 hover:scale-105"
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
    <ul className="mb-8 space-y-3">
      {benefits.map((b, i) => (
        <li
          key={i}
          className="flex items-start gap-3"
          style={{ 
            color: 'var(--lp-text-muted)', 
            fontFamily: 'var(--lp-font-body)',
            fontSize: 'clamp(0.875rem, 1.1vw, 1rem)',
          }}
        >
          <span 
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
            style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-accent)' }}
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
        className="lp-cta-btn inline-block px-12 py-[18px] rounded-lg text-base font-bold uppercase tracking-wider transition-all duration-300 hover:opacity-90 hover:-translate-y-1 text-center"
        style={{ 
          background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
          color: 'var(--lp-cta-text)',
          boxShadow: '0 8px 32px var(--lp-shadow), 0 0 0 1px rgba(255,255,255,0.08)',
          minWidth: '280px',
          letterSpacing: '0.08em',
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
