import type { LPSocialProofProps } from '@/lib/landing-page-schema';
import { useState } from 'react';

interface Props {
  data: LPSocialProofProps;
}

export function LPSocialProof({ data }: Props) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  
  const validImages = data.imageUrls.filter(url => url && !failedUrls.has(url));

  if (validImages.length === 0) return null;

  return (
    <section className="relative overflow-hidden px-[5%] py-16 md:py-24" style={{ background: 'var(--lp-bg)' }}>
      <div className="relative text-center max-w-[700px] mx-auto mb-14">
        <span
          className="inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
          style={{ 
            background: 'var(--lp-badge-bg)', 
            color: 'var(--lp-badge-text)',
            border: '1px solid var(--lp-card-border)',
          }}
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
      <div className={`grid gap-4 max-w-[1100px] mx-auto ${
        validImages.length === 1 ? 'grid-cols-1 max-w-[500px]' :
        validImages.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-[800px]' :
        validImages.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
        'grid-cols-2 md:grid-cols-4'
      }`}>
        {validImages.slice(0, 4).map((url, i) => (
          <div 
            key={i} 
            className="overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] group"
            style={{ 
              border: '1px solid var(--lp-card-border)',
              boxShadow: '0 4px 24px var(--lp-shadow)',
            }}
          >
            <img
              src={url}
              alt={`Resultado ${i + 1}`}
              className="w-full h-[220px] md:h-[300px] object-cover transition-transform duration-500 group-hover:scale-110"
              onError={() => setFailedUrls(prev => new Set(prev).add(url))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
