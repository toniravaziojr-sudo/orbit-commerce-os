// =============================================
// VIDEO CAROUSEL BLOCK - Display multiple videos in a slider
// =============================================
// Supports YouTube URLs AND uploaded videos (MP4/WEBM)
// Works in Builder (preview only) and Storefront (full interaction)
// =============================================

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Play, Youtube, Video as VideoIcon } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';

interface VideoItem {
  id: string;
  type?: 'youtube' | 'upload';
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

// Detect if URL is an uploaded video (MP4, WEBM, etc.)
function isUploadedVideo(url: string): boolean {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('/storage/') || 
         lowerUrl.includes('supabase');
}

// Parse videos from various input formats
function parseVideos(videos?: VideoItem[], videosJson?: string): VideoItem[] {
  // Try from array prop first
  if (videos && Array.isArray(videos) && videos.length > 0) {
    return videos.map(v => ({
      ...v,
      type: v.type || (isUploadedVideo(v.url) ? 'upload' : 'youtube'),
    })).filter(v => v.url && (v.type === 'upload' || extractYouTubeId(v.url)));
  }
  
  // Try from JSON string
  if (videosJson) {
    try {
      const parsed = JSON.parse(videosJson);
      if (Array.isArray(parsed)) {
        // Could be array of strings (URLs) or array of objects
        return parsed.map((item, index) => {
          const url = typeof item === 'string' ? item : (item.url || item.youtubeUrl || item.src || '');
          const type = (typeof item === 'object' && item.type) 
            ? item.type 
            : (isUploadedVideo(url) ? 'upload' : 'youtube');
          
          return {
            id: typeof item === 'object' ? (item.id || `video-${index}`) : `video-${index}`,
            type,
            url,
            title: typeof item === 'object' ? item.title : undefined,
            thumbnail: typeof item === 'object' ? item.thumbnail : undefined,
          };
        }).filter(v => v.url && (v.type === 'upload' || extractYouTubeId(v.url)));
      }
    } catch {
      // Try as comma-separated URLs
      const urls = videosJson.split(',').map(s => s.trim()).filter(Boolean);
      return urls.map((url, index) => ({
        id: `video-${index}`,
        type: isUploadedVideo(url) ? 'upload' as const : 'youtube' as const,
        url,
      })).filter(v => v.type === 'upload' || extractYouTubeId(v.url));
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
  
  const currentVideo = parsedVideos[currentIndex];
  const currentVideoId = currentVideo.type === 'youtube' ? extractYouTubeId(currentVideo.url) : null;
  const isPlaying = playingId === currentVideo.id;
  
  // Get thumbnail for current video
  const getThumbnail = () => {
    if (currentVideo.thumbnail) return currentVideo.thumbnail;
    if (currentVideo.type === 'youtube' && currentVideoId) {
      return `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`;
    }
    return null;
  };
  
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
          {isPlaying ? (
            // Playing state
            currentVideo.type === 'upload' ? (
              // Native video element for uploaded videos
              <video
                src={currentVideo.url}
                className="absolute inset-0 w-full h-full object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              // YouTube iframe
              <iframe
                src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&rel=0`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 0 }}
              />
            )
          ) : (
            // Not playing: show thumbnail with play button
            <div 
              className="absolute inset-0 cursor-pointer group"
              onClick={() => !isInBuilder && setPlayingId(currentVideo.id)}
            >
              {/* Thumbnail image */}
              {getThumbnail() ? (
                <img
                  src={getThumbnail()!}
                  alt={currentVideo.title || 'Video thumbnail'}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to hqdefault if maxresdefault doesn't exist
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('maxresdefault')) {
                      target.src = `https://img.youtube.com/vi/${currentVideoId}/hqdefault.jpg`;
                    }
                  }}
                />
              ) : (
                // No thumbnail placeholder
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <VideoIcon className="w-16 h-16 text-gray-600" />
                </div>
              )}
              
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <div className={cn(
                  "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform",
                  currentVideo.type === 'youtube' ? "bg-red-600" : "bg-primary"
                )}>
                  <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
                </div>
              </div>
              
              {/* Video type badge */}
              <div className="absolute top-3 left-3">
                {currentVideo.type === 'youtube' ? (
                  <div className="flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    <Youtube className="w-3 h-3" />
                    YouTube
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                    <VideoIcon className="w-3 h-3" />
                    Vídeo
                  </div>
                )}
              </div>
              
              {/* Video title */}
              {currentVideo.title && (
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
            const videoId = video.type === 'youtube' ? extractYouTubeId(video.url) : null;
            const isActive = index === currentIndex;
            const thumbnailUrl = video.thumbnail || 
              (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null);
            
            return (
              <button
                key={video.id}
                onClick={() => {
                  setCurrentIndex(index);
                  setPlayingId(null);
                }}
                className={cn(
                  'flex-shrink-0 w-24 h-14 md:w-32 md:h-18 rounded-md overflow-hidden border-2 transition-all relative',
                  isActive ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-70 hover:opacity-100'
                )}
              >
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={video.title || `Video ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <VideoIcon className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                {/* Type indicator */}
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
