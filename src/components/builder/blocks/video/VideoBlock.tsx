// =============================================
// VIDEO BLOCK - Unified (YouTubeVideo + VideoUpload)
// source: 'youtube' = YouTube embed (ex-YouTubeVideo)
// source: 'upload' = Self-hosted video (ex-VideoUpload)
// =============================================

import React from 'react';
import { YouTubeVideoBlock } from '../YouTubeVideoBlock';
import { VideoUploadBlock } from '../VideoUploadBlock';
import type { VideoBlockProps } from './types';

export function VideoBlock({
  source = 'youtube',
  title,
  youtubeUrl,
  widthPreset = 'lg',
  videoDesktop,
  videoMobile,
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  aspectRatio = '16:9',
  aspectRatioCustom,
  objectFit = 'contain',
  context,
}: VideoBlockProps) {
  if (source === 'upload') {
    return (
      <VideoUploadBlock
        videoDesktop={videoDesktop}
        videoMobile={videoMobile}
        controls={controls}
        autoplay={autoplay}
        loop={loop}
        muted={muted}
        aspectRatio={aspectRatio === '16:9' ? 'auto' : aspectRatio}
        aspectRatioCustom={aspectRatioCustom}
        objectFit={objectFit}
        context={context}
      />
    );
  }

  // YouTube mode (default)
  return (
    <YouTubeVideoBlock
      title={title}
      youtubeUrl={youtubeUrl}
      widthPreset={widthPreset}
      aspectRatio={aspectRatio as any}
      context={context}
    />
  );
}
