// =============================================
// VIDEO UPLOAD BLOCK - Video with upload/library/URL support
// =============================================

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
  context?: BlockRenderContext;
}

export function VideoUploadBlock({
  videoDesktop,
  videoMobile,
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  context,
}: VideoUploadBlockProps) {
  // Determine which video to show based on viewport
  const isMobile = context?.viewport === 'mobile';
  const isBuilderMode = context?.viewport !== undefined;
  
  // Get the appropriate video URL
  const desktopVideo = videoDesktop;
  const mobileVideo = videoMobile || videoDesktop; // Fallback to desktop if no mobile
  
  // No video configured - show placeholder in builder, nothing in public
  if (!desktopVideo && !mobileVideo) {
    if (isBuilderMode) {
      return (
        <div className="w-full aspect-video bg-muted/30 flex items-center justify-center min-h-[180px] border-2 border-dashed border-muted-foreground/20 rounded-lg">
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

  // In builder mode, use viewport state to select video
  if (isBuilderMode) {
    const videoSrc = isMobile && mobileVideo ? mobileVideo : desktopVideo;
    
    if (!videoSrc) {
      return (
        <div className="w-full aspect-video bg-muted/30 flex items-center justify-center">
          <VideoIcon className="h-12 w-12 text-muted-foreground/30" />
        </div>
      );
    }
    
    return (
      <div className="w-full">
        <video
          key={videoSrc} // Force re-render when source changes
          src={videoSrc}
          className="w-full aspect-video object-cover"
          {...videoProps}
        />
      </div>
    );
  }

  // In public mode, use multiple sources for responsive behavior
  return (
    <div className="w-full">
      {/* Desktop video */}
      <video
        src={desktopVideo}
        className={cn(
          'w-full aspect-video object-cover',
          mobileVideo && 'hidden md:block'
        )}
        {...videoProps}
      />
      
      {/* Mobile video (if different from desktop) */}
      {mobileVideo && mobileVideo !== desktopVideo && (
        <video
          src={mobileVideo}
          className="w-full aspect-video object-cover md:hidden"
          {...videoProps}
        />
      )}
    </div>
  );
}
