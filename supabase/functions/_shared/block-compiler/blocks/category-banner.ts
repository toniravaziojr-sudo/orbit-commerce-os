// =============================================
// CATEGORY BANNER COMPILER — Block compiler for CategoryBanner
// Mirrors: src/components/storefront/CategoryBanner.tsx
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

export const categoryBannerToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const category = context.currentCategory;
  if (!category) return '';

  const showTitle = (props.showTitle as boolean) ?? true;
  const titlePosition = (props.titlePosition as string) || 'center';
  const height = (props.height as string) || 'md';

  // PARITY FIX: Use bannerOverlayOpacity from categorySettings (theme settings),
  // NOT from block props. This matches CategoryBannerBlock.tsx which ignores
  // the block-level overlayOpacity and reads from categorySettings instead.
  // Block props.overlayOpacity is legacy and should NOT be used.
  const cs = context.categorySettings || {};
  const overlayOpacity = (cs.bannerOverlayOpacity as number) ?? 0;

  // Check categorySettings for showBanner and showCategoryName
  if (cs.showBanner === false) return '';

  const showCategoryName = cs.showCategoryName ?? showTitle;

  const heightMap: Record<string, string> = {
    'sm': '160px',
    'md': '200px',
    'lg': '280px',
    'xl': '360px',
  };
  const bannerHeight = heightMap[height] || '200px';

  const bannerUrl = category.banner_desktop_url;
  const bannerMobileUrl = category.banner_mobile_url;
  const overlayBg = overlayOpacity > 0 ? `rgba(0,0,0,${overlayOpacity / 100})` : 'transparent';

  const alignMap: Record<string, string> = {
    'left': 'flex-start',
    'center': 'center',
    'right': 'flex-end',
  };
  const justify = alignMap[titlePosition] || 'center';

  let html = '';

  if (bannerUrl) {
    const desktopSrc = bannerUrl;
    const mobileSrc = bannerMobileUrl || desktopSrc;

    html += `
      <div style="position:relative;width:100%;overflow:hidden;background:#f5f5f5;">
        <picture>
          ${mobileSrc !== desktopSrc ? `<source srcset="${escapeHtml(mobileSrc)}" media="(max-width:768px)">` : ''}
          <img src="${escapeHtml(desktopSrc)}" alt="${escapeHtml(category.name)}" style="display:block;width:100%;height:auto;object-fit:cover;" loading="eager" fetchpriority="high">
        </picture>
        ${overlayBg !== 'transparent' ? `
          <div style="position:absolute;inset:0;background:${overlayBg};pointer-events:none;"></div>
        ` : ''}
      </div>`;
  }

  // Title BELOW the banner (or standalone if no banner)
  if (showCategoryName) {
    html += `
      <div style="padding:12px 16px 16px;text-align:${titlePosition};">
        <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);">${escapeHtml(category.name)}</h1>
        ${category.description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#666);margin-top:8px;max-width:600px;${titlePosition === 'center' ? 'margin-left:auto;margin-right:auto;' : ''}">${escapeHtml(category.description)}</p>` : ''}
      </div>`;
  }

  return html;
};
