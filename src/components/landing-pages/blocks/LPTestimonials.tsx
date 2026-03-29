import type { LPTestimonialsProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPTestimonialsProps;
  variant?: string;
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function LPTestimonials({ data, variant = 'cards' }: Props) {
  switch (variant) {
    case 'quote_wall':
      return <TestimonialsQuoteWall data={data} />;
    default:
      return <TestimonialsCards data={data} />;
  }
}

// ── VARIANT: cards (marquee or grid) ──

function TestimonialsCards({ data }: { data: LPTestimonialsProps }) {
  const revealRef = useLPScrollReveal();
  const useMarquee = data.items.length > 3;

  return (
    <section ref={revealRef} className="relative overflow-hidden px-[5%] py-24 md:py-36 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.03 }} />

      <SectionHeader badge={data.badge} title={data.title} subtitle={data.subtitle} />

      {useMarquee ? (
        <div className="relative overflow-hidden max-w-[1200px] mx-auto">
          <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(to right, var(--lp-bg-alt), transparent)` }} />
          <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(to left, var(--lp-bg-alt), transparent)` }} />
          <div className="lp-marquee">
            {[...data.items, ...data.items].map((item, i) => (
              <TestimonialCard key={i} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1200px] mx-auto">
          {data.items.map((item, i) => (
            <div key={i} className={`lp-reveal lp-reveal-delay-${i + 1}`}>
              <TestimonialCard item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── VARIANT: quote_wall (editorial) ──

function TestimonialsQuoteWall({ data }: { data: LPTestimonialsProps }) {
  const revealRef = useLPScrollReveal();

  return (
    <section ref={revealRef} className="relative overflow-hidden px-[5%] py-24 md:py-36 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 30% 50%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.03 }} />
      <SectionHeader badge={data.badge} title={data.title} subtitle={data.subtitle} />

      <div className="relative max-w-[800px] mx-auto space-y-6">
        {data.items.slice(0, 5).map((item, i) => (
          <div
            key={i}
            className={`lp-reveal lp-reveal-delay-${Math.min(i + 1, 4)} rounded-[1.5rem] p-8 md:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-1 lp-glass-card`}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 32px var(--lp-shadow)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Top shine */}
            <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
            {/* Accent line left */}
            <div className="absolute top-6 bottom-6 left-0 w-[3px] rounded-full" style={{ background: `linear-gradient(180deg, var(--lp-accent), transparent)`, opacity: 0.3 }} />

            {/* Large quote mark */}
            <span className="text-6xl leading-none font-serif block mb-4 select-none" style={{ color: 'var(--lp-accent)', opacity: 0.15, fontFamily: 'Georgia, serif' }}>"</span>
            <p className="text-base md:text-lg leading-relaxed mb-6" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.8' }}>
              {item.comment}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                    color: 'var(--lp-accent)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--lp-text)' }}>{item.name}</p>
                  <div className="text-amber-400 text-xs tracking-wider mt-0.5">{stars(item.rating)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Shared ──

function SectionHeader({ badge, title, subtitle }: { badge: string; title: string; subtitle: string }) {
  return (
    <div className="relative text-center max-w-[700px] mx-auto mb-16 lp-reveal">
      <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', color: 'var(--lp-badge-text)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}>
        <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
        {badge}
      </span>
      <h2 className="font-extrabold leading-[1.05] mb-4 tracking-[-0.02em]" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.75rem)' }}>
        <span className="lp-gradient-text">{title}</span>
      </h2>
      <p className="text-base" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.7' }}>{subtitle}</p>
    </div>
  );
}

function TestimonialCard({ item }: { item: { name: string; comment: string; rating: number } }) {
  return (
    <div
      className="rounded-[1.5rem] p-8 transition-all duration-500 hover:-translate-y-1.5 relative flex-shrink-0 overflow-hidden lp-glass-card"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px var(--lp-shadow)',
        backdropFilter: 'blur(16px)',
        width: '360px',
        marginRight: '1.5rem',
      }}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
      
      <div className="text-amber-400 text-lg mb-4 tracking-wider">{stars(item.rating)}</div>
      <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.8' }}>"{item.comment}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', color: 'var(--lp-accent)', border: '1px solid rgba(255,255,255,0.1)' }}>{item.name.charAt(0).toUpperCase()}</div>
        <p className="text-sm font-semibold" style={{ color: 'var(--lp-text)' }}>{item.name}</p>
      </div>
    </div>
  );
}