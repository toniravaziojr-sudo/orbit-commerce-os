import type { LPBenefitsProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPBenefitsProps;
  variant?: string;
}

export function LPBenefits({ data, variant = 'alternating_rows' }: Props) {
  // Auto-fallback: if no images, force icon_list
  const hasAnyImage = data.items.some(item => !!item.imageUrl);
  const effectiveVariant = (!hasAnyImage && variant !== 'icon_list') ? 'icon_list' : variant;

  switch (effectiveVariant) {
    case 'grid_cards':
      return <BenefitsGridCards data={data} />;
    case 'icon_list':
      return <BenefitsIconList data={data} />;
    default:
      return <BenefitsAlternatingRows data={data} />;
  }
}

// ── VARIANT: alternating_rows (original V7) ──

function BenefitsAlternatingRows({ data }: { data: LPBenefitsProps }) {
  const revealRef = useLPScrollReveal();

  return (
    <div ref={revealRef}>
      {data.items.map((item, i) => {
        const isReverse = i % 2 !== 0;
        const hasImage = !!item.imageUrl;

        return (
          <section key={i} className="relative overflow-hidden px-[5%] py-16 md:py-24 lp-noise" style={{ background: i % 2 === 0 ? 'var(--lp-bg)' : 'var(--lp-bg-alt)' }}>
            <div className="absolute opacity-[0.07] blur-[120px] pointer-events-none rounded-full" style={{ background: 'var(--lp-accent)', width: '500px', height: '500px', top: '50%', transform: 'translateY(-50%)', [isReverse ? 'left' : 'right']: '-150px' }} />
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-center max-w-[1140px] mx-auto">
              <div className={`lp-reveal lp-reveal-delay-${i % 2 === 0 ? 1 : 2} ${isReverse ? 'md:order-2' : ''}`}>
                <span className="lp-badge-pulse inline-block px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5" style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)', border: '1px solid var(--lp-card-border)', backdropFilter: 'blur(8px)' }}>{item.label}</span>
                <h2 className="font-bold leading-tight mb-5" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)' }}>{item.title}</h2>
                <p className="text-base leading-relaxed max-w-[480px]" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}>{item.description}</p>
              </div>
              <div className={`flex justify-center lp-scale-in ${isReverse ? 'md:order-1' : ''} order-first md:order-none`}>
                {hasImage ? (
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-3xl blur-[50px] opacity-[0.10] group-hover:opacity-[0.20] transition-opacity duration-500" style={{ background: 'var(--lp-accent)' }} />
                    <img src={item.imageUrl} alt={item.label} className="relative w-full max-w-[420px] h-auto object-contain rounded-3xl transition-transform duration-700 group-hover:scale-[1.03]" style={{ filter: `drop-shadow(0 25px 60px var(--lp-shadow))` }}
                      onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; const fb = (e.currentTarget.parentElement?.parentElement?.querySelector('.lp-benefit-fallback-art') as HTMLElement); if (fb) fb.style.display = 'flex'; }}
                    />
                  </div>
                ) : null}
                <FallbackArt label={item.label} index={i} show={!hasImage} />
              </div>
            </div>
            <div className="absolute bottom-0 left-[10%] right-[10%] h-px" style={{ background: `linear-gradient(90deg, transparent, var(--lp-divider), transparent)` }} />
          </section>
        );
      })}
    </div>
  );
}

// ── VARIANT: grid_cards ──

function BenefitsGridCards({ data }: { data: LPBenefitsProps }) {
  const revealRef = useLPScrollReveal();

  return (
    <section ref={revealRef} className="relative overflow-hidden px-[5%] py-16 md:py-24 lp-noise" style={{ background: 'var(--lp-bg-alt)' }}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[200px] opacity-[0.06] pointer-events-none" style={{ background: 'var(--lp-accent)' }} />
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1140px] mx-auto">
        {data.items.map((item, i) => (
          <div
            key={i}
            className={`lp-reveal lp-reveal-delay-${i + 1} rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden`}
            style={{ background: 'var(--lp-card-bg)', border: '1px solid var(--lp-card-border)', boxShadow: '0 8px 32px var(--lp-shadow)', backdropFilter: 'blur(12px)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.label} className="w-full h-[180px] object-cover rounded-xl mb-6" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-6" style={{ background: 'var(--lp-badge-bg)', border: '2px solid var(--lp-card-border)' }}>
                <span style={{ color: 'var(--lp-accent)' }}>{i === 0 ? '✦' : i === 1 ? '◆' : '★'}</span>
              </div>
            )}
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}>{item.label}</span>
            <h3 className="font-bold text-lg mb-3" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}>{item.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── VARIANT: icon_list (no images needed) ──

function BenefitsIconList({ data }: { data: LPBenefitsProps }) {
  const revealRef = useLPScrollReveal();
  const icons = ['✦', '◆', '★', '●', '▲', '♦'];

  return (
    <section ref={revealRef} className="relative overflow-hidden px-[5%] py-16 md:py-24 lp-noise" style={{ background: 'var(--lp-bg)' }}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[150px] pointer-events-none" style={{ background: 'var(--lp-accent)' }} />
      <div className="relative max-w-[800px] mx-auto space-y-8">
        {data.items.map((item, i) => (
          <div key={i} className={`lp-reveal lp-reveal-delay-${Math.min(i + 1, 4)} flex gap-6 items-start`}>
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'var(--lp-badge-bg)', border: '1px solid var(--lp-card-border)', color: 'var(--lp-accent)' }}>
              {icons[i % icons.length]}
            </div>
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--lp-badge-text)' }}>{item.label}</span>
              <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Shared ──

function FallbackArt({ label, index, show }: { label: string; index: number; show: boolean }) {
  return (
    <div className="lp-benefit-fallback-art relative w-full max-w-[420px] aspect-[4/3] rounded-3xl overflow-hidden items-center justify-center" style={{ display: show ? 'flex' : 'none' }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 30%, var(--lp-accent) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, var(--lp-card-bg) 0%, transparent 50%), linear-gradient(135deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)`, opacity: 0.4 }} />
      <div className="absolute inset-0 rounded-3xl" style={{ border: '1px solid var(--lp-card-border)', backdropFilter: 'blur(20px)' }} />
      <div className="relative flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--lp-badge-bg)', border: '2px solid var(--lp-card-border)', boxShadow: '0 0 40px var(--lp-shadow)' }}>
          <span className="text-3xl" style={{ color: 'var(--lp-accent)' }}>{index === 0 ? '✦' : index === 1 ? '◆' : '★'}</span>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-display)' }}>{label}</span>
      </div>
    </div>
  );
}
