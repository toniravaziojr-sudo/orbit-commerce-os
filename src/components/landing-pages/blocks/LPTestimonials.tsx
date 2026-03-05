import type { LPTestimonialsProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPTestimonialsProps;
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function LPTestimonials({ data }: Props) {
  const revealRef = useLPScrollReveal();
  const useMarquee = data.items.length > 3;

  return (
    <section ref={revealRef} className="relative overflow-hidden px-[5%] py-16 md:py-24 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[200px] opacity-[0.06] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      
      <div className="relative text-center max-w-[700px] mx-auto mb-14 lp-reveal">
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
          className="font-extrabold leading-tight mb-4"
          style={{ 
            color: 'var(--lp-text)', 
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
          }}
        >
          {data.title}
        </h2>
        <p className="text-base" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}>
          {data.subtitle}
        </p>
      </div>

      {useMarquee ? (
        <div className="relative overflow-hidden max-w-[1200px] mx-auto">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--lp-bg-alt), transparent)' }} />
          <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, var(--lp-bg-alt), transparent)' }} />
          <div className="lp-marquee">
            {[...data.items, ...data.items].map((item, i) => (
              <TestimonialCard key={i} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1140px] mx-auto">
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

function TestimonialCard({ item }: { item: { name: string; comment: string; rating: number } }) {
  return (
    <div
      className="rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 relative flex-shrink-0"
      style={{ 
        background: 'var(--lp-card-bg)', 
        border: '1px solid var(--lp-card-border)',
        boxShadow: '0 8px 32px var(--lp-shadow)',
        backdropFilter: 'blur(12px)',
        width: '340px',
        marginRight: '1.5rem',
      }}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
      />
      <div className="text-amber-400 text-lg mb-4 tracking-wider">{stars(item.rating)}</div>
      <p
        className="text-sm leading-relaxed mb-6"
        style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}
      >
        "{item.comment}"
      </p>
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ 
            background: 'var(--lp-badge-bg)', 
            color: 'var(--lp-accent)',
            border: '1px solid var(--lp-card-border)',
          }}
        >
          {item.name.charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--lp-text)' }}>
          {item.name}
        </p>
      </div>
    </div>
  );
}
