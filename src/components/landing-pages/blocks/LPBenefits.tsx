import type { LPBenefitsProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPBenefitsProps;
}

export function LPBenefits({ data }: Props) {
  const revealRef = useLPScrollReveal();

  return (
    <div ref={revealRef}>
      {data.items.map((item, i) => {
        const isReverse = i % 2 !== 0;
        const hasImage = !!item.imageUrl;

        return (
          <section
            key={i}
            className="relative overflow-hidden px-[5%] py-16 md:py-24 lp-noise"
            style={{ background: i % 2 === 0 ? 'var(--lp-bg)' : 'var(--lp-bg-alt)' }}
          >
            {/* Accent glow */}
            <div 
              className="absolute opacity-[0.07] blur-[120px] pointer-events-none rounded-full"
              style={{ 
                background: 'var(--lp-accent)',
                width: '500px',
                height: '500px',
                top: '50%',
                transform: 'translateY(-50%)',
                [isReverse ? 'left' : 'right']: '-150px',
              }}
            />
            
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-center max-w-[1140px] mx-auto">
              <div className={`lp-reveal lp-reveal-delay-${i % 2 === 0 ? 1 : 2} ${isReverse ? 'md:order-2' : ''}`}>
                <span
                  className="lp-badge-pulse inline-block px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
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
                    fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)',
                  }}
                >
                  {item.title}
                </h2>
                <p
                  className="text-base leading-relaxed max-w-[480px]"
                  style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}
                >
                  {item.description}
                </p>
              </div>

              {/* Visual column — premium art fallback when no scene image */}
              <div className={`flex justify-center lp-scale-in ${isReverse ? 'md:order-1' : ''} order-first md:order-none`}>
                {hasImage ? (
                  /* Has a scene/creative image — render with glow */
                  <div className="relative group">
                    <div 
                      className="absolute inset-0 rounded-3xl blur-[50px] opacity-[0.10] group-hover:opacity-[0.20] transition-opacity duration-500"
                      style={{ background: 'var(--lp-accent)' }}
                    />
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="relative w-full max-w-[420px] h-auto object-contain rounded-3xl transition-transform duration-700 group-hover:scale-[1.03]"
                      style={{ filter: `drop-shadow(0 25px 60px var(--lp-shadow))` }}
                      onError={(e) => {
                        // Hide broken images, show fallback art
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                        const fallback = (e.currentTarget.parentElement?.parentElement?.querySelector('.lp-benefit-fallback-art') as HTMLElement);
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  </div>
                ) : null}

                {/* Premium fallback art — shown when no image or image is catalog (blocked) */}
                <div 
                  className="lp-benefit-fallback-art relative w-full max-w-[420px] aspect-[4/3] rounded-3xl overflow-hidden items-center justify-center"
                  style={{ display: hasImage ? 'none' : 'flex' }}
                >
                  {/* Layered premium background */}
                  <div className="absolute inset-0" style={{
                    background: `
                      radial-gradient(ellipse at 30% 30%, var(--lp-accent) 0%, transparent 60%),
                      radial-gradient(ellipse at 70% 70%, var(--lp-card-bg) 0%, transparent 50%),
                      linear-gradient(135deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)
                    `,
                    opacity: 0.4,
                  }} />
                  <div className="absolute inset-0 rounded-3xl" style={{
                    border: '1px solid var(--lp-card-border)',
                    backdropFilter: 'blur(20px)',
                  }} />
                  {/* Decorative icon */}
                  <div className="relative flex flex-col items-center gap-4">
                    <div 
                      className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ 
                        background: 'var(--lp-badge-bg)',
                        border: '2px solid var(--lp-card-border)',
                        boxShadow: '0 0 40px var(--lp-shadow), 0 0 80px rgba(201,169,110,0.08)',
                      }}
                    >
                      <span className="text-3xl" style={{ color: 'var(--lp-accent)' }}>
                        {i === 0 ? '✦' : i === 1 ? '◆' : '★'}
                      </span>
                    </div>
                    <span 
                      className="text-xs font-bold uppercase tracking-[0.15em]"
                      style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-display)' }}
                    >
                      {item.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div 
              className="absolute bottom-0 left-[10%] right-[10%] h-px"
              style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }}
            />
          </section>
        );
      })}
    </div>
  );
}
