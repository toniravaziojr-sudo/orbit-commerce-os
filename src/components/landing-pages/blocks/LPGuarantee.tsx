import type { LPGuaranteeProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPGuaranteeProps;
}

export function LPGuarantee({ data }: Props) {
  return (
    <section className="px-[5%] py-12 md:py-20" style={{ background: 'var(--lp-bg-alt)' }}>
      <div className="max-w-[700px] mx-auto text-center">
        <div className="text-5xl mb-5">🛡️</div>
        <h2
          className="text-2xl md:text-4xl font-extrabold leading-tight mb-4"
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
        <div className="flex justify-center gap-4 flex-wrap">
          {data.badges.map((badge, i) => (
            <span
              key={i}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
