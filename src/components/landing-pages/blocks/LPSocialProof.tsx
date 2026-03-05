import type { LPSocialProofProps } from '@/lib/landing-page-schema';
import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';

interface Props {
  data: LPSocialProofProps;
}

export function LPSocialProof({ data }: Props) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const revealRef = useLPScrollReveal();
  
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
  const gridCols = validImages.length <= 3 ? `grid-cols-${validImages.length}` :
                   validImages.length <= 6 ? 'grid-cols-2 md:grid-cols-3' : '';

  return (
    <section 
      ref={revealRef}
      id="resultados"
      className="relative overflow-hidden px-[5%] py-16 md:py-24 lp-noise" 
      style={{ background: 'var(--lp-bg)' }}
    >
      {/* Glow */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[200px] opacity-[0.06] pointer-events-none"
        style={{ background: 'var(--lp-accent)' }}
      />

      <div className="relative text-center max-w-[700px] mx-auto mb-14 lp-reveal">
        <span
          className="lp-badge-pulse inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
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

      <div className="relative max-w-[1140px] mx-auto lp-reveal lp-reveal-delay-2">
        {useCarousel ? (
          <>
            <button
              onClick={() => scroll('left')}
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ 
                background: 'var(--lp-card-bg)', 
                border: '1px solid var(--lp-card-border)', 
                color: 'var(--lp-text)', 
                boxShadow: '0 4px 20px var(--lp-shadow)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ 
                background: 'var(--lp-card-bg)', 
                border: '1px solid var(--lp-card-border)', 
                color: 'var(--lp-text)', 
                boxShadow: '0 4px 20px var(--lp-shadow)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

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
                  className="lp-social-proof-item flex-shrink-0 overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.03] group"
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
                    className="w-full h-[320px] object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                    onError={() => setFailedUrls(prev => new Set(prev).add(url))}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2 mt-8">
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
                    width: i === activeIndex ? '28px' : '8px',
                    height: '8px',
                    background: i === activeIndex ? 'var(--lp-accent)' : 'var(--lp-card-border)',
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className={`grid ${gridCols} gap-4`}>
            {validImages.map((url, i) => (
              <div 
                key={i} 
                className="lp-scale-in overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.03] group"
                style={{ 
                  border: '1px solid var(--lp-card-border)',
                  boxShadow: '0 8px 32px var(--lp-shadow)',
                }}
              >
                <img
                  src={url}
                  alt={`Resultado ${i + 1}`}
                  className="w-full h-[320px] object-cover transition-transform duration-700 group-hover:scale-110"
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
