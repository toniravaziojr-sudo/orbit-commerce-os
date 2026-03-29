import type { LPBenefitsProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPBenefitsProps;
  variant?: string;
}

export function LPBenefits({ data, variant = 'alternating_rows' }: Props) {
  const hasAnyImage = data.items.some(item => !!item.imageUrl);
  const effectiveVariant = (!hasAnyImage && variant !== 'icon_list') ? 'icon_list' : variant;

  switch (effectiveVariant) {
    case 'grid_cards':
      return <BenefitsBento data={data} />;
    case 'icon_list':
      return <BenefitsIconList data={data} />;
    default:
      return <BenefitsAlternatingRows data={data} />;
  }
}

// ── VARIANT: alternating_rows (editorial magazine style) ──

function BenefitsAlternatingRows({ data }: { data: LPBenefitsProps }) {
  const revealRef = useLPScrollReveal();

  return (
    <div ref={revealRef}>
      {data.items.map((item, i) => {
        const isReverse = i % 2 !== 0;
        const hasImage = !!item.imageUrl;

        return (
          <section
            key={i}
            className="relative overflow-hidden px-[5%] py-20 md:py-32 lp-noise"
            style={{ background: i % 2 === 0 ? 'var(--lp-bg)' : 'var(--lp-bg-alt)' }}
          >
            {/* Decorative accent line */}
            <div className="absolute top-0 left-[5%] w-16 h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, var(--lp-accent), transparent)`, opacity: 0.4 }} />
            {/* Glow */}
            <div className="absolute rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, width: '500px', height: '500px', top: '50%', transform: 'translateY(-50%)', [isReverse ? 'left' : 'right']: '-200px', opacity: 0.04, filter: 'blur(80px)' }} />

            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 items-center max-w-[1200px] mx-auto">
              {/* Text */}
              <div className={`lp-reveal lp-reveal-delay-${i % 2 === 0 ? 1 : 2} ${isReverse ? 'md:order-2' : ''}`}>
                {/* Step indicator */}
                <div className="flex items-center gap-4 mb-6">
                  <span
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                      color: 'var(--lp-accent)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 0 30px rgba(201,169,110,0.06)',
                    }}
                  >
                    0{i + 1}
                  </span>
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: 'var(--lp-accent)' }}
                  >
                    {item.label}
                  </span>
                </div>

                <h2
                  className="font-bold leading-[1.08] mb-5 tracking-[-0.02em]"
                  style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.75rem)' }}
                >
                  {item.title}
                </h2>
                <p
                  className="text-base leading-relaxed max-w-[480px]"
                  style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.8' }}
                >
                  {item.description}
                </p>

                {/* Decorative line */}
                <div className="mt-8 h-[1px] w-20" style={{ background: `linear-gradient(90deg, var(--lp-accent), transparent)`, opacity: 0.3 }} />
              </div>

              {/* Image */}
              <div className={`flex justify-center lp-scale-in ${isReverse ? 'md:order-1' : ''} order-first md:order-none`}>
                {hasImage ? (
                  <div className="relative group w-full max-w-[480px]">
                    {/* Glow behind image */}
                    <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, filter: 'blur(60px)', opacity: 0.08 }} />
                    <div
                      className="relative overflow-hidden rounded-3xl transition-transform duration-700 group-hover:scale-[1.02]"
                      style={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 20px 60px var(--lp-shadow), 0 0 0 1px rgba(255,255,255,0.04)',
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        className="w-full h-auto object-cover"
                        style={{ aspectRatio: '4/3' }}
                        onError={(e) => { (e.currentTarget.parentElement!.parentElement as HTMLElement).style.display = 'none'; }}
                      />
                      {/* Glass overlay on bottom */}
                      <div className="absolute bottom-0 left-0 right-0 h-1/3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }} />
                    </div>
                  </div>
                ) : (
                  <FallbackArt label={item.label} index={i} />
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── VARIANT: grid_cards (Bento grid) ──

function BenefitsBento({ data }: { data: LPBenefitsProps }) {
  const revealRef = useLPScrollReveal();

  return (
    <section ref={revealRef} className="relative overflow-hidden px-[5%] py-20 md:py-32 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      {/* Mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(at 20% 20%, var(--lp-accent) 0%, transparent 50%), radial-gradient(at 80% 80%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.03 }} />

      <div className="relative max-w-[1200px] mx-auto">
        {/* Bento grid - first item large, rest smaller */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {data.items.map((item, i) => {
            const isLarge = i === 0;
            const colSpan = isLarge ? 'md:col-span-7' : data.items.length === 2 ? 'md:col-span-5' : i <= 2 ? 'md:col-span-5' : 'md:col-span-4';

            return (
              <div
                key={i}
                className={`lp-reveal lp-reveal-delay-${Math.min(i + 1, 4)} ${colSpan} rounded-3xl relative overflow-hidden group transition-all duration-500 hover:-translate-y-2 lp-glass-card`}
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 40px var(--lp-shadow)',
                  backdropFilter: 'blur(16px)',
                  padding: isLarge ? '2.5rem' : '2rem',
                  minHeight: isLarge ? '320px' : '260px',
                }}
              >
                {/* Top shine line */}
                <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />
                
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none" style={{ background: `radial-gradient(circle at 100% 0%, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.06 }} />

                {/* Number */}
                <span
                  className="absolute top-6 right-6 text-[4rem] font-black leading-none pointer-events-none select-none"
                  style={{ color: 'var(--lp-accent)', opacity: 0.06, fontFamily: 'var(--lp-font-display)' }}
                >
                  0{i + 1}
                </span>

                {item.imageUrl ? (
                  <div className="relative mb-5 overflow-hidden rounded-2xl" style={{ maxHeight: isLarge ? '200px' : '140px' }}>
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--lp-accent)' }}>
                    {['✦', '◆', '★', '●', '▲', '♦'][i % 6]}
                  </div>
                )}

                <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--lp-accent)' }}>{item.label}</span>
                <h3 className="font-bold mb-3 tracking-[-0.01em]" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)', fontSize: isLarge ? 'clamp(1.25rem, 2vw, 1.75rem)' : '1.125rem' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}>{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── VARIANT: icon_list (elegant vertical) ──

function BenefitsIconList({ data }: { data: LPBenefitsProps }) {
  const revealRef = useLPScrollReveal();

  return (
    <section ref={revealRef} className="relative overflow-hidden px-[5%] py-20 md:py-32 lp-noise" style={{ background: 'var(--lp-bg)' }}>
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 60%)`, opacity: 0.04, filter: 'blur(120px)' }} />
      
      <div className="relative max-w-[800px] mx-auto">
        {data.items.map((item, i) => (
          <div
            key={i}
            className={`lp-reveal lp-reveal-delay-${Math.min(i + 1, 4)} flex gap-8 items-start py-10 relative`}
            style={{ borderBottom: i < data.items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            {/* Vertical line connector */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold relative"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--lp-accent)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 0 30px rgba(201,169,110,0.06)',
                }}
              >
                0{i + 1}
              </div>
            </div>

            <div className="flex-1">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--lp-accent)' }}>{item.label}</span>
              <h3 className="font-bold text-xl mb-3 tracking-[-0.01em]" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.8' }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Shared ──

function FallbackArt({ label, index }: { label: string; index: number }) {
  return (
    <div className="relative w-full max-w-[480px] aspect-[4/3] rounded-3xl overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 30%, var(--lp-accent) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, var(--lp-card-bg) 0%, transparent 50%), linear-gradient(135deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)`, opacity: 0.3 }} />
      <div className="absolute inset-0 rounded-3xl" style={{ border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }} />
      <div className="relative flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 40px var(--lp-shadow)' }}>
          <span className="text-3xl" style={{ color: 'var(--lp-accent)' }}>{index === 0 ? '✦' : index === 1 ? '◆' : '★'}</span>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-display)' }}>{label}</span>
      </div>
    </div>
  );
}