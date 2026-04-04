// =============================================
// YOUTUBE VIDEO BLOCK COMPILER
// Mirrors: src/components/builder/blocks/YouTubeVideoBlock.tsx
// Renders responsive YouTube iframe embed
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const widthMap: Record<string, string> = {
  sm: '36rem',
  md: '42rem',
  lg: '56rem',
  xl: '72rem',
  full: 'none',
};

const aspectMap: Record<string, string> = {
  '16:9': '56.25%',
  '4:3': '75%',
  '1:1': '100%',
  '9:16': '177.78%',
};

export const youtubeVideoToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const youtubeUrl = (props.youtubeUrl as string) || '';
  const widthPreset = (props.widthPreset as string) || 'lg';
  const aspectRatio = (props.aspectRatio as string) || '16:9';

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) return '';

  const maxW = widthMap[widthPreset] || widthMap.lg;
  const padding = aspectMap[aspectRatio] || aspectMap['16:9'];

  return `<section style="padding:2rem 0;">
  <div style="max-width:${maxW};margin:0 auto;padding:0 1rem;">
    ${title ? `<h2 style="font-size:1.25rem;font-weight:600;margin-bottom:1rem;text-align:center;">${escapeHtml(title)}</h2>` : ''}
    <div style="position:relative;width:100%;padding-bottom:${padding};border-radius:0.5rem;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,.15);">
      <iframe src="https://www.youtube.com/embed/${videoId}" title="${escapeHtml(title || 'YouTube video')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>
    </div>
  </div>
</section>`;
};
