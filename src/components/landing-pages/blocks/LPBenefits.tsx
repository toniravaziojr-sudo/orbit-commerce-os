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
            {/* Subtle accent glow */}
            <div 
              className="absolute opacity-5 blur-[100px] pointer-events-none rounded-full"
              style={{ 
                background: 'var(--lp-accent)',
                width: '400px',
                height: '400px',
                top: '50%',
                transform: 'translateY(-50%)',
                [isReverse ? 'left' : 'right']: '-100px',
              }}
            />
            
            <div
              className={`relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-center max-w-[1100px] mx-auto`}
            >
              <div className={isReverse ? 'md:order-2' : ''}>
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
                  style={{ 
                    background: 'var(--lp-badge-bg)', 
                    color: 'var(--lp-badge-text)',
                    border: '1px solid var(--lp-card-border)',
                  }}
                >
                  {item.label}
                </span>
                <h2
                  className="text-2xl md:text-[2.2rem] font-bold leading-tight mb-5"
                  style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
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
                      className="absolute inset-0 rounded-2xl blur-[30px] opacity-10 group-hover:opacity-20 transition-opacity"
                      style={{ background: 'var(--lp-accent)' }}
                    />
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="relative w-full max-w-[420px] h-auto object-contain rounded-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                      style={{ filter: `drop-shadow(0 15px 40px var(--lp-shadow))` }}
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
