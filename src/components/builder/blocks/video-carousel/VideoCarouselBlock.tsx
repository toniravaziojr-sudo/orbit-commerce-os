// =============================================
// VIDEO CAROUSEL BLOCK — Orchestrator (delegates layout)
// =============================================

import React, { useMemo } from 'react';
import { Video as VideoIcon } from 'lucide-react';
import type { VideoCarouselBlockProps } from './types';
import { parseVideos, MAX_WIDTH_MAP } from './helpers';
import { CarouselLayout } from './CarouselLayout';
import { GridLayout } from './GridLayout';

export function VideoCarouselBlock({
  title,
  videos,
  videosJson,
  showControls = true,
  aspectRatio = '16:9',
  maxWidth = 'full',
  layout = 'carousel',
  itemsPerSlide = 1,
  itemsPerRow = 3,
  itemsPerPage = 6,
  context,
}: VideoCarouselBlockProps) {
  const isInBuilder = context?.viewport !== undefined;
  const parsedVideos = useMemo(() => parseVideos(videos, videosJson), [videos, videosJson]);
  const maxWidthClass = MAX_WIDTH_MAP[maxWidth] || MAX_WIDTH_MAP.full;

  // Empty state
  if (parsedVideos.length === 0) {
    if (isInBuilder) {
      return (
        <div className="p-8 bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg text-center">
          <VideoIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">Carrossel de Vídeos</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Adicione URLs do YouTube ou faça upload de vídeos
          </p>
        </div>
      );
    }
    return null;
  }

  if (layout === 'grid') {
    return (
      <GridLayout
        videos={parsedVideos}
        aspectRatio={aspectRatio}
        maxWidthClass={maxWidthClass}
        title={title}
        itemsPerRow={itemsPerRow}
        itemsPerPage={itemsPerPage}
        isInBuilder={isInBuilder}
      />
    );
  }

  return (
    <CarouselLayout
      videos={parsedVideos}
      aspectRatio={aspectRatio}
      maxWidthClass={maxWidthClass}
      title={title}
      showControls={showControls}
      itemsPerSlide={itemsPerSlide}
      isInBuilder={isInBuilder}
    />
  );
}

export default VideoCarouselBlock;
