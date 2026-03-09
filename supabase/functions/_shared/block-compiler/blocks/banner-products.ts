// =============================================
// BANNER PRODUCTS BLOCK COMPILER
// Mirrors: src/components/builder/blocks/BannerProductsBlock.tsx
// Banner image + products grid side by side
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';
import { renderProductCard } from './shared/product-card-html.ts';

export const bannerProductsToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const title = (props.title as string) || 'Oferta Especial';
  const description = (props.description as string) || '';
  const imageDesktop = (props.imageDesktop as string) || '';
  const imageMobile = (props.imageMobile as string) || '';
  const source = (props.source as string) || 'manual';
  const limit = (props.limit as number) || 4;
  const showCta = (props.showCta as boolean) ?? false;
  const ctaText = (props.ctaText as string) || 'Ver mais';
  const ctaUrl = (props.ctaUrl as string) || '#';

  // Parse product IDs for manual source
  const rawIds = props.productIds;
  const productIdArray = Array.isArray(rawIds)
    ? rawIds.filter(Boolean) as string[]
    : typeof rawIds === 'string' && rawIds.trim()
      ? rawIds.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
      : [];

  // Gather products from context
  let products: Array<{ id: string; name: string; slug: string; price: number; compare_at_price?: number; free_shipping?: boolean; avg_rating?: number; review_count?: number; image_url?: string }> = [];

  if (source === 'manual' && productIdArray.length > 0) {
    for (const pid of productIdArray) {
      const p = context.products.get(pid);
      if (p) products.push({ ...p, image_url: context.productImages.get(pid) || '' });
    }
  } else if (source === 'category' && props.categoryId && context.categoryProducts) {
    products = context.categoryProducts.map(p => ({
      ...p,
      compare_at_price: p.compare_at_price ?? undefined,
      image_url: p.product_images?.find(i => i.is_primary)?.url || p.product_images?.[0]?.url,
    }));
  } else {
    for (const [id, p] of context.products) {
      products.push({ ...p, image_url: context.productImages.get(id) || '' });
    }
  }

  products = products.slice(0, limit);
  const cs = context.categorySettings || {};

  // Banner image
  const bannerImgDesktop = imageDesktop ? optimizeImageUrl(imageDesktop, 800, 80) : '';
  const bannerImgMobile = imageMobile ? optimizeImageUrl(imageMobile, 600, 80) : '';

  const bannerHtml = bannerImgDesktop
    ? `<div class="sf-bp-banner" style="background:#f5f5f5;border-radius:8px;overflow:hidden;min-height:400px;">
        <picture>
          ${bannerImgMobile ? `<source media="(max-width:768px)" srcset="${escapeHtml(bannerImgMobile)}">` : ''}
          <img src="${escapeHtml(bannerImgDesktop)}" alt="${escapeHtml(title)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
        </picture>
      </div>`
    : `<div class="sf-bp-banner" style="background:#f5f5f5;border-radius:8px;min-height:400px;display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;color:#999;"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><p style="font-size:14px;margin-top:8px;">Adicione uma imagem</p></div>
      </div>`;

  // Products grid
  const productsHtml = products.length > 0
    ? products.map(p => `<div class="sf-bp-prod">${renderProductCard(p, context, cs, true)}</div>`).join('')
    : `<div style="display:flex;align-items:center;justify-content:center;padding:48px 0;color:#888;font-size:14px;">Nenhum produto disponível</div>`;

  const gridCols = products.length <= 2 ? '1fr' : 'repeat(2,1fr)';

  const ctaHtml = showCta && ctaText
    ? `<div style="margin-top:24px;text-align:center;"><a href="${escapeHtml(ctaUrl)}" class="sf-btn-primary" style="display:inline-block;padding:12px 24px;border-radius:6px;font-weight:500;text-decoration:none;">${escapeHtml(ctaText)}</a></div>`
    : '';

  return `<section class="sf-bp-section" style="padding:32px 0;">
    <div style="max-width:1280px;margin:0 auto;padding:0 16px;">
      <div style="margin-bottom:24px;">
        <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:8px;color:inherit;">${escapeHtml(title)}</h2>
        ${description ? `<p style="color:#888;">${escapeHtml(description)}</p>` : ''}
      </div>
      <div class="sf-bp-layout" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;min-height:500px;">
        ${bannerHtml}
        <div style="display:grid;grid-template-columns:${gridCols};gap:12px;align-content:${products.length <= 2 ? 'center' : 'start'};">
          ${productsHtml}
        </div>
      </div>
      ${ctaHtml}
    </div>
    <style>
      @media(max-width:768px){
        .sf-bp-section{padding:16px 0 !important;}
        .sf-bp-layout{grid-template-columns:1fr !important;min-height:auto !important;}
        .sf-bp-banner{min-height:200px !important;aspect-ratio:3/2;}
        .sf-bp-layout > div:last-child{grid-template-columns:repeat(2,1fr) !important;}
      }
    </style>
  </section>`;
};
