import type { LPCtaFinalProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPCtaFinalProps;
}

export function LPCtaFinal({ data }: Props) {
  return (
    <section className="px-[5%] py-12 md:py-20" style={{ background: 'var(--lp-bg)' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center max-w-[1000px] mx-auto">
        <div className="flex justify-center">
          {data.productImageUrl && (
            <img
              src={data.productImageUrl}
              alt="Produto"
              className="w-full max-w-[400px] object-contain"
              style={{ filter: `drop-shadow(0 20px 50px var(--lp-shadow))` }}
            />
          )}
        </div>
        <div className="text-center md:text-left">
          <h2
            className="text-2xl md:text-4xl font-extrabold leading-tight mb-4"
            style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
          >
            {data.title}
          </h2>
          <p
            className="text-base leading-relaxed mb-6"
            style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
          >
            {data.description}
          </p>
          {data.priceDisplay && (
            <div
              className="mb-6"
              style={{ fontFamily: 'var(--lp-font-display)' }}
              dangerouslySetInnerHTML={{ __html: data.priceDisplay }}
            />
          )}
          <a
            href={data.ctaUrl}
            className="inline-block px-12 py-5 rounded-lg text-lg font-bold uppercase tracking-wide transition-all hover:opacity-90 hover:-translate-y-0.5 text-center"
            style={{ background: 'var(--lp-cta-bg)', color: 'var(--lp-cta-text)' }}
          >
            {data.ctaText}
          </a>
        </div>
      </div>
    </section>
  );
}
