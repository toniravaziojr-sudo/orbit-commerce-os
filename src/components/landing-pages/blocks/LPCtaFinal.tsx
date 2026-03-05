import type { LPCtaFinalProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPCtaFinalProps;
}

export function LPCtaFinal({ data }: Props) {
  return (
    <section 
      className="relative overflow-hidden px-[5%] py-16 md:py-24" 
      style={{ background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }}
    >
      {/* Accent glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center max-w-[1000px] mx-auto lp-cta-final-grid">
        <div className="flex justify-center">
          {data.productImageUrl && (
            <div className="relative group">
              <div 
                className="absolute inset-0 rounded-full blur-[40px] opacity-15 group-hover:opacity-25 transition-opacity"
                style={{ background: 'var(--lp-accent)' }}
              />
              <img
                src={data.productImageUrl}
                alt="Produto"
                className="relative w-full max-w-[400px] object-contain transition-transform duration-500 group-hover:scale-105"
                style={{ filter: `drop-shadow(0 20px 50px var(--lp-shadow))` }}
              />
            </div>
          )}
        </div>
        <div className="text-center md:text-left">
          <h2
            className="text-2xl md:text-4xl font-extrabold leading-tight mb-5"
            style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
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
        </div>
      </div>
    </section>
  );
}
