// =============================================
// VIDEO CAROUSEL — Grid Layout (Single Responsibility)
// Renders videos in a paginated grid
// =============================================

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { VideoItem } from './types';
import { VideoCard } from './VideoCard';
import { getGridColsClass, getAspectRatioClass, toSafeNumber } from './helpers';

interface GridLayoutProps {
  videos: VideoItem[];
  aspectRatio: string;
  maxWidthClass: string;
  title?: string;
  itemsPerRow?: number | string;
  itemsPerPage?: number | string;
  isInBuilder: boolean;
}

export function GridLayout({
  videos,
  aspectRatio,
  maxWidthClass,
  title,
  itemsPerRow: rawItemsPerRow,
  itemsPerPage: rawItemsPerPage,
  isInBuilder,
}: GridLayoutProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const itemsPerRow = toSafeNumber(rawItemsPerRow, 3);
  const itemsPerPage = toSafeNumber(rawItemsPerPage, 6);

  const aspectRatioClass = useMemo(() => getAspectRatioClass(aspectRatio), [aspectRatio]);
  const gridClass = getGridColsClass(itemsPerRow);

  const totalPages = Math.ceil(videos.length / itemsPerPage);
  const startIdx = currentPage * itemsPerPage;
  const pageVideos = videos.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div className={cn('video-carousel w-full mx-auto', maxWidthClass)}>
      {title && (
        <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
      )}
      <div className={cn('grid gap-4', gridClass)}>
        {pageVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            aspectRatioClass={aspectRatioClass}
            isPlaying={playingId === video.id}
            onPlay={() => setPlayingId(video.id)}
            isInBuilder={isInBuilder}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 0}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground px-2">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Próxima página"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
