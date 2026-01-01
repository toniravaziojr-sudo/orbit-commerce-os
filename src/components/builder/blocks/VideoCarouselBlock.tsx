// =============================================
// VIDEO CAROUSEL BLOCK - Display multiple YouTube videos in a slider
// =============================================
// Converts imported video sections into a native, interactive carousel
// Works in Builder (preview only) and Storefront (full interaction)
// =============================================

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Play, Youtube } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';

interface VideoItem {
  id: string;
  url: string;
  title?: string;
  thumbnail?: string;
}

interface VideoCarouselBlockProps {
  title?: string;
  videos?: VideoItem[];
  videosJson?: string; // Alternative: JSON string of video URLs
  autoplay?: boolean;
  showControls?: boolean;
  aspectRatio?: '16:9' | '4:3' | '1:1';
  context?: BlockRenderContext;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Parse videos from various input formats
function parseVideos(videos?: VideoItem[], videosJson?: string): VideoItem[] {
  // Try from array prop first
  if (videos && Array.isArray(videos) && videos.length > 0) {
    return videos.filter(v => v.url && extractYouTubeId(v.url));
  }
  
  // Try from JSON string
  if (videosJson) {
    try {
      const parsed = JSON.parse(videosJson);
      if (Array.isArray(parsed)) {
        // Could be array of strings (URLs) or array of objects
        return parsed.map((item, index) => {
          if (typeof item === 'string') {
            return { id: `video-${index}`, url: item };
          }
          return {
            id: item.id || `video-${index}`,
            url: item.url || item.youtubeUrl || item.src || '',
            title: item.title,
            thumbnail: item.thumbnail,
          };
        }).filter(v => v.url && extractYouTubeId(v.url));
      }
    } catch {
      // Try as comma-separated URLs
      const urls = videosJson.split(',').map(s => s.trim()).filter(Boolean);
      return urls.map((url, index) => ({
        id: `video-${index}`,
        url,
      })).filter(v => extractYouTubeId(v.url));
    }
  }
  
  return [];
}

export function VideoCarouselBlock({
  title,
  videos,
  videosJson,
  autoplay = false,
  showControls = true,
  aspectRatio = '16:9',
  context,
}: VideoCarouselBlockProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  // isPreview means we're in the builder preview mode (not editing)
  // In the builder, we want to disable video playback
  const isInBuilder = context?.isPreview === false;
  
  // Parse videos from props
  const parsedVideos = useMemo(() => parseVideos(videos, videosJson), [videos, videosJson]);
  
  // Aspect ratio styles
  const aspectRatioClass = useMemo(() => {
    switch (aspectRatio) {
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      default: return 'aspect-video';
    }
  }, [aspectRatio]);
  
  // Navigation handlers
  const goToPrev = () => {
    setCurrentIndex(prev => (prev === 0 ? parsedVideos.length - 1 : prev - 1));
    setPlayingId(null);
  };
  
  const goToNext = () => {
    setCurrentIndex(prev => (prev === parsedVideos.length - 1 ? 0 : prev + 1));
    setPlayingId(null);
  };
  
  // Empty state
  if (parsedVideos.length === 0) {
    if (isInBuilder) {
      return (
        <div className="p-8 bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg text-center">
          <Youtube className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">Carrossel de Vídeos</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Adicione URLs do YouTube nas propriedades
          </p>
        </div>
      );
    }
    return null;
  }
  
  const currentVideo = parsedVideos[currentIndex];
  const currentVideoId = extractYouTubeId(currentVideo?.url || '');
  const isPlaying = playingId === currentVideo?.id;
  
  return (
    <div className="video-carousel w-full">
      {/* Title */}
      {title && (
        <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
      )}
      
      {/* Main video area */}
      <div className="relative">
        {/* Video/Thumbnail container */}
        <div className={cn('relative w-full overflow-hidden rounded-lg bg-black', aspectRatioClass)}>
          {isPlaying && currentVideoId ? (
            // Playing: show iframe
            <iframe
              src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&rel=0`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 0 }}
            />
          ) : (
            // Not playing: show thumbnail with play button
            <div 
              className="absolute inset-0 cursor-pointer group"
              onClick={() => !isInBuilder && setPlayingId(currentVideo?.id)}
            >
              {/* Thumbnail image */}
              <img
                src={currentVideo?.thumbnail || `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`}
                alt={currentVideo?.title || 'Video thumbnail'}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to hqdefault if maxresdefault doesn't exist
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes('maxresdefault')) {
                    target.src = `https://img.youtube.com/vi/${currentVideoId}/hqdefault.jpg`;
                  }
                }}
              />
              
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
                </div>
              </div>
              
              {/* Video title */}
              {currentVideo?.title && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white font-medium text-lg">{currentVideo.title}</p>
                </div>
              )}
            </div>
          )}
        </div>
        
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
      
      {/* Thumbnail strip / indicators */}
      {parsedVideos.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {parsedVideos.map((video, index) => {
            const videoId = extractYouTubeId(video.url);
            const isActive = index === currentIndex;
            
            return (
              <button
                key={video.id}
                onClick={() => {
                  setCurrentIndex(index);
                  setPlayingId(null);
                }}
                className={cn(
                  'flex-shrink-0 w-24 h-14 md:w-32 md:h-18 rounded-md overflow-hidden border-2 transition-all',
                  isActive ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-70 hover:opacity-100'
                )}
              >
                <img
                  src={video.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  alt={video.title || `Video ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
      
      {/* Video counter */}
      {parsedVideos.length > 1 && (
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {currentIndex + 1} / {parsedVideos.length}
        </div>
      )}
    </div>
  );
}

export default VideoCarouselBlock;
