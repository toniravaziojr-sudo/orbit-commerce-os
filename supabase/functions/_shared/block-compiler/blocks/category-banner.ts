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
  // PARITY FIX: Use bannerOverlayOpacity from categorySettings (theme settings),
  // NOT from block props. This matches CategoryBannerBlock.tsx which ignores
  // the block-level overlayOpacity and reads from categorySettings instead.
  // Block props.overlayOpacity is legacy and should NOT be used.
  const cs = context.categorySettings || {};
  const overlayOpacity = (cs.bannerOverlayOpacity as number) ?? 0;
  const height = (props.height as string) || 'md';

  // Check categorySettings for showBanner and showCategoryName
  const cs = context.categorySettings || {};
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

  if (bannerUrl) {
    // CRITICAL: Use direct URLs for banner images (no wsrv.nl proxy).
    // wsrv.nl can fail silently in browsers due to rate limits, referer checks,
    // or CDN issues, causing banners to show as empty gray boxes.
    // Banner images are already uploaded at the correct resolution by the user.
    // This ensures parity with the Builder (React) which uses direct URLs.
    const desktopSrc = bannerUrl;
    const mobileSrc = bannerMobileUrl || desktopSrc;

    return `
      <div style="position:relative;width:100%;overflow:hidden;background:#f5f5f5;">
        <picture>
          ${mobileSrc !== desktopSrc ? `<source srcset="${escapeHtml(mobileSrc)}" media="(max-width:768px)">` : ''}
          <img src="${escapeHtml(desktopSrc)}" alt="${escapeHtml(category.name)}" style="display:block;width:100%;height:auto;object-fit:cover;" loading="eager" fetchpriority="high">
        </picture>
        ${overlayBg !== 'transparent' || showCategoryName ? `
          <div style="position:absolute;inset:0;background:${overlayBg};display:flex;align-items:center;justify-content:${justify};padding:0 24px;">
            ${showCategoryName ? `<h1 style="font-size:clamp(24px,4vw,40px);font-weight:700;color:#fff;font-family:var(--sf-heading-font);text-shadow:0 2px 8px rgba(0,0,0,0.3);">${escapeHtml(category.name)}</h1>` : ''}
          </div>
        ` : ''}
      </div>`;
  }

  // No banner image - text-only header
  if (!showCategoryName) return '';

  return `
    <div style="padding:32px 16px;text-align:${titlePosition};">
      <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);">${escapeHtml(category.name)}</h1>
      ${category.description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#666);margin-top:8px;max-width:600px;${titlePosition === 'center' ? 'margin-left:auto;margin-right:auto;' : ''}">${escapeHtml(category.description)}</p>` : ''}
    </div>`;
};
