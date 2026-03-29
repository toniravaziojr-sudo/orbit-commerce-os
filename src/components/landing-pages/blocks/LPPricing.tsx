import type { LPPricingProps } from '@/lib/landing-page-schema';
import { formatPriceBRL } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPPricingProps;
  variant?: string;
}

export function LPPricing({ data, variant = 'horizontal_3col' }: Props) {
  switch (variant) {
    case 'single_highlight':
      return <PricingSingleHighlight data={data} />;
    default:
      return <PricingHorizontal data={data} />;
  }
}

// ── VARIANT: horizontal_3col ──

function PricingHorizontal({ data }: { data: LPPricingProps }) {
  const revealRef = useLPScrollReveal();
  const colClass = data.cards.length === 1 ? 'max-w-[480px]' : data.cards.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-[900px]' : 'grid-cols-1 md:grid-cols-3';

  return (
    <section ref={revealRef} id="ofertas" className="relative overflow-hidden px-[5%] py-24 md:py-36 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      {/* Dramatic background glows */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.04 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 100%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.03 }} />

      <PricingHeader data={data} />
      <div className={`relative grid gap-7 mx-auto max-w-[1200px] items-end ${colClass}`}>
        {data.cards.map((card, i) => <PricingCard key={i} card={card} index={i} total={data.cards.length} />)}
      </div>
    </section>
  );
}

// ── VARIANT: single_highlight ──

function PricingSingleHighlight({ data }: { data: LPPricingProps }) {
  const revealRef = useLPScrollReveal();
  const featured = data.cards.find(c => c.isFeatured) || data.cards[0];
  const others = data.cards.filter(c => c !== featured);

  return (
    <section ref={revealRef} id="ofertas" className="relative overflow-hidden px-[5%] py-24 md:py-36 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 30%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.05 }} />
      <PricingHeader data={data} />

      {/* Featured card — hero-sized */}
      <div className="relative max-w-[560px] mx-auto mb-12 lp-reveal">
        <div
          className="rounded-[2rem] flex flex-col items-center text-center relative overflow-hidden transition-all duration-500 hover:-translate-y-3 p-10 md:p-14 lp-glass-card"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)',
            border: '2px solid var(--lp-accent)',
            boxShadow: '0 24px 80px var(--lp-shadow), 0 0 100px rgba(201,169,110,0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Top shine */}
          <div className="absolute top-0 left-[10%] right-[10%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
          {/* Corner glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.1 }} />

          {featured.featuredBadge && (
            <div className="lp-cta-shimmer absolute -top-4 left-1/2 -translate-x-1/2 px-8 py-2.5 rounded-full text-xs font-bold whitespace-nowrap tracking-[0.1em] uppercase" style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 6px 30px rgba(201,169,110,0.3)' }}>
              {featured.featuredBadge}
            </div>
          )}
          <h3 className="text-2xl font-bold mb-3 mt-3 tracking-[-0.01em]" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}>{featured.name}</h3>
          {featured.imageUrl && (
            <div className="my-6 relative group">
              <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.08, filter: 'blur(40px)' }} />
              <img src={featured.imageUrl} alt={featured.name} className="relative w-[200px] h-[200px] object-contain mx-auto transition-transform duration-500 group-hover:scale-110" style={{ filter: `drop-shadow(0 14px 40px var(--lp-shadow))` }} />
            </div>
          )}
          <PricingCardBody card={featured} large />
        </div>
      </div>

      {/* Other cards — smaller, in a row */}
      {others.length > 0 && (
        <div className={`relative grid gap-6 mx-auto max-w-[900px] items-stretch ${others.length === 1 ? 'max-w-[480px]' : 'grid-cols-1 md:grid-cols-2'}`}>
          {others.map((card, i) => <PricingCard key={i} card={card} index={i} total={others.length} />)}
        </div>
      )}
    </section>
  );
}

// ── Shared ──

