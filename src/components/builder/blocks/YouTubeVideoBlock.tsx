// =============================================
// YOUTUBE VIDEO BLOCK - Embedded YouTube video
// =============================================

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Play, AlertCircle } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';

type WidthPreset = 'sm' | 'md' | 'lg' | 'xl' | 'full';
type AspectRatioType = '16:9' | '4:3' | '1:1';

interface YouTubeVideoBlockProps {
  title?: string;
  youtubeUrl?: string;
  widthPreset?: WidthPreset;
  aspectRatio?: AspectRatioType;
  context?: BlockRenderContext;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

const widthClasses: Record<WidthPreset, string> = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-none',
};

const aspectClasses: Record<AspectRatioType, string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
};

export function YouTubeVideoBlock({
  title,
  youtubeUrl,
  widthPreset = 'lg',
  aspectRatio = '16:9',
  context,
}: YouTubeVideoBlockProps) {
  const videoId = useMemo(() => extractYouTubeId(youtubeUrl || ''), [youtubeUrl]);
  
  const widthClass = widthClasses[widthPreset] || widthClasses.lg;
  const aspectClass = aspectClasses[aspectRatio] || aspectClasses['16:9'];

  // No URL provided - show placeholder
  if (!youtubeUrl) {
    return (
      <section className="py-8">
        <div className={cn('w-full mx-auto px-4', widthClass)}>
          {title && (
            <h2 className="text-xl font-semibold mb-4 text-center">{title}</h2>
          )}
          <div className={cn(
            'bg-muted/30 rounded-lg flex items-center justify-center',
            aspectClass
          )}>
            <div className="text-center text-muted-foreground">
              <Play className="h-16 w-16 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Cole o link do YouTube para exibir o vídeo</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Invalid URL
  if (!videoId) {
    return (
      <section className="py-8">
        <div className={cn('w-full mx-auto px-4', widthClass)}>
          {title && (
            <h2 className="text-xl font-semibold mb-4 text-center">{title}</h2>
          )}
          <div className={cn(
            'bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-center',
            aspectClass
          )}>
            <div className="text-center text-destructive">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm font-medium">URL inválida</p>
              <p className="text-xs mt-1 opacity-70">Verifique o link do YouTube</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8">
      <div className={cn('w-full mx-auto px-4', widthClass)}>
        {title && (
          <h2 className="text-xl font-semibold mb-4 text-center">{title}</h2>
        )}
        <div className={cn(
          'rounded-lg overflow-hidden shadow-lg w-full',
          aspectClass
        )}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    </section>
  );
}
