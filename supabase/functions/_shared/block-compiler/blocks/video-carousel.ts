// =============================================
// VIDEO CAROUSEL BLOCK COMPILER
// Mirrors: src/components/builder/blocks/VideoCarouselBlock.tsx
// Renders first video as embed + thumbnail strip for JS hydration
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

interface VideoItem {
  id?: string;
  type?: 'youtube' | 'upload';
  url?: string;
  videoDesktop?: string;
  videoMobile?: string;
  title?: string;
  thumbnail?: string;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i);
  return m ? m[1] : null;
}

function isUploadedVideo(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lower.includes(ext)) ||
    lower.includes('/storage/') || lower.includes('supabase');
}

const aspectMap: Record<string, string> = {
  '16:9': '56.25%',
  '4:3': '75%',
  '1:1': '100%',
};

export const videoCarouselToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const rawVideos = props.videos as VideoItem[] | undefined;
  const aspectRatio = (props.aspectRatio as string) || '16:9';

  const videos = (Array.isArray(rawVideos) ? rawVideos : [])
    .map(v => {
      const url = v.url || v.videoDesktop || v.videoMobile || '';
      const type = v.type || (isUploadedVideo(url) ? 'upload' : 'youtube');
      return { ...v, url, type };
    })
    .filter(v => v.url && (v.type === 'upload' || extractYouTubeId(v.url)));

  if (videos.length === 0) return '';

  const padding = aspectMap[aspectRatio] || aspectMap['16:9'];
  const first = videos[0];
  const firstYtId = first.type === 'youtube' ? extractYouTubeId(first.url!) : null;

  // Render first video
  let mainVideoHtml: string;
  if (first.type === 'upload') {
    mainVideoHtml = `<video src="${first.url}" controls playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;"></video>`;
  } else if (firstYtId) {
    mainVideoHtml = `<iframe src="https://www.youtube.com/embed/${firstYtId}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>`;
  } else {
    mainVideoHtml = '';
  }

  // Thumbnail strip
  const thumbsHtml = videos.length > 1 ? videos.map((v, i) => {
    const ytId = v.type === 'youtube' ? extractYouTubeId(v.url!) : null;
    const thumb = v.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '');
    const active = i === 0 ? 'border:2px solid var(--theme-button-primary-bg,#1a1a1a);opacity:1;' : 'border:2px solid transparent;opacity:0.7;';
    return `<button data-sf-video-idx="${i}" style="flex-shrink:0;width:8rem;height:4.5rem;border-radius:0.375rem;overflow:hidden;${active}cursor:pointer;background:#333;">
  ${thumb ? `<img src="${thumb}" alt="${escapeHtml(v.title || `Video ${i + 1}`)}" style="width:100%;height:100%;object-fit:cover;">` : ''}
</button>`;
  }).join('\n') : '';

  return `<div class="sf-video-carousel" style="width:100%;">
  ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem;text-align:center;">${escapeHtml(title)}</h2>` : ''}
  <div style="position:relative;width:100%;padding-bottom:${padding};border-radius:0.5rem;overflow:hidden;background:#000;">
    ${mainVideoHtml}
  </div>
  ${thumbsHtml ? `<div style="margin-top:1rem;display:flex;gap:0.5rem;overflow-x:auto;padding-bottom:0.5rem;">${thumbsHtml}</div>` : ''}
  ${videos.length > 1 ? `<div style="margin-top:0.5rem;text-align:center;font-size:0.875rem;color:var(--theme-text-secondary, #888);">1 / ${videos.length}</div>` : ''}
</div>`;
};
