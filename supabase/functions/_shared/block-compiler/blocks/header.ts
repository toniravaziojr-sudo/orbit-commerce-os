// =============================================
// HEADER COMPILER — Renders storefront header HTML
// Mirrors: src/components/storefront/StorefrontHeaderContent.tsx
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

export function headerToStaticHTML(context: CompilerContext): string {
  const { storeSettings, menuItems, tenant, globalLayout } = context;
  
  const headerConfig = globalLayout?.published_header_config || globalLayout?.header_config || null;
  const props = headerConfig?.props || {};
  
  const storeName = storeSettings?.store_name || tenant?.name || 'Loja';
  const logoUrl = (props.logoUrl && String(props.logoUrl).trim()) || storeSettings?.logo_url || tenant?.logo_url || '';
  const optimizedLogo = logoUrl ? optimizeImageUrl(logoUrl, 200, 90) : '';
  
  // Header props
  const headerBgColor = String(props.headerBgColor || '');
  const headerTextColor = String(props.headerTextColor || '#1a1a1a');
  const headerIconColor = String(props.headerIconColor || headerTextColor);
  const showSearch = props.showSearch ?? true;
  const showCart = props.showCart ?? true;
  const sticky = props.sticky ?? true;
  const logoSize = String(props.logoSize || 'medium');
  const showHeaderMenu = props.showHeaderMenu ?? true;
  const customerAreaEnabled = Boolean(props.customerAreaEnabled);
  
  // Notice bar
  const noticeEnabled = Boolean(props.noticeEnabled);
  const noticeTexts: string[] = Array.isArray(props.noticeTexts) && props.noticeTexts.length > 0
    ? props.noticeTexts.filter((t: any) => typeof t === 'string' && t.trim())
    : props.noticeText ? [String(props.noticeText)] : [];
  const noticeBgColor = props.noticeBgColor && String(props.noticeBgColor).trim()
    ? String(props.noticeBgColor)
    : 'var(--theme-button-primary-bg, #1a1a1a)';
  const noticeTextColor = props.noticeTextColor && String(props.noticeTextColor).trim()
    ? String(props.noticeTextColor)
    : '#ffffff';
  const noticeAnimation = String(props.noticeAnimation || 'fade');
  
  // Featured promos
  const featuredPromosEnabled = Boolean(props.featuredPromosEnabled);
  const featuredPromosLabel = String(props.featuredPromosLabel || 'Promoções');
  const featuredPromosBgColor = String(props.featuredPromosBgColor || '');
  const featuredPromosTextColor = String(props.featuredPromosTextColor || '#ffffff');
  const featuredPromosTarget = String(props.featuredPromosTarget || props.featuredPromosDestination || '');
  const featuredPromosThumbnail = String(props.featuredPromosThumbnail || '');
  
  // Build featured promos URL
  let featuredPromosUrl = '#';
  if (featuredPromosTarget.startsWith('category:')) {
    featuredPromosUrl = `/categoria/${featuredPromosTarget.replace('category:', '')}`;
  } else if (featuredPromosTarget.startsWith('page:')) {
    featuredPromosUrl = `/p/${featuredPromosTarget.replace('page:', '')}`;
  } else if (featuredPromosTarget.startsWith('landing_page:')) {
    featuredPromosUrl = `/lp/${featuredPromosTarget.replace('landing_page:', '')}`;
  }
  
  // Logo height
  const logoHeight = logoSize === 'small' ? '32px' : logoSize === 'large' ? '56px' : '40px';
  
  // Contact info
  const whatsApp = storeSettings?.social_whatsapp || '';
  const contactPhone = storeSettings?.contact_phone || '';
  const contactEmail = storeSettings?.contact_email || '';
  const hasContactInfo = whatsApp || contactPhone || contactEmail;
  
  // Build nav items from menuItems
  const rootItems = menuItems.filter((item: any) => !item.parent_id).slice(0, 8);
  const childrenMap = new Map<string, any[]>();
  menuItems.filter((item: any) => item.parent_id).forEach((item: any) => {
    const arr = childrenMap.get(item.parent_id) || [];
    arr.push(item);
    childrenMap.set(item.parent_id, arr);
  });
  
  const navItemsHtml = rootItems.map((item: any) => {
    const url = item.url || '#';
    const children = childrenMap.get(item.id) || [];
    
    if (children.length > 0) {
      const childLinks = children
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((child: any) => `<a href="${escapeHtml(child.url || '#')}" style="display:block;padding:8px 16px;color:#1a1a1a;font-size:13px;white-space:nowrap;border-radius:4px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">${escapeHtml(child.label)}</a>`)
        .join('');
      return `<div class="sf-dropdown" style="position:relative;">
        <a href="${escapeHtml(url)}" style="color:${escapeHtml(headerTextColor)};font-size:14px;font-weight:500;white-space:nowrap;display:flex;align-items:center;gap:4px;">
          ${escapeHtml(item.label)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
        <div class="sf-dropdown-menu" style="display:none;position:absolute;top:100%;left:0;background:#fff;border:1px solid #eee;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:8px;min-width:200px;z-index:60;">
          ${childLinks}
        </div>
      </div>`;
    }
    
    return `<a href="${escapeHtml(url)}" style="color:${escapeHtml(headerTextColor)};font-size:14px;font-weight:500;white-space:nowrap;">${escapeHtml(item.label)}</a>`;
  }).join('');

  const logoHtml = optimizedLogo
    ? `<img src="${escapeHtml(optimizedLogo)}" alt="${escapeHtml(storeName)}" style="height:${logoHeight};width:auto;max-width:180px;" loading="eager" fetchpriority="high">`
    : `<span style="font-size:20px;font-weight:700;font-family:var(--sf-heading-font);color:${escapeHtml(headerTextColor)};">${escapeHtml(storeName)}</span>`;

  // Notice bar
  let noticeBarHtml = '';
  if (noticeEnabled && noticeTexts.length > 0) {
    if (noticeAnimation === 'marquee' || noticeAnimation === 'slide-horizontal') {
      const allTexts = noticeTexts.map(t => `<span style="padding:0 32px;">${escapeHtml(t)}</span>`).join('');
      noticeBarHtml = `
        <div style="background:${escapeHtml(noticeBgColor)};color:${escapeHtml(noticeTextColor)};padding:8px 16px;text-align:center;font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;">
          <div class="sf-notice-marquee" style="display:inline-flex;animation:sf-marquee 20s linear infinite;">
            ${allTexts}${allTexts}
          </div>
        </div>`;
    } else {
      noticeBarHtml = `
        <div style="background:${escapeHtml(noticeBgColor)};color:${escapeHtml(noticeTextColor)};padding:8px 16px;text-align:center;font-size:13px;font-weight:500;">
          ${escapeHtml(noticeTexts[0])}
        </div>`;
    }
  }
  
  // Featured promo badge
  const promoBadgeStyle = featuredPromosBgColor
    ? `background:${escapeHtml(featuredPromosBgColor)};color:${escapeHtml(featuredPromosTextColor)};`
    : `background:var(--theme-button-primary-bg,#1a1a1a);color:${escapeHtml(featuredPromosTextColor)};`;
  
  let featuredPromoHtml = '';
  if (featuredPromosEnabled) {
    const thumbHtml = featuredPromosThumbnail
      ? `<img src="${escapeHtml(optimizeImageUrl(featuredPromosThumbnail, 32, 80))}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">`
      : '';
    featuredPromoHtml = `<a href="${escapeHtml(featuredPromosUrl)}" style="${promoBadgeStyle}padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap;text-decoration:none;">
      ${thumbHtml}${escapeHtml(featuredPromosLabel)}
    </a>`;
  }
  
  // Attendance button
  let attendanceHtml = '';
  if (hasContactInfo) {
    const waLink = whatsApp ? `https://wa.me/${whatsApp.replace(/\D/g, '')}` : '#';
    attendanceHtml = `<a href="${escapeHtml(waLink)}" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid ${escapeHtml(headerIconColor || '#ccc')};border-radius:20px;font-size:12px;font-weight:500;color:${escapeHtml(headerTextColor)};white-space:nowrap;text-decoration:none;" target="_blank" rel="noopener noreferrer">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerIconColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      Atendimento
    </a>`;
  }
  
  // Account icon
  let accountHtml = '';
  if (customerAreaEnabled) {
    accountHtml = `<a href="/minha-conta" style="padding:4px;color:${escapeHtml(headerIconColor)};" aria-label="Minha Conta">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </a>`;
  }
  
  const bgStyle = headerBgColor ? `background:${escapeHtml(headerBgColor)};` : 'background:#fff;';

  // Search button SVG
  const searchSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerIconColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  
  // Cart SVG
  const cartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>`;

  // Menu hamburger SVG
  const menuSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

  return `
    ${noticeBarHtml}
    <header style="${bgStyle}border-bottom:1px solid rgba(0,0,0,0.08);padding:0;${sticky ? 'position:sticky;top:0;' : ''}z-index:50;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="max-width:1280px;margin:0 auto;padding:0 16px;">
        <!-- DESKTOP -->
        <div class="sf-header-desktop" style="display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px;">
          <div style="display:flex;align-items:center;gap:12px;flex:1;">
            ${showSearch ? `<button data-sf-action="toggle-search" style="display:flex;align-items:center;gap:6px;background:rgba(128,128,128,0.1);border:none;cursor:pointer;padding:8px 14px;border-radius:8px;color:${escapeHtml(headerTextColor)};" aria-label="Buscar">${searchSvg}<span style="font-size:13px;opacity:0.7;">Pesquisar</span></button>` : ''}
            ${featuredPromoHtml}
          </div>
          <a href="/" style="flex-shrink:0;display:flex;align-items:center;">${logoHtml}</a>
          <div style="display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end;">
            ${attendanceHtml}
            ${accountHtml}
            ${showCart ? `<button data-sf-action="open-cart" aria-label="Carrinho" style="background:none;border:none;cursor:pointer;padding:4px;position:relative;color:${escapeHtml(headerIconColor)};">${cartSvg}<span data-sf-cart-count style="display:none;position:absolute;top:-4px;right:-4px;background:var(--theme-button-primary-bg,#e53e3e);color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;">0</span></button>` : ''}
          </div>
        </div>
        ${showHeaderMenu ? `<nav class="sf-nav-desktop" style="display:flex;align-items:center;gap:24px;padding:8px 0;justify-content:center;border-top:1px solid rgba(255,255,255,0.1);">${navItemsHtml}</nav>` : ''}
      </div>
      <!-- MOBILE -->
      <div class="sf-header-mobile" style="display:none;align-items:center;justify-content:space-between;padding:12px 16px;">
        <button data-sf-action="toggle-mobile-menu" aria-label="Menu" style="background:none;border:none;cursor:pointer;padding:4px;color:${escapeHtml(headerIconColor)};">${menuSvg}</button>
        <a href="/" style="flex-shrink:0;">${logoHtml}</a>
        <div style="display:flex;align-items:center;gap:8px;">
          ${showSearch ? `<button data-sf-action="toggle-search" aria-label="Buscar" style="background:none;border:none;cursor:pointer;padding:4px;color:${escapeHtml(headerIconColor)};"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>` : ''}
          ${showCart ? `<button data-sf-action="open-cart" aria-label="Carrinho" style="background:none;border:none;cursor:pointer;padding:4px;position:relative;color:${escapeHtml(headerIconColor)};">${cartSvg}<span data-sf-cart-count style="display:none;position:absolute;top:-4px;right:-4px;background:var(--theme-button-primary-bg,#e53e3e);color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;">0</span></button>` : ''}
        </div>
      </div>
    </header>`;
}
