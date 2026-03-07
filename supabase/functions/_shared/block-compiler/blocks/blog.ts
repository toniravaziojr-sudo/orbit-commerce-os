// =============================================
// BLOG COMPILERS — Blog index and post pages
// Mirrors: src/pages/storefront/StorefrontBlog*.tsx
// =============================================

import { escapeHtml, optimizeImageUrl } from '../utils.ts';

export function blogIndexToStaticHTML(posts: any[], storeName: string): string {
  const postsGrid = posts.map((post: any) => {
    const imgUrl = post.cover_image_url;
    const optimized = imgUrl ? optimizeImageUrl(imgUrl, 400, 80) : '';
    const dateStr = post.published_at
      ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    return `
      <a href="/blog/${escapeHtml(post.slug)}" style="display:block;text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;transition:box-shadow .2s;">
        ${optimized ? `<div style="aspect-ratio:16/9;background:#f9f9f9;overflow:hidden;"><img src="${escapeHtml(optimized)}" alt="${escapeHtml(post.title)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"></div>` : ''}
        <div style="padding:16px;">
          <p style="font-size:16px;font-weight:600;line-height:1.4;margin-bottom:8px;font-family:var(--sf-heading-font);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(post.title)}</p>
          ${post.excerpt ? `<p style="font-size:14px;color:var(--theme-text-secondary,#666);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(post.excerpt)}</p>` : ''}
          ${dateStr ? `<p style="font-size:12px;color:#999;margin-top:8px;">${dateStr}</p>` : ''}
        </div>
      </a>`;
  }).join('');

  return `
    <div style="max-width:1280px;margin:0 auto;padding:48px 16px;">
      <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);margin-bottom:32px;">Blog</h1>
      <style>
        .sf-blog-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 24px; }
        @media(min-width:640px) { .sf-blog-grid { grid-template-columns: repeat(2, 1fr); } }
        @media(min-width:1024px) { .sf-blog-grid { grid-template-columns: repeat(3, 1fr); } }
      </style>
      <div class="sf-blog-grid">${postsGrid}</div>
      ${posts.length === 0 ? '<p style="text-align:center;color:#999;padding:48px 0;">Nenhum post publicado ainda.</p>' : ''}
    </div>`;
}

export function blogPostToStaticHTML(post: any, hostname: string): string {
  const coverUrl = post.cover_image_url;
  const optimizedCover = coverUrl ? optimizeImageUrl(coverUrl, 1200, 85) : '';
  const dateStr = post.published_at
    ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt || '',
    "image": coverUrl || undefined,
    "datePublished": post.published_at || post.created_at,
    "url": `https://${hostname}/blog/${post.slug}`,
    "author": post.author_name ? { "@type": "Person", "name": post.author_name } : undefined,
  });

  return `
    <script type="application/ld+json">${jsonLd}</script>
    <article style="max-width:800px;margin:0 auto;padding:48px 16px;">
      ${optimizedCover ? `<img src="${escapeHtml(optimizedCover)}" alt="${escapeHtml(post.title)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;margin-bottom:32px;" loading="eager" fetchpriority="high">` : ''}
      <h1 style="font-size:clamp(24px,4vw,40px);font-weight:700;font-family:var(--sf-heading-font);line-height:1.3;margin-bottom:16px;">${escapeHtml(post.title)}</h1>
      ${dateStr ? `<p style="font-size:14px;color:#999;margin-bottom:32px;">${dateStr}</p>` : ''}
      <div style="font-size:16px;line-height:1.8;color:var(--theme-text-secondary,#333);">${post.content || post.body_html || ''}</div>
    </article>`;
}
