// =============================================
// VIDEO CAROUSEL — Carousel Layout (Single Responsibility)
// Uses embla-carousel for smooth multi-item sliding
// =============================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import type { VideoItem } from './types';
import { VideoCard } from './VideoCard';
import { getAspectRatioClass, toSafeNumber } from './helpers';

interface CarouselLayoutProps {
  videos: VideoItem[];
  aspectRatio: string;
  maxWidthClass: string;
  title?: string;
  showControls?: boolean;
  itemsPerSlide?: number | string;
  isInBuilder: boolean;
}

export function CarouselLayout({
  videos,
  aspectRatio,
  maxWidthClass,
  title,
  showControls = true,
  itemsPerSlide: rawItemsPerSlide,
  isInBuilder,
}: CarouselLayoutProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const perSlide = toSafeNumber(rawItemsPerSlide, 1);
  const slidePct = 100 / perSlide;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: videos.length > perSlide,
    slidesToScroll: perSlide,
    containScroll: 'trimSnaps',
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedSnap, setSelectedSnap] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setSelectedSnap(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  // Re-init when perSlide changes
  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, perSlide]);

  const aspectRatioClass = useMemo(() => getAspectRatioClass(aspectRatio), [aspectRatio]);

  const totalSnaps = emblaApi?.scrollSnapList().length || 1;

  return (
    <div className={cn('video-carousel w-full mx-auto', maxWidthClass)}>
      {title && (
        <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
      )}

      {/* Embla viewport */}
      <div className="relative">
        <div ref={emblaRef} className="overflow-hidden rounded-lg">
          <div className="flex" style={{ gap: perSlide > 1 ? '1rem' : '0' }}>
            {videos.map((video) => (
              <div
                key={video.id}
                className="min-w-0 shrink-0 grow-0"
                style={{ flex: `0 0 calc(${slidePct}% - ${perSlide > 1 ? `${((perSlide - 1) * 16) / perSlide}px` : '0px'})` }}
              >
                <VideoCard
                  video={video}
                  aspectRatioClass={aspectRatioClass}
                  isPlaying={playingId === video.id}
                  onPlay={() => { setPlayingId(video.id); }}
                  isInBuilder={isInBuilder}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {showControls && videos.length > perSlide && (
          <>
            <button
              onClick={() => { emblaApi?.scrollPrev(); setPlayingId(null); }}
              disabled={!canScrollPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10 disabled:opacity-40"
              aria-label="Vídeo anterior"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800" />
            </button>
            <button
              onClick={() => { emblaApi?.scrollNext(); setPlayingId(null); }}
              disabled={!canScrollNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10 disabled:opacity-40"
              aria-label="Próximo vídeo"
            >
              <ChevronRight className="w-6 h-6 text-gray-800" />
            </button>
          </>
        )}
      </div>

      {/* Dots indicator */}
      {totalSnaps > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: totalSnaps }).map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === selectedSnap
                  ? 'bg-primary w-4'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
              aria-label={`Ir para slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
