// =============================================
// VIDEO CAROUSEL BLOCK - Display multiple videos in a slider or grid
// =============================================
// Supports YouTube URLs AND uploaded videos (MP4/WEBM)
// Works in Builder (preview only) and Storefront (full interaction)
// Layout modes: carousel (single video + nav) or grid (multiple per row)
// =============================================

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Play, Youtube, Video as VideoIcon } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';

// =============================================
// TYPES
// =============================================

interface VideoItem {
  id: string;
  type?: 'youtube' | 'upload';
  url?: string;
  videoDesktop?: string;
  videoMobile?: string;
  title?: string;
  thumbnail?: string;
}

type MaxWidthOption = 'small' | 'medium' | 'large' | 'full';
type LayoutMode = 'carousel' | 'grid';

interface VideoCarouselBlockProps {
  title?: string;
  videos?: VideoItem[];
  videosJson?: string;
  autoplay?: boolean;
  showControls?: boolean;
  aspectRatio?: '16:9' | '4:3' | '1:1' | '9:16';
  maxWidth?: MaxWidthOption;
  layout?: LayoutMode;
  itemsPerRow?: number;
  itemsPerPage?: number;
  context?: BlockRenderContext;
}

// =============================================
// HELPERS (pure functions, no side effects)
// =============================================

const MAX_WIDTH_MAP: Record<MaxWidthOption, string> = {
  small: 'max-w-md',    // 448px
  medium: 'max-w-xl',   // 576px
  large: 'max-w-3xl',   // 768px
  full: 'max-w-full',
};

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function isUploadedVideo(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lower.includes(ext)) ||
    lower.includes('/storage/') || lower.includes('supabase');
}

function parseVideos(videos?: VideoItem[], videosJson?: string): VideoItem[] {
  if (videos && Array.isArray(videos) && videos.length > 0) {
    return videos.map(v => {
      const effectiveUrl = v.url || v.videoDesktop || v.videoMobile || '';
      const videoType = v.type || (isUploadedVideo(effectiveUrl) ? 'upload' : 'youtube');
      return {
        ...v,
        url: effectiveUrl,
        type: videoType,
        videoDesktop: v.videoDesktop || (videoType === 'upload' ? effectiveUrl : undefined),
        videoMobile: v.videoMobile || v.videoDesktop || (videoType === 'upload' ? effectiveUrl : undefined),
      };
    }).filter(v => v.url && (v.type === 'upload' || extractYouTubeId(v.url)));
  }

  if (videosJson) {
    try {
      const parsed = JSON.parse(videosJson);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => {
          const url = typeof item === 'string' ? item : (item.url || item.youtubeUrl || item.src || item.videoDesktop || '');
          const type = (typeof item === 'object' && item.type)
            ? item.type
            : (isUploadedVideo(url) ? 'upload' : 'youtube');
          return {
            id: typeof item === 'object' ? (item.id || `video-${index}`) : `video-${index}`,
            type,
            url,
            title: typeof item === 'object' ? item.title : undefined,
            thumbnail: typeof item === 'object' ? item.thumbnail : undefined,
            videoDesktop: typeof item === 'object' ? (item.videoDesktop || (type === 'upload' ? url : undefined)) : undefined,
            videoMobile: typeof item === 'object' ? (item.videoMobile || item.videoDesktop || (type === 'upload' ? url : undefined)) : undefined,
          };
        }).filter(v => v.url && (v.type === 'upload' || extractYouTubeId(v.url)));
      }
    } catch {
      const urls = videosJson.split(',').map(s => s.trim()).filter(Boolean);
      return urls.map((url, index) => ({
        id: `video-${index}`,
        type: isUploadedVideo(url) ? 'upload' as const : 'youtube' as const,
        url,
        videoDesktop: isUploadedVideo(url) ? url : undefined,
        videoMobile: isUploadedVideo(url) ? url : undefined,
      })).filter(v => v.type === 'upload' || extractYouTubeId(v.url));
    }
  }

  return [];
}

function getAspectRatioClass(ratio: string): string {
  switch (ratio) {
    case '4:3': return 'aspect-[4/3]';
    case '1:1': return 'aspect-square';
    case '9:16': return 'aspect-[9/16]';
    default: return 'aspect-video';
  }
}

function getGridColsClass(itemsPerRow: number): string {
  switch (itemsPerRow) {
    case 1: return 'grid-cols-1';
    case 2: return 'grid-cols-1 sm:grid-cols-2';
    case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    default: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  }
}

// =============================================
// SUB-COMPONENTS
// =============================================

