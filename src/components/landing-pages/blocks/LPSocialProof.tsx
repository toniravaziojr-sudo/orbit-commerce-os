import type { LPSocialProofProps } from '@/lib/landing-page-schema';
import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  data: LPSocialProofProps;
}

export function LPSocialProof({ data }: Props) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const validImages = data.imageUrls.filter(url => url && !failedUrls.has(url));
  if (validImages.length === 0) return null;

  const useCarousel = validImages.length > 6;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.offsetWidth * 0.8;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const scrollPercent = el.scrollLeft / (el.scrollWidth - el.clientWidth);
    const totalPages = Math.ceil(validImages.length / 3);
    setActiveIndex(Math.round(scrollPercent * (totalPages - 1)));
  };

  const totalPages = Math.max(1, Math.ceil(validImages.length / 3));

  // Grid columns based on count
  const gridCols = validImages.length <= 3 ? `grid-cols-${validImages.length}` :
                   validImages.length <= 6 ? 'grid-cols-2 md:grid-cols-3' : '';

  return (
    <section 
      id="resultados"
      className="relative overflow-hidden px-[5%] py-16 md:py-24" 
      style={{ background: 'var(--lp-bg)' }}
    >
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
          className="font-extrabold leading-tight"
          style={{ 
            color: 'var(--lp-text)', 
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
          }}
        >
          {data.title}
        </h2>
      </div>

      <div className="relative max-w-[1140px] mx-auto">
        {useCarousel ? (
          <>
            {/* Navigation arrows */}
            <button
              onClick={() => scroll('left')}
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ 
                background: 'var(--lp-card-bg)', 
                border: '1px solid var(--lp-card-border)', 
                color: 'var(--lp-text)', 
                boxShadow: '0 4px 16px var(--lp-shadow)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ 
                background: 'var(--lp-card-bg)', 
                border: '1px solid var(--lp-card-border)', 
                color: 'var(--lp-text)', 
                boxShadow: '0 4px 16px var(--lp-shadow)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Scrollable track */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="lp-sp-track flex gap-4 overflow-x-auto px-1 py-2"
              style={{ 
                scrollSnapType: 'x mandatory', 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <style>{`.lp-sp-track::-webkit-scrollbar { display: none; }`}</style>
              {validImages.map((url, i) => (
                <div 
                  key={i} 
                  className="lp-social-proof-item flex-shrink-0 overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] group"
                  style={{ 
                    width: '280px',
                    border: '1px solid var(--lp-card-border)',
                    boxShadow: '0 8px 32px var(--lp-shadow)',
                    scrollSnapAlign: 'start',
                  }}
                >
                  <img
                    src={url}
                    alt={`Resultado ${i + 1}`}
                    className="w-full h-[300px] object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    onError={() => setFailedUrls(prev => new Set(prev).add(url))}
                  />
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (!scrollRef.current) return;
                    const scrollTo = (i / (totalPages - 1)) * (scrollRef.current.scrollWidth - scrollRef.current.clientWidth);
                    scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
                  }}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === activeIndex ? '24px' : '8px',
                    height: '8px',
                    background: i === activeIndex ? 'var(--lp-accent)' : 'var(--lp-card-border)',
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          /* Grid mode for <= 6 images */
          <div className={`grid ${gridCols} gap-4`}>
            {validImages.map((url, i) => (
              <div 
                key={i} 
                className="overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] group"
                style={{ 
                  border: '1px solid var(--lp-card-border)',
                  boxShadow: '0 8px 32px var(--lp-shadow)',
                }}
              >
                <img
                  src={url}
                  alt={`Resultado ${i + 1}`}
                  className="w-full h-[300px] object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  onError={() => setFailedUrls(prev => new Set(prev).add(url))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
