import type { LPGuaranteeProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPGuaranteeProps;
}

export function LPGuarantee({ data }: Props) {
  return (
    <section className="px-[5%] py-16 md:py-24" style={{ background: 'var(--lp-bg-alt)' }}>
      <div 
        className="max-w-[700px] mx-auto text-center rounded-2xl p-10 md:p-14 relative overflow-hidden"
        style={{ 
          background: 'var(--lp-card-bg)',
          border: '1px solid var(--lp-card-border)',
          boxShadow: '0 20px 60px var(--lp-shadow)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Glass highlight */}
        <div 
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }}
        />
        
        <div 
          className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
          style={{ 
            background: 'var(--lp-badge-bg)',
            border: '2px solid var(--lp-accent)',
            boxShadow: '0 0 40px rgba(201,169,110,0.1)',
          }}
        >
          🛡️
        </div>
        <h2
          className="font-extrabold leading-tight mb-5"
          style={{ 
            color: 'var(--lp-text)', 
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(1.375rem, 2.2vw, 1.875rem)',
          }}
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
