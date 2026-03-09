// =============================================
// VIDEO UPLOAD BLOCK — Self-hosted video player (edge compiler)
// Parity with: src/components/builder/blocks/VideoUploadBlock.tsx
// =============================================

import { CompilerContext } from '../index.ts';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseAspectRatio(ratio: string): string {
  if (!ratio || ratio === 'auto') return '16 / 9';
  if (ratio === 'custom') return '';
  if (ratio.includes('/')) return ratio.replace('/', ' / ');
  const num = parseFloat(ratio);
  if (!isNaN(num)) return `${num}`;
  return '16 / 9';
}

export function videoUploadToStaticHTML(props: Record<string, any>, _ctx: CompilerContext): string {
  const videoDesktop = props.videoDesktop || '';
  const videoMobile = props.videoMobile || '';
  const controls = props.controls !== false;
  const autoplay = props.autoplay === true;
  const loop = props.loop === true;
  const muted = props.muted === true || autoplay;
  const aspectRatio = props.aspectRatio || 'auto';
  const aspectRatioCustom = props.aspectRatioCustom || '';
  const objectFit = props.objectFit || 'contain';

  // No video = nothing
  if (!videoDesktop && !videoMobile) return '';

  const computedAR = aspectRatio === 'custom' && aspectRatioCustom
    ? (parseAspectRatio(aspectRatioCustom) || '16 / 9')
    : parseAspectRatio(aspectRatio);

  const attrs: string[] = ['playsinline'];
  if (controls) attrs.push('controls');
  if (autoplay) attrs.push('autoplay');
  if (loop) attrs.push('loop');
  if (muted) attrs.push('muted');

  const attrsStr = attrs.join(' ');
  const videoStyle = `width:100%;height:100%;object-fit:${objectFit};display:block;`;
  const containerStyle = `aspect-ratio:${computedAR};width:100%;position:relative;overflow:hidden;${objectFit === 'contain' ? 'background:#f3f4f6;' : ''}`;

  const hasDifferentMobile = videoMobile && videoMobile !== videoDesktop;

  if (hasDifferentMobile) {
    // Two separate video elements with responsive display
    return `
      <div style="${containerStyle}">
        <video src="${escapeHtml(videoDesktop)}" style="${videoStyle}display:none;" class="sf-vid-desktop" ${attrsStr}></video>
        <video src="${escapeHtml(videoMobile)}" style="${videoStyle}display:none;" class="sf-vid-mobile" ${attrsStr}></video>
      </div>
      <style>
        @media(min-width:769px){.sf-vid-desktop{display:block!important;}.sf-vid-mobile{display:none!important;}}
        @media(max-width:768px){.sf-vid-desktop{display:none!important;}.sf-vid-mobile{display:block!important;}}
      </style>
    `;
  }

  // Single video
  const src = videoDesktop || videoMobile;
  return `
    <div style="${containerStyle}">
      <video src="${escapeHtml(src)}" style="${videoStyle}" ${attrsStr}></video>
    </div>
  `;
}
