import type { LPPricingProps } from '@/lib/landing-page-schema';
import { formatPriceBRL } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPPricingProps;
}

export function LPPricing({ data }: Props) {
  const revealRef = useLPScrollReveal();

  const colClass =
    data.cards.length === 1 ? 'max-w-[420px]' :
    data.cards.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-[860px]' :
    'grid-cols-1 md:grid-cols-3';

  return (
    <section
      ref={revealRef}
      id="ofertas"
      className="relative overflow-hidden px-[5%] py-20 md:py-28 lp-noise"
      style={{ background: 'var(--lp-bg-alt)' }}
    >
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[250px] opacity-[0.08] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      
      <div className="relative text-center max-w-[700px] mx-auto mb-16 lp-reveal">
        <span
          className="lp-badge-pulse inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
          style={{ 
            background: 'var(--lp-badge-bg)', 
            color: 'var(--lp-badge-text)',
            border: '1px solid var(--lp-card-border)',
          }}
        >
          {data.badge}
        </span>
        <h2
          className="lp-gradient-text font-extrabold leading-tight mb-4"
          style={{ 
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(1.5rem, 2.8vw, 2.5rem)',
          }}
        >
          {data.title}
        </h2>
        <p className="text-base" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}>
          {data.subtitle}
        </p>
      </div>

      <div className={`relative grid gap-6 mx-auto max-w-[1140px] items-stretch ${colClass}`}>
        {data.cards.map((card, i) => (
          <div
            key={i}
            className={`lp-reveal lp-reveal-delay-${i + 1} rounded-2xl flex flex-col items-center text-center relative transition-all duration-500 hover:-translate-y-3 ${
              card.isFeatured ? 'scale-[1.04] z-10 lp-glow-pulse lp-animated-border' : ''
            }`}
            style={{
              background: card.isFeatured 
                ? 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)'
                : 'var(--lp-card-bg)',
              border: card.isFeatured
                ? '2px solid var(--lp-accent)'
                : '1px solid var(--lp-card-border)',
              boxShadow: card.isFeatured 
                ? '0 20px 60px var(--lp-shadow), 0 0 80px rgba(201,169,110,0.10)' 
                : '0 8px 32px var(--lp-shadow)',
              backdropFilter: 'blur(16px)',
              padding: card.isFeatured ? '2.5rem 2rem' : '2rem',
            }}
          >
            {/* Glass highlight */}
            <div 
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
            />

            {card.isFeatured && card.featuredBadge && (
              <div
                className="lp-cta-shimmer absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-xs font-bold whitespace-nowrap tracking-wide"
                style={{ 
                  background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
                  color: 'var(--lp-cta-text)',
                  boxShadow: '0 4px 24px rgba(201,169,110,0.25)',
                }}
              >
                {card.featuredBadge}
              </div>
            )}

            <h3
              className="text-lg font-bold mb-2 mt-2"
              style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
            >
              {card.name}
            </h3>

            {card.imageUrl && (
              <div className="my-5 relative group">
                <div 
                  className="absolute inset-0 rounded-full blur-[35px] opacity-[0.10] group-hover:opacity-[0.20] transition-opacity duration-500"
                  style={{ background: 'var(--lp-accent)' }}
                />
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="relative w-[180px] h-[180px] object-contain mx-auto transition-transform duration-500 group-hover:scale-110"
                  style={{ filter: `drop-shadow(0 15px 40px var(--lp-shadow))` }}
                />
              </div>
            )}

            <div className="w-full mt-auto">
              {card.discountPercent && (
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-3"
                  style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
                >
                  {card.discountPercent}% OFF
                </span>
              )}
              {card.compareAtPrice && (
                <p className="line-through text-sm my-1.5" style={{ color: 'var(--lp-price-old)' }}>
                  De {formatPriceBRL(card.compareAtPrice)}
                </p>
              )}
              <p
                className="font-extrabold my-2"
                style={{ 
                  color: 'var(--lp-price-current)', 
                  fontFamily: 'var(--lp-font-display)',
                  fontSize: card.isFeatured ? 'clamp(2.25rem, 3.2vw, 3rem)' : 'clamp(1.75rem, 2.5vw, 2.25rem)',
                }}
              >
                {formatPriceBRL(card.price)}
              </p>
              {card.installments && (
                <p className="text-xs mb-6" style={{ color: 'var(--lp-text-muted)' }}>
                  ou {card.installments}
                </p>
              )}
              <a
                href={card.ctaUrl}
                className="lp-cta-btn lp-cta-shimmer inline-block w-full px-8 py-4 rounded-xl text-base font-bold uppercase tracking-wide transition-all duration-300 hover:opacity-90 hover:-translate-y-1 text-center"
                style={{ 
                  background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
                  color: 'var(--lp-cta-text)',
                  boxShadow: '0 4px 24px var(--lp-shadow)',
                  letterSpacing: '0.08em',
                }}
              >
                {card.ctaText}
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
