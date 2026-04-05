// =============================================
// VIDEO CAROUSEL — VideoCard (Single Responsibility)
// Renders a single video thumbnail with play overlay
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { Play, Youtube, Video as VideoIcon } from 'lucide-react';
import type { VideoItem } from './types';
import { extractYouTubeId } from './helpers';

interface VideoCardProps {
  video: VideoItem;
  aspectRatioClass: string;
  isPlaying: boolean;
  onPlay: () => void;
  isInBuilder: boolean;
}

export function VideoCard({ video, aspectRatioClass, isPlaying, onPlay, isInBuilder }: VideoCardProps) {
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
