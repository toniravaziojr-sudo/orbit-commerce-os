// =============================================
// REVIEWS BLOCK — Customer reviews carousel (edge compiler)
// Parity with: src/components/builder/blocks/ReviewsBlock.tsx
// =============================================

import { CompilerContext } from '../index.ts';

interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  text: string;
  productName?: string;
  productUrl?: string;
  productImage?: string;
}

function renderStars(rating: number): string {
  let html = '<div style="display:flex;gap:2px;">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? '#fbbf24' : '#e5e7eb'}" stroke="${filled ? '#fbbf24' : '#e5e7eb'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
  html += '</div>';
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function reviewsToStaticHTML(props: Record<string, any>, _ctx: CompilerContext): string {
  const title = props.title ?? 'O que nossos clientes dizem';
  const reviews: ReviewItem[] = props.reviews || [];
  const visibleCount = props.visibleCount ?? 4;

  // In public mode, don't render if no real reviews
  if (!reviews || reviews.length === 0) {
    return '';
  }

  const actualReviews = reviews.slice(0, visibleCount);
  const needsNav = reviews.length > 4;
  const uid = `rv-${Math.random().toString(36).slice(2, 8)}`;

  let cardsHtml = actualReviews.map((review) => {
    const productHtml = review.productName ? `
      <div style="display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <div style="width:40px;height:40px;background:#f3f4f6;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${review.productImage 
            ? `<img src="${escapeHtml(review.productImage)}" alt="${escapeHtml(review.productName)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" loading="lazy"/>` 
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`}
        </div>
        <div style="min-width:0;">
          <p style="font-size:12px;color:var(--theme-text-secondary, #6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(review.productName)}</p>
          ${review.productUrl ? `<a href="${escapeHtml(review.productUrl)}" style="font-size:12px;color:var(--theme-button-primary-bg,#2563eb);text-decoration:none;">Ver produto ↗</a>` : ''}
        </div>
      </div>
    ` : '';

    return `
      <div class="${uid}-card" style="flex-shrink:0;background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        ${renderStars(review.rating)}
        <h3 style="font-weight:600;margin-top:12px;margin-bottom:8px;color:inherit;">${escapeHtml(review.name)}</h3>
        <p style="font-size:14px;color:#6b7280;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(review.text)}</p>
        ${productHtml}
      </div>
    `;
  }).join('');

  const navHtml = needsNav ? `
    <button data-scroll-dir="prev" data-scroll-target="${uid}-track" style="position:absolute;left:0;top:50%;transform:translate(-16px,-50%);width:40px;height:40px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <button data-scroll-dir="next" data-scroll-target="${uid}-track" style="position:absolute;right:0;top:50%;transform:translate(16px,-50%);width:40px;height:40px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  ` : '';

  return `
    <style>
      .${uid}-section{padding:32px 0;background:rgba(0,0,0,0.02);}
      .${uid}-track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0;}
      .${uid}-track::-webkit-scrollbar{display:none;}
      .${uid}-card{scroll-snap-align:start;width:calc(25% - 12px);}
      @media(max-width:768px){
        .${uid}-card{width:calc(100% - 16px);}
      }
    </style>
    <section class="${uid}-section">
      <div style="max-width:80rem;margin:0 auto;padding:0 16px;">
        ${title ? `<h2 style="font-size:24px;font-weight:700;margin-bottom:24px;text-align:center;color:inherit;">${escapeHtml(title)}</h2>` : ''}
        <div style="position:relative;">
          <div class="${uid}-track" id="${uid}-track">
            ${cardsHtml}
          </div>
          ${navHtml}
        </div>
      </div>
    </section>
  `;
}
