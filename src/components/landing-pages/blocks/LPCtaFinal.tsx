import type { LPCtaFinalProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPCtaFinalProps;
}

export function LPCtaFinal({ data }: Props) {
  const isScene = data.productImageUrl?.includes('lp-creatives/') || 
                  data.productImageUrl?.includes('section-cta');

  // ── Scene banner mode ──
  if (isScene && data.productImageUrl) {
    return (
      <section 
        className="relative overflow-hidden"
        style={{
          backgroundImage: `url('${data.productImageUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '420px',
        }}
      >
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse at center, var(--lp-bg, #070A10)88 0%, var(--lp-bg, #070A10)cc 100%),
            linear-gradient(180deg, var(--lp-bg, #070A10)dd 0%, var(--lp-bg, #070A10)99 50%, var(--lp-bg, #070A10)dd 100%)
          `,
        }} />
        <div className="relative flex flex-col items-center justify-center text-center px-[5%] py-20 md:py-28 max-w-[800px] mx-auto" style={{ minHeight: '420px' }}>
          <h2
            className="font-extrabold leading-tight mb-5"
            style={{ 
              color: 'var(--lp-text)', 
              fontFamily: 'var(--lp-font-display)',
              fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
            }}
          >
            {data.title}
          </h2>
          <p
            className="text-base leading-relaxed mb-7 max-w-[600px]"
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
        </div>
      </section>
    );
  }

  // ── Standard 2-column mode ──
  return (
    <section 
      className="relative overflow-hidden px-[5%] py-20 md:py-28" 
      style={{ background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }}
    >
      {/* Accent glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[180px] opacity-[0.06] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center max-w-[1000px] mx-auto lp-cta-final-grid">
        <div className="flex justify-center">
          {data.productImageUrl && (
            <div className="relative group">
              <div 
                className="absolute inset-0 rounded-full blur-[50px] opacity-[0.10] group-hover:opacity-[0.20] transition-opacity"
                style={{ background: 'var(--lp-accent)' }}
              />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full max-w-[400px] object-contain transition-transform duration-500 group-hover:scale-105"
                style={{ filter: `drop-shadow(0 30px 80px var(--lp-shadow))` }}
              />
            </div>
          )}
        </div>
        <div className="text-center md:text-left">
          <h2
            className="font-extrabold leading-tight mb-5"
            style={{ 
              color: 'var(--lp-text)', 
              fontFamily: 'var(--lp-font-display)',
              fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
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
        </div>
      </div>
    </section>
  );
}
