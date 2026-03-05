import type { LPGuaranteeProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPGuaranteeProps;
}

export function LPGuarantee({ data }: Props) {
  const revealRef = useLPScrollReveal();

  return (
    <section ref={revealRef} className="px-[5%] py-16 md:py-24 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      <div 
        className="lp-reveal max-w-[700px] mx-auto text-center rounded-2xl p-10 md:p-14 relative overflow-hidden lp-animated-border"
        style={{ 
          background: 'var(--lp-card-bg)',
          border: '1px solid var(--lp-card-border)',
          boxShadow: '0 20px 80px var(--lp-shadow)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Glass highlight */}
        <div 
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
        />
        
        {/* Shield icon with glow */}
        <div 
          className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl relative"
          style={{ 
            background: 'var(--lp-badge-bg)',
            border: '2px solid var(--lp-accent)',
            boxShadow: '0 0 50px rgba(201,169,110,0.15)',
          }}
        >
          <div 
            className="absolute inset-0 rounded-full blur-[20px] opacity-20"
            style={{ background: 'var(--lp-accent)' }}
          />
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
          style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}
        >
          {data.description}
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          {data.badges.map((badge, i) => (
            <span
              key={i}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
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
