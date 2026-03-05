import type { LPBenefitsProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPBenefitsProps;
}

export function LPBenefits({ data }: Props) {
  return (
    <>
      {data.items.map((item, i) => {
        const isReverse = i % 2 !== 0;
        return (
          <section
            key={i}
            className="relative overflow-hidden px-[5%] py-16 md:py-24"
            style={{ background: i % 2 === 0 ? 'var(--lp-bg)' : 'var(--lp-bg-alt)' }}
          >
            {/* Radial accent glow */}
            <div 
              className="absolute opacity-[0.06] blur-[120px] pointer-events-none rounded-full"
              style={{ 
                background: 'var(--lp-accent)',
                width: '450px',
                height: '450px',
                top: '50%',
                transform: 'translateY(-50%)',
                [isReverse ? 'left' : 'right']: '-120px',
              }}
            />
            
            <div
              className={`relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-center max-w-[1140px] mx-auto`}
            >
              <div className={isReverse ? 'md:order-2' : ''}>
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
                  style={{ 
                    background: 'var(--lp-badge-bg)', 
                    color: 'var(--lp-badge-text)',
                    border: '1px solid var(--lp-card-border)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {item.label}
                </span>
                <h2
                  className="font-bold leading-tight mb-5"
                  style={{ 
                    color: 'var(--lp-text)', 
                    fontFamily: 'var(--lp-font-display)',
                    fontSize: 'clamp(1.5rem, 2.6vw, 2.125rem)',
                  }}
                >
                  {item.title}
                </h2>
                <p
                  className="text-base leading-relaxed max-w-[480px]"
                  style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
                >
                  {item.description}
                </p>
              </div>
              <div className={`flex justify-center ${isReverse ? 'md:order-1' : ''} order-first md:order-none`}>
                {item.imageUrl && (
                  <div className="relative group">
                    <div 
                      className="absolute inset-0 rounded-3xl blur-[40px] opacity-[0.08] group-hover:opacity-[0.15] transition-opacity"
                      style={{ background: 'var(--lp-accent)' }}
                    />
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="relative w-full max-w-[420px] h-auto object-contain rounded-3xl transition-transform duration-500 group-hover:scale-[1.02]"
                      style={{ filter: `drop-shadow(0 20px 60px var(--lp-shadow))` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
