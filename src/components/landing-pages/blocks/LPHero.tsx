import type { LPHeroProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPHeroProps;
}

export function LPHero({ data }: Props) {
  const bgStyle: React.CSSProperties = data.backgroundImageUrl
    ? {
        background: `linear-gradient(135deg, var(--lp-bg, #0a0a0a)ee 0%, var(--lp-bg, #0a0a0a)cc 50%, var(--lp-bg, #0a0a0a)88 100%), url('${data.backgroundImageUrl}') center/cover no-repeat`,
      }
    : { background: 'var(--lp-bg)' };

  return (
    <section
      className="grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-12 px-[5%] py-12 md:py-20"
      style={bgStyle}
    >
      <div className="max-w-[600px]">
        <span
          className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
          style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
        >
          {data.badge}
        </span>
        <h1
          className="text-3xl md:text-5xl font-extrabold leading-[1.08] mb-5 tracking-tight"
          style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
        >
          {data.title}
        </h1>
        <p
          className="text-base md:text-lg leading-relaxed mb-7"
          style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
        >
          {data.subtitle}
        </p>
        <ul className="mb-9 space-y-1.5">
          {data.benefits.map((b, i) => (
            <li
              key={i}
              className="text-base"
              style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
            >
              ✅ {b}
            </li>
          ))}
        </ul>
        <a
          href={data.ctaUrl}
          className="inline-block px-10 py-4 rounded-lg text-base font-bold uppercase tracking-wide transition-all hover:opacity-90 hover:-translate-y-0.5 text-center max-w-[400px]"
          style={{ background: 'var(--lp-cta-bg)', color: 'var(--lp-cta-text)' }}
        >
          {data.ctaText}
        </a>
        {data.priceDisplay && (
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
            dangerouslySetInnerHTML={{ __html: data.priceDisplay }}
          />
        )}
      </div>
      <div className="flex items-center justify-center order-first md:order-last">
        {data.productImageUrl && (
          <img
            src={data.productImageUrl}
            alt="Produto"
            className="w-full max-w-[480px] h-auto object-contain"
            style={{ filter: `drop-shadow(0 20px 50px var(--lp-shadow))` }}
          />
        )}
      </div>
    </section>
  );
}
