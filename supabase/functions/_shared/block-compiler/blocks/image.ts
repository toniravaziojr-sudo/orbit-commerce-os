// =============================================
// IMAGE BLOCK COMPILER
// Mirrors: src/components/builder/blocks/content/ImageBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';

const widthMap: Record<string, string> = {
  '25': '25%',
  '50': '50%',
  '75': '75%',
  'full': '100%',
};

const roundedMap: Record<string, string> = {
  'none': '0',
  'sm': '0.25rem',
  'md': '0.5rem',
  'lg': '1rem',
  'full': '9999px',
};

const shadowMap: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
};

const aspectRatioMap: Record<string, string> = {
  'auto': 'auto',
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '16:9': '16 / 9',
  '21:9': '21 / 9',
};

function optimizeImageUrl(url: string | undefined, width: number): string {
  if (!url) return '';
  if (url.includes('supabase.co/storage')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}&quality=80`;
  }
  return url;
}

export function imageToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext
): string {
  const imageDesktop = (props.imageDesktop as string) || (props.src as string);
  const imageMobile = (props.imageMobile as string) || imageDesktop;
  const alt = (props.alt as string) || 'Imagem';
  const width = (props.width as string) || 'full';
  const height = (props.height as string) || 'auto';
  const objectFit = (props.objectFit as string) || 'cover';
  const objectPosition = (props.objectPosition as string) || 'center';
  const aspectRatio = (props.aspectRatio as string) || 'auto';
  const rounded = (props.rounded as string) || 'none';
  const shadow = (props.shadow as string) || 'none';
  const linkUrl = props.linkUrl as string;

  if (!imageDesktop) {
    return `<div class="sf-image-placeholder" style="width:${widthMap[width] || '100%'};height:12rem;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;border-radius:${roundedMap[rounded] || '0'};">Imagem</div>`;
  }

  const desktopUrl = optimizeImageUrl(imageDesktop, 1200);
  const mobileUrl = optimizeImageUrl(imageMobile, 768);
  
  const imgStyle = `width:100%;height:${height === 'auto' ? 'auto' : height};object-fit:${objectFit};object-position:${objectPosition};aspect-ratio:${aspectRatioMap[aspectRatio] || 'auto'};border-radius:${roundedMap[rounded] || '0'};`;
  const wrapperStyle = `width:${widthMap[width] || '100%'};border-radius:${roundedMap[rounded] || '0'};box-shadow:${shadowMap[shadow] || 'none'};overflow:hidden;`;

  let pictureHtml = `<picture>`;
  if (mobileUrl && mobileUrl !== desktopUrl) {
    pictureHtml += `<source media="(max-width: 767px)" srcset="${mobileUrl}">`;
  }
  pictureHtml += `<img src="${desktopUrl}" alt="${alt}" loading="lazy" decoding="async" style="${imgStyle}"></picture>`;

  const content = `<div class="sf-image-block" style="${wrapperStyle}">${pictureHtml}</div>`;

  if (linkUrl) {
    return `<a href="${linkUrl}">${content}</a>`;
  }

  return content;
}
