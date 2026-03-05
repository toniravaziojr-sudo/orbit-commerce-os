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
          minHeight: '600px',
        }}
      >
        <div 
          className="absolute inset-0 lp-hero-overlay"
          style={{
            background: `linear-gradient(to right, var(--lp-bg, #0a0a0a)ee 0%, var(--lp-bg, #0a0a0a)cc 45%, var(--lp-bg, #0a0a0a)44 75%, transparent 100%)`,
          }}
        />
        
        <div className="relative px-[5%] py-16 md:py-24 max-w-[1200px] mx-auto flex items-center" style={{ minHeight: '600px' }}>
          <div className="max-w-[550px] lp-hero-content">
            <span
              className="inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-6"
              style={{ 
                background: 'var(--lp-badge-bg)', 
                color: 'var(--lp-badge-text)',
                border: '1px solid var(--lp-card-border)',
              }}
            >
              {data.badge}
            </span>
            <h1
              className="text-3xl md:text-[3.2rem] font-extrabold leading-[1.08] mb-6 tracking-tight"
              style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
            >
              {data.title}
            </h1>
            <p
              className="text-base md:text-lg leading-relaxed mb-8 max-w-[520px]"
              style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
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
        background: `linear-gradient(135deg, var(--lp-bg, #0a0a0a)ee 0%, var(--lp-bg, #0a0a0a)cc 50%, var(--lp-bg, #0a0a0a)88 100%), url('${data.backgroundImageUrl}') center/cover no-repeat`,
      }
    : {
        background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)`,
      };

  return (
    <section className="relative overflow-hidden" style={bgStyle}>
      <div 
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 blur-[120px] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-16 px-[5%] py-16 md:py-24 max-w-[1200px] mx-auto">
        <div className="max-w-[600px]">
          <span
            className="inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-6"
            style={{ 
              background: 'var(--lp-badge-bg)', 
              color: 'var(--lp-badge-text)',
              border: '1px solid var(--lp-card-border)',
            }}
          >
            {data.badge}
          </span>
          <h1
            className="text-3xl md:text-[3.2rem] font-extrabold leading-[1.08] mb-6 tracking-tight"
            style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
          >
            {data.title}
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed mb-6 max-w-[520px]"
            style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
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
                className="absolute inset-0 rounded-full blur-[60px] opacity-20 scale-75"
                style={{ background: 'var(--lp-accent)' }}
              />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full max-w-[480px] h-auto object-contain transition-transform duration-500 hover:scale-105"
                style={{ filter: `drop-shadow(0 20px 50px var(--lp-shadow))` }}
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
    <ul className="mb-8 space-y-2.5">
      {benefits.map((b, i) => (
        <li
          key={i}
          className="flex items-start gap-3 text-[15px]"
          style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
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
        className="inline-block px-12 py-5 rounded-xl text-lg font-bold uppercase tracking-wider transition-all duration-300 hover:opacity-90 hover:-translate-y-1 hover:shadow-2xl text-center"
        style={{ 
          background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
          color: 'var(--lp-cta-text)',
          boxShadow: '0 8px 32px var(--lp-shadow)',
          minWidth: '280px',
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
