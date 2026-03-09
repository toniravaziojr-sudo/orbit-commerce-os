// =============================================
// CATEGORY LIST BLOCK COMPILER
// Mirrors: src/components/builder/blocks/CategoryListBlock.tsx
// Renders categories in grid or list layout
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface CategoryItemConfig {
  categoryId: string;
  imageOverride?: string;
}

export const categoryListToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const layout = (props.layout as string) || 'grid';
  const columnsDesktop = (props.columnsDesktop as number) || (props.columns as number) || 4;
  const columnsMobile = (props.columnsMobile as number) || 2;
  const showImage = (props.showImage as boolean) ?? true;
  const showDescription = (props.showDescription as boolean) ?? false;
  const source = (props.source as string) || 'auto';
  const items = (props.items as CategoryItemConfig[]) || [];

  // Gather categories
  let categories: Array<{ id: string; name: string; slug: string; image_url?: string; description?: string }> = [];

  if ((source === 'custom') && items.length > 0) {
    // Custom mode: use items order, look up from context
    for (const item of items) {
      const cat = context.categories.get(item.categoryId);
      if (cat) {
        categories.push({ ...cat, image_url: item.imageOverride || cat.image_url });
      }
    }
  } else {
    // Auto/all/parent: use all categories from context
    for (const [, cat] of context.categories) {
      categories.push(cat);
    }
  }

  if (categories.length === 0) return '';

  if (layout === 'list') {
    const listItems = categories.map(cat => {
      const imgHtml = showImage && cat.image_url
        ? `<div style="width:48px;height:48px;border-radius:6px;overflow:hidden;background:#f5f5f5;flex-shrink:0;"><img src="${escapeHtml(optimizeImageUrl(cat.image_url, 96, 80))}" alt="${escapeHtml(cat.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"></div>`
        : '';
      const descHtml = showDescription && cat.description
        ? `<p style="font-size:12px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(cat.description)}</p>`
        : '';
      return `<a href="/categoria/${escapeHtml(cat.slug)}" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--theme-card-bg,#fff);border-radius:8px;border:1px solid var(--theme-card-border,#f0f0f0);text-decoration:none;color:inherit;transition:background .2s;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='var(--theme-card-bg,#fff)'">
        ${imgHtml}
        <div style="flex:1;min-width:0;">
          <h3 style="font-size:14px;font-weight:500;color:inherit;">${escapeHtml(cat.name)}</h3>
          ${descHtml}
        </div>
      </a>`;
    }).join('');

    return `<div style="display:flex;flex-direction:column;gap:8px;padding:16px;">${listItems}</div>`;
  }

  // Grid layout (default)
  const gridItems = categories.map(cat => {
    const imgHtml = showImage
      ? cat.image_url
        ? `<div style="aspect-ratio:1;overflow:hidden;background:#f5f5f5;"><img src="${escapeHtml(optimizeImageUrl(cat.image_url, 400, 80))}" alt="${escapeHtml(cat.name)}" style="width:100%;height:100%;object-fit:cover;transition:transform .3s;" loading="lazy"></div>`
        : `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f5f5f5,#e5e5e5);"><span style="font-size:2rem;font-weight:600;color:#999;">${escapeHtml(cat.name.charAt(0).toUpperCase())}</span></div>`
      : '';
    const descHtml = showDescription && cat.description
      ? `<p style="margin-top:4px;font-size:12px;color:#888;text-align:center;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(cat.description)}</p>`
      : '';
    return `<a href="/categoria/${escapeHtml(cat.slug)}" class="sf-cl-card" style="display:block;text-decoration:none;color:inherit;background:var(--theme-card-bg,#fff);border-radius:8px;overflow:hidden;border:1px solid var(--theme-card-border,#f0f0f0);transition:box-shadow .2s;">
      ${imgHtml}
      <div style="padding:12px;">
        <h3 style="font-size:14px;font-weight:500;text-align:center;color:inherit;">${escapeHtml(cat.name)}</h3>
        ${descHtml}
      </div>
    </a>`;
  }).join('');

  return `<div class="sf-cl-section" style="padding:16px;">
    <div class="sf-cl-grid" style="display:grid;grid-template-columns:repeat(${columnsDesktop},1fr);gap:16px;">
      ${gridItems}
    </div>
    <style>
      @media(max-width:768px){
        .sf-cl-grid{grid-template-columns:repeat(${columnsMobile},1fr) !important;gap:8px !important;}
      }
      .sf-cl-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);}
      .sf-cl-card:hover img{transform:scale(1.05);}
    </style>
  </div>`;
};