function PricingHeader({ data }: { data: LPPricingProps }) {
  return (
    <div className="relative text-center max-w-[700px] mx-auto mb-20 lp-reveal">
      <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', color: 'var(--lp-badge-text)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}>
        <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
        {data.badge}
      </span>
      <h2 className="font-extrabold leading-[1.05] mb-4 tracking-[-0.02em]" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 3rem)', color: 'var(--lp-text)' }}>
        <span className="lp-gradient-text">{data.title}</span>
      </h2>
      <p className="text-base" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.7' }}>{data.subtitle}</p>
    </div>
  );
}

function PricingCard({ card, index, total }: { card: LPPricingProps['cards'][0]; index: number; total: number }) {
  const isFeatured = card.isFeatured;

  return (
    <div
      className={`lp-reveal lp-reveal-delay-${index + 1} rounded-[1.75rem] flex flex-col items-center text-center relative overflow-hidden transition-all duration-500 hover:-translate-y-3 lp-glass-card ${isFeatured ? 'z-10' : ''}`}
      style={{
        background: isFeatured
          ? 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: isFeatured ? '2px solid var(--lp-accent)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: isFeatured
          ? '0 20px 60px var(--lp-shadow), 0 0 80px rgba(201,169,110,0.10)'
          : '0 8px 32px var(--lp-shadow)',
        backdropFilter: 'blur(16px)',
        padding: isFeatured ? '2.5rem 2rem' : '2rem',
        transform: isFeatured ? 'scale(1.05)' : 'none',
      }}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,${isFeatured ? '0.20' : '0.08'}), transparent)` }} />

      {isFeatured && card.featuredBadge && (
        <div className="lp-cta-shimmer absolute -top-4 left-1/2 -translate-x-1/2 px-7 py-2 rounded-full text-xs font-bold whitespace-nowrap tracking-[0.1em] uppercase" style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 4px 24px rgba(201,169,110,0.25)' }}>
          {card.featuredBadge}
        </div>
      )}

      <h3 className="text-lg font-bold mb-2 mt-3 tracking-[-0.01em]" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}>{card.name}</h3>

      {card.imageUrl && (
        <div className="my-5 relative group">
          <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.06, filter: 'blur(30px)' }} />
          <img src={card.imageUrl} alt={card.name} className="relative w-[150px] h-[150px] object-contain mx-auto transition-transform duration-500 group-hover:scale-110" style={{ filter: `drop-shadow(0 10px 30px var(--lp-shadow))` }} />
        </div>
      )}
      <PricingCardBody card={card} />
    </div>
  );
}

function PricingCardBody({ card, large }: { card: LPPricingProps['cards'][0]; large?: boolean }) {
  return (
    <div className="w-full mt-auto">
      {card.discountPercent && (
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-3" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>{card.discountPercent}% OFF</span>
      )}
      {card.compareAtPrice && (
        <p className="line-through text-sm my-1.5" style={{ color: 'var(--lp-price-old)' }}>De {formatPriceBRL(card.compareAtPrice)}</p>
      )}
      <p className="font-extrabold my-3 tracking-[-0.02em]" style={{ color: 'var(--lp-price-current)', fontFamily: 'var(--lp-font-display)', fontSize: large ? 'clamp(2.75rem, 4vw, 3.5rem)' : card.isFeatured ? 'clamp(2.25rem, 3.2vw, 3rem)' : 'clamp(2rem, 2.8vw, 2.5rem)' }}>
        {formatPriceBRL(card.price)}
      </p>
      {card.installments && (
        <p className="text-xs mb-7" style={{ color: 'var(--lp-text-muted)' }}>ou {card.installments}</p>
      )}
      <a
        href={card.ctaUrl}
        className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-2 w-full px-8 py-4.5 rounded-2xl text-base font-bold uppercase tracking-[0.08em] transition-all duration-500 hover:-translate-y-1"
        style={{
          background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`,
          color: 'var(--lp-cta-text)',
          boxShadow: '0 8px 32px var(--lp-shadow), 0 0 40px rgba(201,169,110,0.08)',
        }}
      >
        {card.ctaText}
        <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
      </a>
    </div>
  );
}