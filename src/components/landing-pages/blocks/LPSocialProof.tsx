import type { LPSocialProofProps } from '@/lib/landing-page-schema';

interface Props {
  data: LPSocialProofProps;
}

export function LPSocialProof({ data }: Props) {
  return (
    <section className="px-[5%] py-12 md:py-20" style={{ background: 'var(--lp-bg)' }}>
      <div className="text-center max-w-[700px] mx-auto mb-12">
        <span
          className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
          style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
        >
          {data.badge}
        </span>
        <h2
          className="text-2xl md:text-4xl font-extrabold leading-tight"
          style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
        >
          {data.title}
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[1100px] mx-auto">
        {data.imageUrls.slice(0, 4).map((url, i) => (
          <div key={i} className="overflow-hidden rounded-xl">
            <img
              src={url}
              alt={`Resultado ${i + 1}`}
              className="w-full h-[200px] md:h-[280px] object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
