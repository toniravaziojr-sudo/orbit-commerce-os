// =============================================
// VIDEO CAROUSEL BLOCK COMPILER
// Mirrors: src/components/builder/blocks/video-carousel/
// Supports: carousel (embla multi-item) + grid layouts
// Hydration: data-sf-video-carousel
// v2.0.0: Added itemsPerSlide for carousel mode
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
// HELPERS (pure functions)
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

function toSafeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
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

function renderThumbnailCard(video: VideoItem & { url: string; type: string }, padding: string): string {
  const ytId = video.type === 'youtube' ? extractYouTubeId(video.url) : null;
  const thumb = video.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : '');
  const playBg = video.type === 'youtube' ? '#dc2626' : 'var(--theme-button-primary-bg,#1a1a1a)';
  const badge = video.type === 'youtube'
    ? `<div style="position:absolute;top:0.5rem;left:0.5rem;display:flex;align-items:center;gap:0.25rem;background:#dc2626;color:#fff;font-size:0.7rem;padding:0.125rem 0.5rem;border-radius:0.25rem;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z"/></svg>
        YouTube
      </div>`
    : `<div style="position:absolute;top:0.5rem;left:0.5rem;display:flex;align-items:center;gap:0.25rem;background:var(--theme-button-primary-bg,#1a1a1a);color:#fff;font-size:0.7rem;padding:0.125rem 0.5rem;border-radius:0.25rem;">Vídeo</div>`;

  return `<div style="position:relative;width:100%;padding-bottom:${padding};border-radius:0.5rem;overflow:hidden;background:#000;cursor:pointer;" data-sf-video-item data-sf-video-url="${escapeHtml(video.url)}" data-sf-video-type="${video.type}">
  ${thumb ? `<img src="${thumb}" alt="${escapeHtml(video.title || 'Video')}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" loading="lazy">` : ''}
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);">
    <div style="width:3.5rem;height:3.5rem;border-radius:50%;background:${playBg};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </div>
  </div>
  ${badge}
  ${video.title ? `<div style="position:absolute;bottom:0;left:0;right:0;padding:0.5rem 0.75rem;background:linear-gradient(transparent,rgba(0,0,0,0.8));"><span style="color:#fff;font-size:0.8rem;font-weight:500;">${escapeHtml(video.title)}</span></div>` : ''}
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
  const itemsPerRow = toSafeNumber(props.itemsPerRow, 3);
  const itemsPerPage = toSafeNumber(props.itemsPerPage, 6);
  const itemsPerSlide = toSafeNumber(props.itemsPerSlide, 1);

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
    const cardsHtml = pageVideos.map(v => renderThumbnailCard(v, padding)).join('\n');

    const paginationHtml = videos.length > itemsPerPage
      ? `<div style="margin-top:1rem;text-align:center;font-size:0.875rem;color:var(--theme-text-secondary,#888);">1 / ${Math.ceil(videos.length / itemsPerPage)}</div>`
      : '';

    return `<div class="sf-video-carousel" data-sf-video-carousel data-sf-layout="grid" data-sf-items-per-row="${itemsPerRow}" data-sf-items-per-page="${itemsPerPage}" data-sf-total="${videos.length}" style="${containerStyle}">
  ${titleHtml}
  <div style="display:grid;grid-template-columns:${cols};gap:1rem;">
    ${cardsHtml}
  </div>
  ${paginationHtml}
</div>`;
  }

  // ── CAROUSEL LAYOUT ──
  // Renders all items in a horizontal strip; hydration script handles sliding
  const slidePct = 100 / itemsPerSlide;
  const gap = itemsPerSlide > 1 ? '1rem' : '0';
  const slideWidth = itemsPerSlide > 1
    ? `calc(${slidePct.toFixed(2)}% - ${((itemsPerSlide - 1) * 16) / itemsPerSlide}px)`
    : '100%';

  const slidesHtml = videos.map(v =>
    `<div style="flex:0 0 ${slideWidth};min-width:0;">${renderThumbnailCard(v, padding)}</div>`
  ).join('\n');

  const dotsHtml = videos.length > itemsPerSlide
    ? `<div style="margin-top:0.75rem;display:flex;justify-content:center;gap:0.375rem;" data-sf-carousel-dots>
  ${Array.from({ length: Math.ceil(videos.length / itemsPerSlide) }).map((_, i) =>
    `<button data-sf-dot="${i}" style="width:${i === 0 ? '1rem' : '0.5rem'};height:0.5rem;border-radius:9999px;background:${i === 0 ? 'var(--theme-button-primary-bg,#1a1a1a)' : 'rgba(0,0,0,0.2)'};border:none;cursor:pointer;transition:all 0.2s;"></button>`
  ).join('')}
</div>`
    : '';

  return `<div class="sf-video-carousel" data-sf-video-carousel data-sf-layout="carousel" data-sf-items-per-slide="${itemsPerSlide}" data-sf-total="${videos.length}" style="${containerStyle}">
  ${titleHtml}
  <div style="overflow:hidden;border-radius:0.5rem;" data-sf-carousel-viewport>
    <div style="display:flex;gap:${gap};transition:transform 0.3s ease;" data-sf-carousel-track>
      ${slidesHtml}
    </div>
  </div>
  ${videos.length > itemsPerSlide ? `
  <button data-sf-carousel-prev style="position:absolute;left:0.5rem;top:50%;transform:translateY(-50%);width:2.5rem;height:2.5rem;border-radius:50%;background:rgba(255,255,255,0.9);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
  </button>
  <button data-sf-carousel-next style="position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);width:2.5rem;height:2.5rem;border-radius:50%;background:rgba(255,255,255,0.9);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
  </button>
  ` : ''}
  ${dotsHtml}
</div>`;
};
