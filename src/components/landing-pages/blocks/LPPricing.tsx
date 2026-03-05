import type { LPPricingProps } from '@/lib/landing-page-schema';
import { formatPriceBRL } from '@/lib/landing-page-schema';

interface Props {
  data: LPPricingProps;
}

export function LPPricing({ data }: Props) {
  const colClass =
    data.cards.length === 1 ? 'max-w-[400px]' :
    data.cards.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-[800px]' :
    'grid-cols-1 md:grid-cols-3';

  return (
    <section
      id="ofertas"
      className="px-[5%] py-12 md:py-20"
      style={{ background: 'var(--lp-bg-alt)' }}
    >
      <div className="text-center max-w-[700px] mx-auto mb-12">
        <span
          className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
          style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
        >
          {data.badge}
        </span>
        <h2
          className="text-2xl md:text-4xl font-extrabold leading-tight mb-3"
          style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
        >
          {data.title}
        </h2>
        <p className="text-base" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}>
          {data.subtitle}
        </p>
      </div>
      <div className={`grid gap-6 mx-auto max-w-[1100px] items-stretch ${colClass}`}>
        {data.cards.map((card, i) => (
          <div
            key={i}
            className={`rounded-2xl p-8 flex flex-col items-center text-center relative transition-transform hover:-translate-y-1 ${
              card.isFeatured ? 'scale-105 z-10 md:scale-105' : ''
            }`}
            style={{
              background: 'var(--lp-card-bg)',
              border: card.isFeatured
                ? '2px solid var(--lp-accent)'
                : '1px solid var(--lp-card-border)',
              boxShadow: card.isFeatured ? '0 20px 60px var(--lp-shadow)' : undefined,
            }}
          >
            {card.isFeatured && card.featuredBadge && (
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                style={{ background: 'var(--lp-accent)', color: 'var(--lp-cta-text)' }}
              >
                {card.featuredBadge}
              </div>
            )}
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
            >
              {card.name}
            </h3>
            {card.imageUrl && (
              <div className="my-4">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-[180px] h-[180px] object-contain mx-auto"
                  style={{ filter: `drop-shadow(0 10px 20px var(--lp-shadow))` }}
                />
              </div>
            )}
            <div className="w-full">
              {card.discountPercent && (
                <span
                  className="inline-block px-3.5 py-1 rounded-xl text-xs font-bold mb-2"
                  style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
                >
                  {card.discountPercent}% OFF
                </span>
              )}
              {card.compareAtPrice && (
                <p className="line-through text-sm my-1" style={{ color: 'var(--lp-price-old)' }}>
                  De {formatPriceBRL(card.compareAtPrice)}
                </p>
              )}
              <p
                className="text-3xl md:text-4xl font-extrabold my-1"
                style={{ color: 'var(--lp-price-current)', fontFamily: 'var(--lp-font-display)' }}
              >
                {formatPriceBRL(card.price)}
              </p>
              {card.installments && (
                <p className="text-xs mb-5" style={{ color: 'var(--lp-text-muted)' }}>
                  ou {card.installments}
                </p>
              )}
              <a
                href={card.ctaUrl}
                className="inline-block w-full px-8 py-4 rounded-lg text-base font-bold uppercase tracking-wide transition-all hover:opacity-90 hover:-translate-y-0.5 text-center"
                style={{ background: 'var(--lp-cta-bg)', color: 'var(--lp-cta-text)' }}
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
