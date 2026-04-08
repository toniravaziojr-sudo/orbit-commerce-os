// =============================================
// VIDEO BLOCK COMPILER — Unified (YouTubeVideo + VideoUpload)
// Routes to youtube-video or video-upload based on source
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { youtubeVideoToStaticHTML } from './youtube-video.ts';
import { videoUploadToStaticHTML } from './video-upload.ts';

export const videoToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const source = (props.source as string) || 'youtube';

  if (source === 'upload') {
    return videoUploadToStaticHTML(props, context);
  }

  return youtubeVideoToStaticHTML(props, context);
};
