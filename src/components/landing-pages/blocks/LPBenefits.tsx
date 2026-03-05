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
            className="px-[5%] py-12 md:py-20"
            style={{ background: i % 2 === 0 ? 'var(--lp-bg)' : 'var(--lp-bg-alt)' }}
          >
            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center max-w-[1100px] mx-auto ${
                isReverse ? 'md:[direction:rtl]' : ''
              }`}
            >
              <div className={isReverse ? 'md:[direction:ltr]' : ''}>
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
                >
                  {item.label}
                </span>
                <h2
                  className="text-xl md:text-3xl font-bold leading-tight mb-4"
                  style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
                >
                  {item.title}
                </h2>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
                >
                  {item.description}
                </p>
              </div>
              <div className={`flex justify-center order-first md:order-none ${isReverse ? 'md:[direction:ltr]' : ''}`}>
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.label}
                    className="w-full max-w-[420px] h-auto object-contain rounded-2xl"
                    style={{ filter: `drop-shadow(0 15px 40px var(--lp-shadow))` }}
                  />
                )}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
