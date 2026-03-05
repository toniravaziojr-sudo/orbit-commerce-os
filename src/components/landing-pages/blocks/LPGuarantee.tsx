import type { LPGuaranteeProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPGuaranteeProps;
}

export function LPGuarantee({ data }: Props) {
  return (
    <section className="px-[5%] py-16 md:py-24" style={{ background: 'var(--lp-bg-alt)' }}>
      <div 
        className="max-w-[700px] mx-auto text-center rounded-2xl p-10 md:p-14"
        style={{ 
          background: 'var(--lp-card-bg)',
          border: '1px solid var(--lp-card-border)',
          boxShadow: '0 8px 40px var(--lp-shadow)',
        }}
      >
        <div 
          className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
          style={{ 
            background: 'var(--lp-badge-bg)',
            border: '2px solid var(--lp-accent)',
          }}
        >
          🛡️
        </div>
        <h2
          className="text-2xl md:text-3xl font-extrabold leading-tight mb-5"
          style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
        >
          {data.title}
        </h2>
        <p
          className="text-base leading-relaxed mb-8 max-w-[520px] mx-auto"
          style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
        >
          {data.description}
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          {data.badges.map((badge, i) => (
            <span
              key={i}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ 
                background: 'var(--lp-badge-bg)', 
                color: 'var(--lp-badge-text)',
                border: '1px solid var(--lp-card-border)',
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
