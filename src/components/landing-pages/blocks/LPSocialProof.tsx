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
      className="relative overflow-hidden px-[5%] py-24 md:py-36 lp-noise"
      style={{ background: 'var(--lp-bg)' }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 100%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.04 }} />

      <div className="relative text-center max-w-[700px] mx-auto mb-16 lp-reveal">
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', color: 'var(--lp-badge-text)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}>
          <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
          {data.badge}
        </span>
        <h2 className="font-extrabold leading-[1.05] tracking-[-0.02em]" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.75rem)' }}>
          <span className="lp-gradient-text">{data.title}</span>
        </h2>
      </div>

      <div className="relative max-w-[1200px] mx-auto lp-reveal lp-reveal-delay-2">
        {useCarousel ? (
          <>
            <button
              onClick={() => scroll('left')}
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 lp-glass-card"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--lp-text)',
                boxShadow: '0 4px 20px var(--lp-shadow)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 lp-glass-card"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--lp-text)',
                boxShadow: '0 4px 20px var(--lp-shadow)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="lp-sp-track flex gap-5 overflow-x-auto px-1 py-2"
              style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style>{`.lp-sp-track::-webkit-scrollbar { display: none; }`}</style>
              {validImages.map((url, i) => (
                <div
                  key={i}
                  className="lp-social-proof-item flex-shrink-0 overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.03] group relative"
                  style={{
                    width: '300px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 32px var(--lp-shadow)',
                    scrollSnapAlign: 'start',
                  }}
                >
                  <img
                    src={url}
                    alt={`Resultado ${i + 1}`}
                    className="w-full h-[360px] object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                    onError={() => setFailedUrls(prev => new Set(prev).add(url))}
                  />
                  {/* Bottom gradient overlay */}
                  <div className="absolute bottom-0 left-0 right-0 h-1/4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }} />
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2 mt-10">
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
                    width: i === activeIndex ? '32px' : '8px',
                    height: '8px',
                    background: i === activeIndex ? 'var(--lp-accent)' : 'rgba(255,255,255,0.12)',
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className={`grid ${gridCols} gap-5`}>
            {validImages.map((url, i) => (
              <div
                key={i}
                className="lp-scale-in overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.03] group relative"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 32px var(--lp-shadow)',
                }}
              >
                <img
                  src={url}
                  alt={`Resultado ${i + 1}`}
                  className="w-full h-[360px] object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                  onError={() => setFailedUrls(prev => new Set(prev).add(url))}
                />
                <div className="absolute bottom-0 left-0 right-0 h-1/4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
