// =============================================
// VIDEO CAROUSEL BLOCK COMPILER
// Mirrors: src/components/builder/blocks/VideoCarouselBlock.tsx
// Supports: carousel + grid layouts, maxWidth, pagination
// Hydration: data-sf-video-carousel
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

// =============================================
// TYPES
// =============================================

interface VideoItem {
  id?: string;
  type?: 'youtube' | 'upload';
  url?: string;
  videoDesktop?: string;
  videoMobile?: string;
  title?: string;
  thumbnail?: string;
}

// =============================================
// HELPERS
// =============================================

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return m ? m[1] : null;
}

function isUploadedVideo(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lower.includes(ext)) ||
    lower.includes('/storage/') || lower.includes('supabase');
}

const ASPECT_PADDING: Record<string, string> = {
  '16:9': '56.25%',
  '4:3': '75%',
  '1:1': '100%',
  '9:16': '177.78%',
};

const MAX_WIDTH_PX: Record<string, string> = {
  small: '448px',
  medium: '576px',
  large: '768px',
  full: '100%',
};

function normalizeVideos(rawVideos: VideoItem[] | undefined): (VideoItem & { url: string; type: 'youtube' | 'upload' })[] {
  return (Array.isArray(rawVideos) ? rawVideos : [])
    .map(v => {
      const url = v.url || v.videoDesktop || v.videoMobile || '';
      const type = v.type || (isUploadedVideo(url) ? 'upload' : 'youtube');
      return { ...v, url, type } as VideoItem & { url: string; type: 'youtube' | 'upload' };
    })
    .filter(v => v.url && (v.type === 'upload' || extractYouTubeId(v.url)));
}

// =============================================
// RENDERERS (pure functions)
// =============================================

function renderVideoEmbed(video: { url: string; type: string }, padding: string): string {
  const ytId = video.type === 'youtube' ? extractYouTubeId(video.url) : null;

  if (video.type === 'upload') {
    return `<div style="position:relative;width:100%;padding-bottom:${padding};border-radius:0.5rem;overflow:hidden;background:#000;">
  <video src="${video.url}" controls playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;"></video>
</div>`;
  }

  if (ytId) {
    return `<div style="position:relative;width:100%;padding-bottom:${padding};border-radius:0.5rem;overflow:hidden;background:#000;">
  <iframe src="https://www.youtube.com/embed/${ytId}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>
</div>`;
  }

  return '';
}

function renderThumbnail(video: VideoItem & { url: string; type: string }, index: number, isActive: boolean): string {
  const ytId = video.type === 'youtube' ? extractYouTubeId(video.url) : null;
  const thumb = video.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '');
  const border = isActive
    ? 'border:2px solid var(--theme-button-primary-bg,#1a1a1a);opacity:1;'
    : 'border:2px solid transparent;opacity:0.7;';

  return `<button data-sf-video-idx="${index}" style="flex-shrink:0;width:8rem;height:4.5rem;border-radius:0.375rem;overflow:hidden;${border}cursor:pointer;background:#333;">
  ${thumb ? `<img src="${thumb}" alt="${escapeHtml(video.title || `Video ${index + 1}`)}" style="width:100%;height:100%;object-fit:cover;">` : ''}
</button>`;
}

function renderGridCard(video: VideoItem & { url: string; type: string }, padding: string): string {
  const ytId = video.type === 'youtube' ? extractYouTubeId(video.url) : null;
  const thumb = video.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '');

  return `<div style="position:relative;width:100%;padding-bottom:${padding};border-radius:0.5rem;overflow:hidden;background:#000;cursor:pointer;" data-sf-video-grid-item data-sf-video-url="${escapeHtml(video.url)}" data-sf-video-type="${video.type}">
  ${thumb ? `<img src="${thumb}" alt="${escapeHtml(video.title || 'Video')}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">` : ''}
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);">
    <div style="width:3rem;height:3rem;border-radius:50%;background:${video.type === 'youtube' ? '#dc2626' : 'var(--theme-button-primary-bg,#1a1a1a)'};display:flex;align-items:center;justify-content:center;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </div>
  </div>
  ${video.title ? `<div style="position:absolute;bottom:0;left:0;right:0;padding:0.5rem;background:linear-gradient(transparent,rgba(0,0,0,0.8));"><span style="color:#fff;font-size:0.75rem;font-weight:500;">${escapeHtml(video.title)}</span></div>` : ''}
</div>`;
}

function getGridTemplateColumns(itemsPerRow: number): string {
  switch (itemsPerRow) {
    case 1: return '1fr';
    case 2: return 'repeat(2, 1fr)';
    case 4: return 'repeat(4, 1fr)';
    default: return 'repeat(3, 1fr)';
  }
}

// =============================================
// MAIN COMPILER
// =============================================

export const videoCarouselToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const rawVideos = props.videos as VideoItem[] | undefined;
  const aspectRatio = (props.aspectRatio as string) || '16:9';
  const maxWidth = (props.maxWidth as string) || 'full';
  const layout = (props.layout as string) || 'carousel';
  const itemsPerRow = (props.itemsPerRow as number) || 3;
  const itemsPerPage = (props.itemsPerPage as number) || 6;

  const videos = normalizeVideos(rawVideos);
  if (videos.length === 0) return '';

  const padding = ASPECT_PADDING[aspectRatio] || ASPECT_PADDING['16:9'];
  const maxW = MAX_WIDTH_PX[maxWidth] || '100%';
  const containerStyle = `width:100%;max-width:${maxW};margin:0 auto;`;

  const titleHtml = title
    ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem;text-align:center;">${escapeHtml(title)}</h2>`
    : '';

  // ── GRID LAYOUT ──
  if (layout === 'grid') {
    const pageVideos = videos.slice(0, itemsPerPage);
    const cols = getGridTemplateColumns(itemsPerRow);
    const cardsHtml = pageVideos.map(v => renderGridCard(v, padding)).join('\n');

    const paginationHtml = videos.length > itemsPerPage
      ? `<div style="margin-top:1rem;text-align:center;font-size:0.875rem;color:var(--theme-text-secondary,#888);">1 / ${Math.ceil(videos.length / itemsPerPage)}</div>`
      : '';

    return `<div class="sf-video-carousel" data-sf-video-carousel data-sf-layout="grid" data-sf-items-per-page="${itemsPerPage}" data-sf-total="${videos.length}" style="${containerStyle}">
  ${titleHtml}
  <div style="display:grid;grid-template-columns:${cols};gap:1rem;">
    ${cardsHtml}
  </div>
  ${paginationHtml}
</div>`;
  }

  // ── CAROUSEL LAYOUT (default) ──
  const first = videos[0];
  const mainVideoHtml = renderVideoEmbed(first, padding);

  const thumbsHtml = videos.length > 1
    ? videos.map((v, i) => renderThumbnail(v, i, i === 0)).join('\n')
    : '';

  const counterHtml = videos.length > 1
    ? `<div style="margin-top:0.5rem;text-align:center;font-size:0.875rem;color:var(--theme-text-secondary, #888);">1 / ${videos.length}</div>`
    : '';

  return `<div class="sf-video-carousel" data-sf-video-carousel data-sf-layout="carousel" style="${containerStyle}">
  ${titleHtml}
  ${mainVideoHtml}
  ${thumbsHtml ? `<div style="margin-top:1rem;display:flex;gap:0.5rem;overflow-x:auto;padding-bottom:0.5rem;">${thumbsHtml}</div>` : ''}
  ${counterHtml}
</div>`;
};
