import type { LPGuaranteeProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPGuaranteeProps;
}

export function LPGuarantee({ data }: Props) {
  const revealRef = useLPScrollReveal();

  return (
    <section ref={revealRef} className="px-[5%] py-24 md:py-36 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      <div
        className="lp-reveal max-w-[720px] mx-auto text-center rounded-[2rem] p-12 md:p-16 relative overflow-hidden lp-glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px var(--lp-shadow)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Top shine */}
        <div className="absolute top-0 left-[10%] right-[10%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
        {/* Corner glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.08 }} />

        {/* Shield icon */}
        <div
          className="w-20 h-20 rounded-2xl mx-auto mb-8 flex items-center justify-center text-4xl relative"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 0 50px rgba(201,169,110,0.1)',
          }}
        >
          <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.08, filter: 'blur(20px)' }} />
          🛡️
        </div>
        <h2
          className="font-extrabold leading-tight mb-6 tracking-[-0.02em]"
          style={{
            color: 'var(--lp-text)',
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)',
          }}
        >
          {data.title}
        </h2>
        <p
          className="text-base leading-relaxed mb-10 max-w-[520px] mx-auto"
          style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.8' }}
        >
          {data.description}
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          {data.badges.map((badge, i) => (
            <span
              key={i}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                color: 'var(--lp-badge-text)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
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