/** Single video card — used in both carousel and grid */
function VideoCard({
  video,
  aspectRatioClass,
  isPlaying,
  onPlay,
  isInBuilder,
}: {
  video: VideoItem;
  aspectRatioClass: string;
  isPlaying: boolean;
  onPlay: () => void;
  isInBuilder: boolean;
}) {
  const videoId = video.type === 'youtube' ? extractYouTubeId(video.url!) : null;

  const getThumbnail = () => {
    if (video.thumbnail) return video.thumbnail;
    if (video.type === 'youtube' && videoId) {
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    return null;
  };

  return (
    <div className={cn('relative w-full overflow-hidden rounded-lg bg-black', aspectRatioClass)}>
      {isPlaying ? (
        video.type === 'upload' ? (
          <video
            src={video.url}
            className="absolute inset-0 w-full h-full object-contain"
            controls autoPlay playsInline
          />
        ) : (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 0 }}
          />
        )
      ) : (
        <div
          className="absolute inset-0 cursor-pointer group"
          onClick={() => !isInBuilder && onPlay()}
        >
          {getThumbnail() ? (
            <img
              src={getThumbnail()!}
              alt={video.title || 'Video thumbnail'}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.includes('maxresdefault') && videoId) {
                  target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoIcon className="w-16 h-16 text-gray-600" />
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className={cn(
              "w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform",
              video.type === 'youtube' ? "bg-red-600" : "bg-primary"
            )}>
              <Play className="w-7 h-7 md:w-8 md:h-8 text-white ml-0.5" fill="white" />
            </div>
          </div>

          {/* Type badge */}
          <div className="absolute top-2 left-2">
            {video.type === 'youtube' ? (
              <div className="flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded">
                <Youtube className="w-3 h-3" /> YouTube
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                <VideoIcon className="w-3 h-3" /> Vídeo
              </div>
            )}
          </div>

          {/* Title */}
          {video.title && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white font-medium text-sm">{video.title}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pagination controls */
function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
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
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
        className="px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Próxima página"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export function VideoCarouselBlock({
  title,
  videos,
  videosJson,
  autoplay = false,
  showControls = true,
  aspectRatio = '16:9',
  maxWidth = 'full',
  layout = 'carousel',
  itemsPerRow = 3,
  itemsPerPage = 6,
  context,
}: VideoCarouselBlockProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const isInBuilder = context?.viewport !== undefined;
  const parsedVideos = useMemo(() => parseVideos(videos, videosJson), [videos, videosJson]);
  const aspectRatioClass = useMemo(() => getAspectRatioClass(aspectRatio), [aspectRatio]);
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

  // ── GRID LAYOUT ──
  if (layout === 'grid') {
    const totalPages = Math.ceil(parsedVideos.length / itemsPerPage);
    const startIdx = currentPage * itemsPerPage;
    const pageVideos = parsedVideos.slice(startIdx, startIdx + itemsPerPage);
    const gridClass = getGridColsClass(itemsPerRow);

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
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    );
  }

  // ── CAROUSEL LAYOUT (default) ──
  const currentVideo = parsedVideos[currentIndex];

  const goToPrev = () => { setCurrentIndex(prev => (prev === 0 ? parsedVideos.length - 1 : prev - 1)); setPlayingId(null); };
  const goToNext = () => { setCurrentIndex(prev => (prev === parsedVideos.length - 1 ? 0 : prev + 1)); setPlayingId(null); };

  return (
    <div className={cn('video-carousel w-full mx-auto', maxWidthClass)}>
      {title && (
        <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
      )}

      {/* Main video */}
      <div className="relative">
        <VideoCard
          video={currentVideo}
          aspectRatioClass={aspectRatioClass}
          isPlaying={playingId === currentVideo.id}
          onPlay={() => setPlayingId(currentVideo.id)}
          isInBuilder={isInBuilder}
        />

        {/* Navigation arrows */}
        {showControls && parsedVideos.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10"
              aria-label="Vídeo anterior"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10"
              aria-label="Próximo vídeo"
            >
              <ChevronRight className="w-6 h-6 text-gray-800" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {parsedVideos.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {parsedVideos.map((video, index) => {
            const videoId = video.type === 'youtube' ? extractYouTubeId(video.url!) : null;
            const isActive = index === currentIndex;
            const thumbnailUrl = video.thumbnail ||
              (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null);

            return (
              <button
                key={video.id}
                onClick={() => { setCurrentIndex(index); setPlayingId(null); }}
                className={cn(
                  'flex-shrink-0 w-24 h-14 md:w-32 md:h-18 rounded-md overflow-hidden border-2 transition-all relative',
                  isActive ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-70 hover:opacity-100'
                )}
              >
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={video.title || `Video ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <VideoIcon className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div className="absolute bottom-1 right-1">
                  {video.type === 'youtube' ? (
                    <Youtube className="w-3 h-3 text-red-500 drop-shadow" />
                  ) : (
                    <VideoIcon className="w-3 h-3 text-primary drop-shadow" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Counter */}
      {parsedVideos.length > 1 && (
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {currentIndex + 1} / {parsedVideos.length}
        </div>
      )}
    </div>
  );
}

export default VideoCarouselBlock;
