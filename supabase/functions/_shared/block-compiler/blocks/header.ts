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
  const rawNoticeAnimation = String(props.noticeAnimation || 'fade');
  const noticeAnimation = rawNoticeAnimation === 'slide' ? 'slide-vertical' : rawNoticeAnimation;
  
  // Notice action
  const noticeActionEnabled = Boolean(props.noticeActionEnabled);
  const noticeActionLabel = String(props.noticeActionLabel || '');
  const noticeActionUrl = String(props.noticeActionUrl || '');
  const noticeActionTarget = String(props.noticeActionTarget || '_self');
  const noticeActionTextColor = String(props.noticeActionTextColor || '');
  const isActionValid = noticeActionEnabled && noticeActionLabel && noticeActionUrl;
  
  // Featured promos
  const featuredPromosEnabled = Boolean(props.featuredPromosEnabled);
  const featuredPromosLabel = String(props.featuredPromosLabel || 'Promoções');
  const rawFeaturedPromosBgColor = String(props.featuredPromosBgColor || '');
  const rawFeaturedPromosTextColor = String(props.featuredPromosTextColor || '#ffffff');
  const featuredPromosTarget = String(props.featuredPromosTarget || props.featuredPromosDestination || '');
  
  // Fallback: if bg is empty, equals text color, or equals header bg (invisible), use primary
  // Mirrors logic in StorefrontHeaderContent.tsx
  const isFeaturedBgInvalid = !rawFeaturedPromosBgColor
    || rawFeaturedPromosBgColor.toLowerCase() === rawFeaturedPromosTextColor.toLowerCase()
    || rawFeaturedPromosBgColor.toLowerCase() === (headerBgColor || '').toLowerCase();
  const featuredPromosBgColor = isFeaturedBgInvalid ? '' : rawFeaturedPromosBgColor;
  const featuredPromosTextColor = rawFeaturedPromosTextColor || '#ffffff';
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
  const contactAddress = storeSettings?.contact_address || '';
  const supportHours = storeSettings?.contact_support_hours || '';
  const hasContactInfo = whatsApp || contactPhone || contactEmail;
  
  // Build nav items from menuItems
  const rootItems = menuItems.filter((item: any) => !item.parent_id).slice(0, 8);
  const childrenMap = new Map<string, any[]>();
  menuItems.filter((item: any) => item.parent_id).forEach((item: any) => {
    const arr = childrenMap.get(item.parent_id) || [];
    arr.push(item);
    childrenMap.set(item.parent_id, arr);
  });
  
  // Menu visual style
  const menuVisualStyle = String(props.menuVisualStyle || 'classic');
  const menuShowParentTitle = props.menuShowParentTitle ?? true;
  
  const navItemsHtml = rootItems.map((item: any) => {
    const url = item.url || '#';
    const children = childrenMap.get(item.id) || [];
    
    if (children.length > 0) {
      // Header with parent title (Classic & Elegant styles)
      let headerHtml = '';
      if (menuShowParentTitle && menuVisualStyle !== 'minimal') {
        headerHtml = `<div style="padding:8px 16px 6px;border-bottom:1px solid #f0f0f0;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;color:#1a1a1a;${menuVisualStyle === 'classic' ? 'text-transform:uppercase;letter-spacing:0.5px;' : ''}">${escapeHtml(item.label)}</span>
        </div>`;
      }
      
      const childLinks = children
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((child: any) => `<a href="${escapeHtml(child.url || '#')}" class="sf-dropdown-item" style="display:block;padding:8px 16px;color:#1a1a1a;font-size:13px;white-space:nowrap;border-radius:4px;">${escapeHtml(child.label)}</a>`)
        .join('');
      
      // Footer "Ver todos" link (Classic style)
      let footerHtml = '';
      if (menuVisualStyle === 'classic') {
        footerHtml = `<div style="border-top:1px solid #f0f0f0;margin-top:4px;padding:6px 16px;">
          <a href="${escapeHtml(url)}" style="font-size:12px;font-weight:500;color:var(--theme-button-primary-bg,#1a1a1a);display:flex;align-items:center;gap:4px;">Ver todos <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></a>
        </div>`;
      }
      
      // Dropdown arrow: only Classic style shows it
      const arrowSvg = menuVisualStyle === 'classic'
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerTextColor)}" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
        : '';
      
      return `<div class="sf-dropdown" style="position:relative;">
        <a href="${escapeHtml(url)}" style="color:${escapeHtml(headerTextColor)};font-size:14px;font-weight:500;white-space:nowrap;display:flex;align-items:center;gap:4px;">
          ${escapeHtml(item.label)}
          ${arrowSvg}
        </a>
        <div class="sf-dropdown-menu" style="display:none;position:absolute;top:100%;left:0;background:#fff;border:1px solid #eee;border-radius:${menuVisualStyle === 'elegant' ? '12px' : '8px'};box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:8px 0;min-width:200px;z-index:60;">
          ${headerHtml}
          ${childLinks}
          ${footerHtml}
        </div>
      </div>`;
    }
    
    return `<a href="${escapeHtml(url)}" style="color:${escapeHtml(headerTextColor)};font-size:14px;font-weight:500;white-space:nowrap;">${escapeHtml(item.label)}</a>`;
  }).join('');

  const logoHtml = optimizedLogo
    ? `<img src="${escapeHtml(optimizedLogo)}" alt="${escapeHtml(storeName)}" style="height:${logoHeight};width:auto;max-width:180px;" loading="eager" fetchpriority="high">`
    : `<span style="font-size:20px;font-weight:700;font-family:var(--sf-heading-font);color:${escapeHtml(headerTextColor)};">${escapeHtml(storeName)}</span>`;

  // Notice bar — supports marquee AND fade/slide rotation
  let noticeBarHtml = '';
  if (noticeEnabled && noticeTexts.length > 0) {
    const actionHtml = isActionValid ? `<a href="${escapeHtml(noticeActionUrl)}" target="${escapeHtml(noticeActionTarget)}" ${noticeActionTarget === '_blank' ? 'rel="noopener noreferrer"' : ''} style="margin-left:8px;text-decoration:underline;font-size:12px;font-weight:500;opacity:0.9;color:${escapeHtml(noticeActionTextColor || noticeTextColor)};">${escapeHtml(noticeActionLabel)}</a>` : '';
    
    if (noticeAnimation === 'marquee') {
      // Marquee: continuous horizontal scroll with ALL texts concatenated
      const allTextSpans = noticeTexts.map(t => `<span style="padding:0 32px;">${escapeHtml(t)}</span>`).join('');
      const marqueeContent = `${allTextSpans}${actionHtml}`;
      noticeBarHtml = `
        <div style="background:${escapeHtml(noticeBgColor)};color:${escapeHtml(noticeTextColor)};padding:8px 16px;text-align:center;font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;">
          <div class="sf-notice-marquee" style="display:inline-flex;animation:sf-marquee 20s linear infinite;">
            ${marqueeContent}${marqueeContent}
          </div>
        </div>`;
    } else {
      // Fade, slide-vertical, slide-horizontal: show first text, JS rotates
      const textsDataAttr = noticeTexts.length > 1 ? ` data-sf-notice-texts='${escapeHtml(JSON.stringify(noticeTexts))}'` : '';
      noticeBarHtml = `
        <div class="sf-notice-bar" style="background:${escapeHtml(noticeBgColor)};color:${escapeHtml(noticeTextColor)};padding:8px 16px;text-align:center;font-size:13px;font-weight:500;overflow:hidden;"${textsDataAttr} data-sf-notice-animation="${escapeHtml(noticeAnimation)}">
          <span class="sf-notice-text" style="display:inline-block;transition:opacity 300ms ease-out,transform 300ms ease-out;">${escapeHtml(noticeTexts[0])}</span>
          ${actionHtml}
        </div>`;
    }
  }
  
  // Featured promo badge with thumbnail hover
  const promoBadgeStyle = featuredPromosBgColor
    ? `background:${escapeHtml(featuredPromosBgColor)};color:${escapeHtml(featuredPromosTextColor)};`
    : `background:var(--theme-button-primary-bg,#1a1a1a);color:${escapeHtml(featuredPromosTextColor)};`;
  
  let featuredPromoHtml = '';
  if (featuredPromosEnabled) {
    const thumbHtml = featuredPromosThumbnail
      ? `<div class="sf-featured-thumb"><img src="${escapeHtml(optimizeImageUrl(featuredPromosThumbnail, 240, 80))}" alt="${escapeHtml(featuredPromosLabel)}" style="width:240px;height:96px;object-fit:cover;"><div style="padding:6px;text-align:center;background:#fff;"><span style="font-size:12px;font-weight:500;color:#1a1a1a;">${escapeHtml(featuredPromosLabel)}</span></div></div>`
      : '';
    featuredPromoHtml = `<div class="sf-featured-promo">
      <a href="${escapeHtml(featuredPromosUrl)}" style="${promoBadgeStyle}padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap;text-decoration:none;">
        ${escapeHtml(featuredPromosLabel)}
      </a>
      ${thumbHtml}
    </div>`;
  }
  
  // Attendance dropdown (mirrors HeaderAttendanceDropdown.tsx)
  let attendanceHtml = '';
  if (hasContactInfo) {
    const items: string[] = [];
    
    if (contactPhone) {
      const phoneClean = contactPhone.replace(/\D/g, '');
      items.push(`<a href="tel:+${phoneClean}" class="sf-attendance-item">
        <div class="sf-attendance-icon" style="background:#eff6ff;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
        <div><p style="font-size:11px;font-weight:500;color:#666;">Compre por telefone</p><p style="font-size:13px;font-weight:600;color:#1a1a1a;">${escapeHtml(contactPhone)}</p></div>
      </a>`);
    }
    
    if (whatsApp) {
      const waClean = whatsApp.replace(/\D/g, '');
      items.push(`<a href="https://wa.me/${waClean}" target="_blank" rel="noopener noreferrer" class="sf-attendance-item">
        <div class="sf-attendance-icon" style="background:#f0fdf4;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg></div>
        <div><p style="font-size:11px;font-weight:500;color:#666;">Fale no WhatsApp</p><p style="font-size:13px;font-weight:600;color:#1a1a1a;">${escapeHtml(whatsApp)}</p></div>
      </a>`);
    }
    
    if (contactEmail) {
      items.push(`<a href="mailto:${escapeHtml(contactEmail)}" class="sf-attendance-item">
        <div class="sf-attendance-icon" style="background:#fef2f2;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
        <div><p style="font-size:11px;font-weight:500;color:#666;">E-mail</p><p style="font-size:13px;font-weight:600;color:#1a1a1a;">${escapeHtml(contactEmail)}</p></div>
      </a>`);
    }
    
    if (contactAddress) {
      items.push(`<div class="sf-attendance-item">
        <div class="sf-attendance-icon" style="background:#faf5ff;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
        <div><p style="font-size:11px;font-weight:500;color:#666;">Endereço</p><p style="font-size:13px;color:#1a1a1a;line-height:1.4;">${escapeHtml(contactAddress)}</p></div>
      </div>`);
    }
    
    if (supportHours) {
      items.push(`<div class="sf-attendance-item" style="border-top:1px solid #f0f0f0;padding-top:12px;">
        <div class="sf-attendance-icon" style="background:#fffbeb;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div><p style="font-size:11px;font-weight:500;color:#666;">Horário de atendimento</p><p style="font-size:13px;color:#1a1a1a;">${escapeHtml(supportHours)}</p></div>
      </div>`);
    }
    
    attendanceHtml = `<div class="sf-attendance-dropdown" style="position:relative;">
      <button type="button" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid ${escapeHtml(headerIconColor || '#ccc')}30;border-radius:20px;font-size:12px;font-weight:500;color:${escapeHtml(headerTextColor)};white-space:nowrap;background:none;cursor:pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerIconColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
        Atendimento
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerIconColor)}" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="sf-attendance-menu">
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${items.join('')}
        </div>
      </div>
    </div>`;
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
          </div>
          <a href="/" style="flex-shrink:0;display:flex;align-items:center;">${logoHtml}</a>
          <div style="display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end;">
            ${attendanceHtml}
            ${accountHtml}
            ${showCart ? `<button data-sf-action="open-cart" aria-label="Carrinho" style="background:none;border:none;cursor:pointer;padding:4px;position:relative;color:${escapeHtml(headerIconColor)};">${cartSvg}<span data-sf-cart-count style="display:none;position:absolute;top:-4px;right:-4px;background:var(--theme-button-primary-bg,#e53e3e);color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;">0</span></button>` : ''}
          </div>
        </div>
        ${showHeaderMenu || featuredPromosEnabled ? `<nav class="sf-nav-desktop" style="display:flex;align-items:center;gap:24px;padding:8px 0;justify-content:center;border-top:1px solid rgba(255,255,255,0.1);">${featuredPromoHtml}${navItemsHtml}</nav>` : ''}
      </div>
      <!-- MOBILE -->
      <div class="sf-header-mobile" style="display:none;align-items:center;justify-content:space-between;padding:12px 16px;">
        <button data-sf-action="toggle-mobile-menu" aria-label="Menu" style="background:none;border:none;cursor:pointer;padding:4px;color:${escapeHtml(headerIconColor)};">${menuSvg}</button>
        <a href="/" style="flex-shrink:0;">${logoHtml}</a>
        <div style="display:flex;align-items:center;gap:8px;">
          ${accountHtml}
          ${showCart ? `<button data-sf-action="open-cart" aria-label="Carrinho" style="background:none;border:none;cursor:pointer;padding:4px;position:relative;color:${escapeHtml(headerIconColor)};">${cartSvg}<span data-sf-cart-count style="display:none;position:absolute;top:-4px;right:-4px;background:var(--theme-button-primary-bg,#e53e3e);color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;">0</span></button>` : ''}
        </div>
      </div>
      <!-- MOBILE SECONDARY BAR: Search + Featured Promos (mirrors StorefrontHeaderContent mobile bar) -->
      ${(showSearch || featuredPromosEnabled) ? `<div class="sf-header-mobile-secondary" style="display:none;align-items:center;padding:8px 16px;gap:12px;border-top:1px solid rgba(128,128,128,0.15);${headerBgColor ? `background:${escapeHtml(headerBgColor)};` : 'background:#fff;'}${showSearch && !featuredPromosEnabled ? 'justify-content:center;' : ''}${!showSearch && featuredPromosEnabled ? 'justify-content:center;' : ''}${showSearch && featuredPromosEnabled ? 'justify-content:space-between;' : ''}">
        ${showSearch ? `<div style="position:relative;flex:1;max-width:200px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerIconColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Pesquisar" data-sf-action-click="toggle-search" readonly style="width:100%;padding:6px 10px 6px 32px;border:none;border-radius:6px;font-size:12px;background:rgba(128,128,128,0.1);color:${escapeHtml(headerTextColor)};cursor:pointer;outline:none;font-family:var(--sf-body-font);">
        </div>` : ''}
        ${featuredPromosEnabled ? `<a href="${escapeHtml(featuredPromosUrl)}" class="sf-btn-primary" style="font-size:12px;font-weight:700;padding:6px 12px;border-radius:6px;white-space:nowrap;text-decoration:none;">${escapeHtml(featuredPromosLabel)}</a>` : ''}
      </div>` : ''}
    </header>`;
}
