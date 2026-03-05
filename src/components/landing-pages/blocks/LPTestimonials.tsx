import type { LPTestimonialsProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPTestimonialsProps;
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function LPTestimonials({ data }: Props) {
  return (
    <section className="relative overflow-hidden px-[5%] py-16 md:py-24" style={{ background: 'var(--lp-bg-alt)' }}>
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[150px] opacity-5 pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />
      
      <div className="relative text-center max-w-[700px] mx-auto mb-14">
        <span
          className="inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
          style={{ 
            background: 'var(--lp-badge-bg)', 
            color: 'var(--lp-badge-text)',
            border: '1px solid var(--lp-card-border)',
          }}
        >
          {data.badge}
        </span>
        <h2
          className="text-2xl md:text-4xl font-extrabold leading-tight mb-4"
          style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
        >
          {data.title}
        </h2>
        <p className="text-base" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}>
          {data.subtitle}
        </p>
      </div>
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
        {data.items.map((item, i) => (
          <div
            key={i}
            className="rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
            style={{ 
              background: 'var(--lp-card-bg)', 
              border: '1px solid var(--lp-card-border)',
              boxShadow: '0 4px 24px var(--lp-shadow)',
            }}
          >
            <div className="text-amber-400 text-lg mb-4 tracking-wider">{stars(item.rating)}</div>
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
            >
              "{item.comment}"
            </p>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-accent)' }}
              >
                {item.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--lp-text)' }}>
                {item.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
