// CTA Finals: Organic Nature, Corporate Trust, Neon Energy, Warm Artisan, Tech Gradient, Classic Elegant, Urban Street
// Each mirrors its Hero template identity

import type { LPCtaFinalProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';
import { ProductPackshot } from '../heroes/shared/ProductPackshot';

interface Props { data: LPCtaFinalProps; }

// ── Organic Nature ──
export function CtaOrganicNature({ data }: Props) {
  const ref = useLPScrollReveal();
  return (
    <section ref={ref} className="relative overflow-hidden" style={{ background: `linear-gradient(160deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }}>
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-[5%] py-24 md:py-28 max-w-[1100px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <h2 className="font-semibold leading-[1.1] mb-6" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', color: 'var(--lp-text)' }}>{data.title}</h2>
          <p className="text-base mb-8 max-w-[480px]" style={{ color: 'var(--lp-text-muted)', lineHeight: '1.75' }}>{data.description}</p>
          {data.priceDisplay && <div className="mb-8" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-12 py-5 text-base font-semibold tracking-[0.08em] transition-all duration-500 hover:-translate-y-1.5" style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', borderRadius: '50px 16px 50px 16px', boxShadow: '0 12px 40px var(--lp-shadow)', minWidth: '260px' }}>
            {data.ctaText}
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">{data.productImageUrl && <ProductPackshot src={data.productImageUrl} />}</div>
      </div>
    </section>
  );
}

// ── Corporate Trust ──
export function CtaCorporateTrust({ data }: Props) {
  const ref = useLPScrollReveal();
  return (
    <section ref={ref} className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, var(--lp-bg) 0%, var(--lp-bg-alt) 100%)` }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'var(--lp-card-border)' }} />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-[5%] py-20 md:py-28 max-w-[1200px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.15em] mb-4 block" style={{ color: 'var(--lp-accent)' }}>Não perca</span>
          <h2 className="font-extrabold leading-[1.0] mb-6 tracking-tight" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', color: 'var(--lp-text)' }}>{data.title}</h2>
          <p className="text-base mb-8 max-w-[500px]" style={{ color: 'var(--lp-text-muted)', lineHeight: '1.7' }}>{data.description}</p>
          {data.priceDisplay && <div className="mb-8" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-10 py-4 rounded-lg text-sm font-bold uppercase tracking-[0.1em] transition-all duration-500 hover:-translate-y-1" style={{ background: 'var(--lp-cta-bg)', color: 'var(--lp-cta-text)', boxShadow: '0 8px 30px var(--lp-shadow)', minWidth: '260px' }}>
            {data.ctaText}
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">{data.productImageUrl && <ProductPackshot src={data.productImageUrl} />}</div>
      </div>
    </section>
  );
}

// ── Neon Energy ──
export function CtaNeonEnergy({ data }: Props) {
  const ref = useLPScrollReveal();
  return (
    <section ref={ref} className="relative overflow-hidden lp-noise" style={{ background: `linear-gradient(135deg, #050508 0%, #0a0a12 100%)` }}>
      <div className="absolute bottom-[20%] left-[20%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, var(--lp-accent) 0%, transparent 70%)`, opacity: 0.12, filter: 'blur(80px)' }} />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-[5%] py-24 md:py-32 max-w-[1200px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <h2 className="font-bold leading-[0.95] mb-6 uppercase" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3.5vw, 3rem)', color: 'var(--lp-text)', textShadow: '0 0 30px rgba(201,169,110,0.1)' }}>{data.title}</h2>
          <p className="text-base mb-8 max-w-[500px]" style={{ color: 'var(--lp-text-muted)', lineHeight: '1.7' }}>{data.description}</p>
          {data.priceDisplay && <div className="mb-8" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 rounded-xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5" style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: `0 0 30px var(--lp-accent), 0 12px 40px var(--lp-shadow)`, minWidth: '300px' }}>
            {data.ctaText}
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">{data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.2} />}</div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'var(--lp-accent)', boxShadow: `0 0 15px var(--lp-accent)`, opacity: 0.4 }} />
    </section>
  );
}

// ── Warm Artisan ──
export function CtaWarmArtisan({ data }: Props) {
  const ref = useLPScrollReveal();
  return (
    <section ref={ref} className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)` }}>
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-[5%] py-24 md:py-32 max-w-[1100px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px" style={{ background: 'var(--lp-accent)', opacity: 0.5 }} />
            <span className="text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--lp-accent)' }}>Oferta especial</span>
          </div>
          <h2 className="leading-[1.1] mb-6" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 500, color: 'var(--lp-text)' }}>{data.title}</h2>
          <p className="text-base mb-8 max-w-[440px]" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-display)', fontStyle: 'italic', lineHeight: '1.8' }}>{data.description}</p>
          {data.priceDisplay && <div className="mb-8" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-12 py-5 rounded-full text-sm font-semibold tracking-[0.1em] transition-all duration-500 hover:-translate-y-1.5" style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 12px 40px var(--lp-shadow)', minWidth: '260px' }}>
            {data.ctaText}
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">{data.productImageUrl && <ProductPackshot src={data.productImageUrl} />}</div>
      </div>
    </section>
  );
}

// ── Tech Gradient ──
export function CtaTechGradient({ data }: Props) {
  const ref = useLPScrollReveal();
  return (
    <section ref={ref} className="relative overflow-hidden" style={{ background: 'var(--lp-bg)' }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 50%, var(--lp-accent) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, var(--lp-cta-bg) 0%, transparent 50%)`, opacity: 0.04 }} />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-[5%] py-24 md:py-32 max-w-[1200px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <h2 className="font-bold leading-[1.0] mb-6" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.75rem)', color: 'var(--lp-text)' }}><span className="lp-gradient-text">{data.title}</span></h2>
          <p className="text-base mb-8 max-w-[500px]" style={{ color: 'var(--lp-text-muted)', lineHeight: '1.7' }}>{data.description}</p>
          {data.priceDisplay && <div className="mb-8" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 rounded-2xl text-base font-bold uppercase tracking-[0.12em] transition-all duration-500 hover:-translate-y-1.5" style={{ background: `linear-gradient(135deg, var(--lp-cta-bg), var(--lp-accent))`, color: 'var(--lp-cta-text)', boxShadow: '0 16px 50px var(--lp-shadow)', minWidth: '300px' }}>
            {data.ctaText}
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">{data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.12} />}</div>
      </div>
    </section>
  );
}

