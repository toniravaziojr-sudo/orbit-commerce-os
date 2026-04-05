// =============================================
// VIDEO CAROUSEL — Pure Helper Functions
// =============================================

import type { VideoItem, MaxWidthOption } from './types';

// ── Constants ──

export const MAX_WIDTH_MAP: Record<MaxWidthOption, string> = {
  small: 'max-w-md',
  medium: 'max-w-xl',
  large: 'max-w-3xl',
  full: 'max-w-full',
};

// ── YouTube ──

export function extractYouTubeId(url: string): string | null {
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

// ── Upload detection ──

export function isUploadedVideo(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lower.includes(ext)) ||
    lower.includes('/storage/') || lower.includes('supabase');
}

// ── Parse videos from props ──

export function parseVideos(videos?: VideoItem[], videosJson?: string): VideoItem[] {
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

// ── Aspect ratio ──

export function getAspectRatioClass(ratio: string): string {
  switch (ratio) {
    case '4:3': return 'aspect-[4/3]';
    case '1:1': return 'aspect-square';
    case '9:16': return 'aspect-[9/16]';
    default: return 'aspect-video';
  }
}

// ── Grid columns ──

export function getGridColsClass(itemsPerRow: number): string {
  switch (itemsPerRow) {
    case 1: return 'grid-cols-1';
    case 2: return 'grid-cols-1 sm:grid-cols-2';
    case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    default: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  }
}

// ── Safe number coercion (registry sends strings) ──

export function toSafeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}
