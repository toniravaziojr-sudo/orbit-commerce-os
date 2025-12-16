// =============================================
// VIDEO UPLOAD BLOCK - Video with upload/library/URL support
// =============================================

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VideoIcon } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';

interface VideoUploadBlockProps {
  videoDesktop?: string;
  videoMobile?: string;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  aspectRatio?: string;
  aspectRatioCustom?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  context?: BlockRenderContext;
}

// Parse aspect ratio string to CSS value
function parseAspectRatio(ratio: string): string {
  if (!ratio || ratio === 'auto') return '';
  if (ratio === 'custom') return '';
  // Handle X/Y format (e.g., "16/9", "9/16")
  if (ratio.includes('/')) {
    return ratio.replace('/', ' / ');
  }
  // Handle decimal format (e.g., "1.78")
  const num = parseFloat(ratio);
  if (!isNaN(num)) {
    return `${num}`;
  }
  return '';
}

export function VideoUploadBlock({
  videoDesktop,
  videoMobile,
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  aspectRatio = 'auto',
  aspectRatioCustom = '',
  objectFit = 'contain',
  context,
}: VideoUploadBlockProps) {
  const [autoAspect, setAutoAspect] = useState<string>('16 / 9'); // Fallback
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Determine which video to show based on viewport
  const isMobile = context?.viewport === 'mobile';
  const isBuilderMode = context?.viewport !== undefined;
  
  // Get the appropriate video URL
  const desktopVideo = videoDesktop;
  const mobileVideo = videoMobile || videoDesktop; // Fallback to desktop if no mobile
  
  // Current video source
  const currentSrc = isBuilderMode
    ? (isMobile && mobileVideo ? mobileVideo : desktopVideo)
    : desktopVideo; // Public mode will use <source> elements
  
  // Calculate aspect ratio
  const getAspectRatioStyle = (): string => {
    if (aspectRatio === 'auto') {
      return autoAspect;
    }
    if (aspectRatio === 'custom' && aspectRatioCustom) {
      return parseAspectRatio(aspectRatioCustom) || autoAspect;
    }
    return parseAspectRatio(aspectRatio) || '16 / 9';
  };
  
  // Auto-detect aspect ratio from video metadata
  useEffect(() => {
    if (aspectRatio !== 'auto') return;
    
    const video = videoRef.current;
    if (!video) return;
    
    const handleMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        setAutoAspect(`${video.videoWidth} / ${video.videoHeight}`);
      }
    };
    
    video.addEventListener('loadedmetadata', handleMetadata);
    
    // If metadata already loaded
    if (video.videoWidth && video.videoHeight) {
      handleMetadata();
    }
    
    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
    };
  }, [aspectRatio, currentSrc]);
  
  // No video configured - show placeholder in builder, nothing in public
  if (!desktopVideo && !mobileVideo) {
    if (isBuilderMode) {
      return (
        <div 
          className="w-full bg-muted/30 flex items-center justify-center min-h-[180px] border-2 border-dashed border-muted-foreground/20 rounded-lg"
          style={{ aspectRatio: '16 / 9' }}
        >
          <div className="text-center">
            <VideoIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/60">Adicione um vídeo</p>
          </div>
        </div>
      );
    }
    return null;
  }

  const videoProps = {
    controls,
    autoPlay: autoplay,
    loop,
    muted: muted || autoplay, // Autoplay requires muted in most browsers
    playsInline: true,
  };

  const aspectRatioStyle = getAspectRatioStyle();
  
  const containerStyle: React.CSSProperties = {
    aspectRatio: aspectRatioStyle,
    width: '100%',
    position: 'relative',
    backgroundColor: objectFit === 'contain' ? 'hsl(var(--muted))' : undefined,
    overflow: 'hidden',
  };
  
  const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: objectFit,
    display: 'block',
  };

  // In builder mode, use viewport state to select video
  if (isBuilderMode) {
    const videoSrc = isMobile && mobileVideo ? mobileVideo : desktopVideo;
    
    if (!videoSrc) {
      return (
        <div style={containerStyle} className="flex items-center justify-center">
          <VideoIcon className="h-12 w-12 text-muted-foreground/30" />
        </div>
      );
    }
    
    return (
      <div style={containerStyle}>
        <video
          ref={videoRef}
          key={videoSrc} // Force re-render when source changes
          src={videoSrc}
          style={videoStyle}
          {...videoProps}
        />
      </div>
    );
  }

  // In public mode, use responsive sources
  return (
    <div style={containerStyle}>
      {/* Desktop video */}
      <video
        ref={videoRef}
        src={desktopVideo}
        className={cn(
          mobileVideo && mobileVideo !== desktopVideo && 'hidden md:block'
        )}
        style={videoStyle}
        {...videoProps}
      />
      
      {/* Mobile video (if different from desktop) */}
      {mobileVideo && mobileVideo !== desktopVideo && (
        <video
          src={mobileVideo}
          className="md:hidden"
          style={videoStyle}
          {...videoProps}
        />
      )}
    </div>
  );
}