// ── Classic Elegant ──
export function CtaClassicElegant({ data }: Props) {
  const ref = useLPScrollReveal();
  return (
    <section ref={ref} className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, var(--lp-bg-alt) 0%, var(--lp-bg) 100%)` }}>
      <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center px-[5%] py-24 md:py-32 max-w-[1100px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 md:pr-10 order-2 md:order-1">
          <h2 className="leading-[1.05] mb-4" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 400, color: 'var(--lp-text)' }}>{data.title}</h2>
          <div className="w-12 h-px mb-6" style={{ background: 'var(--lp-accent)' }} />
          <p className="text-sm mb-8 max-w-[400px]" style={{ color: 'var(--lp-text-muted)', lineHeight: '1.85' }}>{data.description}</p>
          {data.priceDisplay && <div className="mb-8 text-xs" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn group inline-flex items-center justify-center gap-3 px-10 py-4 text-[13px] font-semibold uppercase tracking-[0.2em] transition-all duration-500 hover:-translate-y-1" style={{ background: 'transparent', color: 'var(--lp-text)', border: '1.5px solid var(--lp-text)', minWidth: '240px' }}>
            {data.ctaText}
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
        </div>
        <div className="hidden md:block w-px self-stretch my-12" style={{ background: 'var(--lp-divider)' }} />
        <div className="flex justify-center lp-scale-in md:pl-10 order-1 md:order-3">
          {data.productImageUrl && <div className="p-6" style={{ border: '1px solid var(--lp-divider)' }}><ProductPackshot src={data.productImageUrl} maxW="clamp(180px, 20vw, 280px)" maxH="clamp(220px, 32vh, 360px)" /></div>}
        </div>
      </div>
    </section>
  );
}

// ── Urban Street ──
export function CtaUrbanStreet({ data }: Props) {
  const ref = useLPScrollReveal();
  return (
    <section ref={ref} className="relative overflow-hidden lp-noise" style={{ background: 'var(--lp-bg)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 80px, rgba(255,255,255,0.02) 80px, rgba(255,255,255,0.02) 82px)` }} />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center px-[5%] py-20 md:py-28 max-w-[1200px] mx-auto lp-reveal">
        <div className="lp-reveal lp-reveal-delay-1 order-2 md:order-1">
          <h2 className="font-black leading-[0.88] mb-6 uppercase" style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: 'var(--lp-text)' }}>{data.title}</h2>
          <div className="w-16 h-1 mb-6" style={{ background: 'var(--lp-accent)' }} />
          <p className="text-base mb-8 max-w-[480px] font-medium" style={{ color: 'var(--lp-text-muted)', lineHeight: '1.6' }}>{data.description}</p>
          {data.priceDisplay && <div className="mb-8 font-bold" dangerouslySetInnerHTML={{ __html: data.priceDisplay }} />}
          <a href={data.ctaUrl} className="lp-cta-btn lp-cta-shimmer group inline-flex items-center justify-center gap-3 px-14 py-5 text-base font-black uppercase tracking-[0.1em] transition-all duration-500 hover:-translate-y-2" style={{ background: 'var(--lp-accent)', color: 'var(--lp-cta-text)', boxShadow: '0 12px 40px var(--lp-shadow)', minWidth: '300px', transform: 'skewX(-3deg)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', transform: 'skewX(3deg)' }}>
              {data.ctaText}
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </span>
          </a>
        </div>
        <div className="flex justify-center lp-scale-in order-1 md:order-2">{data.productImageUrl && <ProductPackshot src={data.productImageUrl} glowColor="var(--lp-accent)" glowIntensity={0.1} />}</div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: 'var(--lp-accent)' }} />
    </section>
  );
}
