import type { LPTestimonialsProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPTestimonialsProps;
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function LPTestimonials({ data }: Props) {
  return (
    <section className="px-[5%] py-12 md:py-20" style={{ background: 'var(--lp-bg-alt)' }}>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
        {data.items.map((item, i) => (
          <div
            key={i}
            className="rounded-2xl p-7"
            style={{ background: 'var(--lp-card-bg)', border: '1px solid var(--lp-card-border)' }}
          >
            <div className="text-amber-400 text-lg mb-3">{stars(item.rating)}</div>
            <p
              className="text-sm leading-relaxed mb-4 italic"
              style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
            >
              "{item.comment}"
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--lp-text)' }}>
              — {item.name}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
