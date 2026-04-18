// =============================================
// FOOTER COMPILER — Renders storefront footer HTML
// Mirrors: src/components/storefront/StorefrontFooterContent.tsx
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

export function footerToStaticHTML(context: CompilerContext): string {
  const { storeSettings, tenant, globalLayout, footerMenus } = context;
  
  const footerConfig = globalLayout?.published_footer_config || globalLayout?.footer_config || null;
  const configProps = footerConfig?.props || {};
  const year = new Date().getFullYear();
  const storeName = storeSettings?.store_name || tenant?.name || 'Loja';
  
  // Helper functions
  const getString = (key: string, fallback?: any, defaultVal?: string): string => {
    const v = configProps[key];
    if (v !== undefined && v !== null && v !== '') return String(v);
    if (fallback !== undefined && fallback !== null && fallback !== '') return String(fallback);
    return defaultVal || '';
  };
  const getBoolean = (key: string, defaultVal: boolean): boolean => {
    const v = configProps[key];
    if (typeof v === 'boolean') return v;
    return defaultVal;
  };
  
  // Colors
  const footerBgColor = getString('footerBgColor', null, '#1a1a1a') || '#1a1a1a';
  const footerTextColor = getString('footerTextColor', null, '#e5e5e5') || '#e5e5e5';
  const footerTitlesColor = getString('footerTitlesColor', null, '#ffffff') || '#ffffff';
  
  // Visibility flags
  const showLogo = getBoolean('showLogo', true);
  const showStoreInfo = getBoolean('showStoreInfo', true);
  const showSac = getBoolean('showSac', true);
  const showSocial = getBoolean('showSocial', true);
  const showCopyright = getBoolean('showCopyright', true);
  const showPaymentMethods = getBoolean('showPaymentMethods', true);
  const showSecuritySeals = getBoolean('showSecuritySeals', true);
  const showFooter1 = getBoolean('showFooter1', true);
  const showFooter2 = getBoolean('showFooter2', true);
  const showNewsletter = getBoolean('showNewsletter', false);
  
  // Content
  const sacTitle = getString('sacTitle', null, 'Atendimento (SAC)') || 'Atendimento (SAC)';
  const logoUrl = getString('logoUrl', storeSettings?.logo_url);
  const storeDescription = getString('storeDescription', storeSettings?.store_description);
  const legalName = getString('legalName', storeSettings?.business_legal_name);
  const cnpj = getString('cnpj', storeSettings?.business_cnpj);
  const whatsApp = getString('whatsApp', storeSettings?.social_whatsapp);
  const phone = getString('phone', storeSettings?.contact_phone);
  const email = getString('email', storeSettings?.contact_email);
  const address = getString('address', storeSettings?.contact_address);
  const socialFacebook = getString('socialFacebook', storeSettings?.social_facebook);
  const socialInstagram = getString('socialInstagram', storeSettings?.social_instagram);
  const socialTiktok = getString('socialTiktok', storeSettings?.social_tiktok);
  const socialYoutube = getString('socialYoutube', storeSettings?.social_youtube);
  
  // Newsletter
  const newsletterTitle = getString('newsletterTitle', null, 'RECEBA NOSSAS PROMOÇÕES') || 'RECEBA NOSSAS PROMOÇÕES';
  const newsletterSubtitle = getString('newsletterSubtitle', null, 'Inscreva-se para receber descontos exclusivos direto no seu e-mail!');
  const newsletterPlaceholder = getString('newsletterPlaceholder', null, 'Seu e-mail') || 'Seu e-mail';
  const newsletterListId = getString('newsletterListId', null, '') || '';
  const tenantIdForForm = tenant?.id || '';
  
  // Menu names
  const footer1Name = getString('footer1Title', null) || footerMenus.footer1?.name || 'Menu Footer';
  const footer2Name = getString('footer2Title', null) || footerMenus.footer2?.name || 'Políticas';
  
  // Image sections helper
  const getImageSection = (key: string): { title: string; items: { imageUrl: string; linkUrl?: string }[] } => {
    const data = configProps[key] as any;
    if (data && typeof data === 'object' && Array.isArray(data.items)) {
      return { title: data.title || '', items: data.items.filter((i: any) => i?.imageUrl) };
    }
    return { title: '', items: [] };
  };
  
  const paymentMethods = getImageSection('paymentMethods');
  const securitySeals = getImageSection('securitySeals');
  const shippingMethods = getImageSection('shippingMethods');
  const officialStores = getImageSection('officialStores');
  
  // Newsletter bar — uses universal [data-sf-newsletter] handler injected by storefront-html
  let newsletterHtml = '';
  if (showNewsletter) {
    newsletterHtml = `
      <div style="background:${escapeHtml(footerBgColor)};padding:32px 16px;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div class="sf-footer-newsletter-row" style="max-width:1280px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;">
          <div>
            <h3 style="font-size:18px;font-weight:700;color:${escapeHtml(footerTitlesColor)};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${escapeHtml(newsletterTitle)}</h3>
            ${newsletterSubtitle ? `<p style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;">${escapeHtml(newsletterSubtitle)}</p>` : ''}
          </div>
          <form data-sf-newsletter data-tenant-id="${escapeHtml(tenantIdForForm)}" data-list-id="${escapeHtml(newsletterListId)}" data-source="footer_newsletter" style="display:flex;gap:0;min-width:300px;max-width:500px;flex:1;flex-wrap:wrap;">
            <input type="email" name="email" required placeholder="${escapeHtml(newsletterPlaceholder)}" style="flex:1;padding:10px 16px;border:1px solid rgba(255,255,255,0.2);border-right:none;border-radius:4px 0 0 4px;background:rgba(255,255,255,0.1);color:#fff;font-size:14px;outline:none;min-width:0;">
            <button type="submit" class="sf-btn-primary" style="padding:10px 20px;border:none;border-radius:0 4px 4px 0;font-weight:600;cursor:pointer;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </form>
        </div>
      </div>`;
  }
  
  // Column 1: Store info
  let col1Html = '';
  if (showLogo || showStoreInfo) {
    const logoHtml = showLogo && logoUrl
      ? `<img src="${escapeHtml(optimizeImageUrl(logoUrl, 180, 90))}" alt="${escapeHtml(storeName)}" style="height:48px;max-width:180px;object-fit:contain;margin-bottom:16px;" loading="lazy">`
      : (showLogo ? `<span style="font-size:20px;font-weight:700;color:${escapeHtml(footerTextColor)};display:block;margin-bottom:16px;">${escapeHtml(storeName)}</span>` : '');
    const descHtml = showStoreInfo && storeDescription
      ? `<p style="font-size:13px;line-height:1.6;color:${escapeHtml(footerTextColor)};opacity:0.8;margin-bottom:8px;">${escapeHtml(storeDescription)}</p>` : '';
    const cnpjHtml = showStoreInfo && cnpj
      ? `<p style="font-size:11px;color:${escapeHtml(footerTextColor)};opacity:0.6;">CNPJ: ${escapeHtml(cnpj)}</p>` : '';
    col1Html = `<div>${logoHtml}${descHtml}${cnpjHtml}</div>`;
  }
  
  // Column 2: SAC + Social
  let col2Html = '';
  const hasContact = whatsApp || phone || email || address;
  const hasSocial = socialFacebook || socialInstagram || socialTiktok || socialYoutube;
  
  if (showSac && hasContact) {
    const contactItems: string[] = [];
    // SVG icons matching Lucide icons from StorefrontFooterContent.tsx
    const whatsAppIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
    const phoneIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
    const mailIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
    const mapPinIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    if (whatsApp) {
      const cleanNum = whatsApp.replace(/\D/g, '');
      contactItems.push(`<a href="https://wa.me/${cleanNum}" target="_blank" rel="noopener noreferrer" style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;display:flex;align-items:center;gap:8px;text-decoration:none;">${whatsAppIcon} WhatsApp</a>`);
    }
    if (phone) contactItems.push(`<a href="tel:${escapeHtml(phone.replace(/\D/g, ''))}" style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;display:flex;align-items:center;gap:8px;text-decoration:none;">${phoneIcon} ${escapeHtml(phone)}</a>`);
    if (email) contactItems.push(`<a href="mailto:${escapeHtml(email)}" style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;display:flex;align-items:center;gap:8px;text-decoration:none;">${mailIcon} ${escapeHtml(email)}</a>`);
    if (address) contactItems.push(`<div style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;display:flex;align-items:flex-start;gap:8px;">${mapPinIcon} ${escapeHtml(address)}</div>`);
    
    col2Html += `<div style="margin-bottom:20px;">
      <h4 style="font-size:14px;font-weight:600;color:${escapeHtml(footerTitlesColor)};margin-bottom:12px;">${escapeHtml(sacTitle)}</h4>
      <div style="display:flex;flex-direction:column;gap:8px;">${contactItems.join('')}</div>
    </div>`;
  }
  
  if (showSocial && hasSocial) {
    const socialLinks: string[] = [];
    if (socialFacebook) socialLinks.push(`<a href="${escapeHtml(socialFacebook)}" target="_blank" rel="noopener noreferrer" style="color:${escapeHtml(footerTextColor)};opacity:0.8;" aria-label="Facebook"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>`);
    if (socialInstagram) socialLinks.push(`<a href="${escapeHtml(socialInstagram)}" target="_blank" rel="noopener noreferrer" style="color:${escapeHtml(footerTextColor)};opacity:0.8;" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg></a>`);
    if (socialTiktok) socialLinks.push(`<a href="${escapeHtml(socialTiktok)}" target="_blank" rel="noopener noreferrer" style="color:${escapeHtml(footerTextColor)};opacity:0.8;" aria-label="TikTok"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg></a>`);
    if (socialYoutube) socialLinks.push(`<a href="${escapeHtml(socialYoutube)}" target="_blank" rel="noopener noreferrer" style="color:${escapeHtml(footerTextColor)};opacity:0.8;" aria-label="YouTube"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg></a>`);
    
    col2Html += `<div>
      <h4 style="font-size:14px;font-weight:600;color:${escapeHtml(footerTitlesColor)};margin-bottom:12px;">Redes Sociais</h4>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">${socialLinks.join('')}</div>
    </div>`;
  }
  if (col2Html) col2Html = `<div>${col2Html}</div>`;
  
  // Column 3: Footer Menu 1
  let col3Html = '';
  if (showFooter1 && footerMenus.footer1?.items?.length > 0) {
    const links = footerMenus.footer1.items
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item: any) => `<a href="${escapeHtml(item.url || '#')}" style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;text-decoration:none;display:block;padding:3px 0;">${escapeHtml(item.label)}</a>`)
      .join('');
    col3Html = `<div>
      <h4 style="font-size:14px;font-weight:600;color:${escapeHtml(footerTitlesColor)};margin-bottom:12px;">${escapeHtml(footer1Name)}</h4>
      <nav style="display:flex;flex-direction:column;gap:4px;">${links}</nav>
    </div>`;
  }
  
  // Column 4: Footer Menu 2
  let col4Html = '';
  if (showFooter2 && footerMenus.footer2?.items?.length > 0) {
    const links = footerMenus.footer2.items
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item: any) => `<a href="${escapeHtml(item.url || '#')}" style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;text-decoration:none;display:block;padding:3px 0;">${escapeHtml(item.label)}</a>`)
      .join('');
    col4Html = `<div>
      <h4 style="font-size:14px;font-weight:600;color:${escapeHtml(footerTitlesColor)};margin-bottom:12px;">${escapeHtml(footer2Name)}</h4>
      <nav style="display:flex;flex-direction:column;gap:4px;">${links}</nav>
    </div>`;
  }
  
  const visibleCols = [col1Html, col2Html, col3Html, col4Html].filter(Boolean).length;
  const gridCols = Math.max(visibleCols, 1);
  
  // Image sections
  let imageSectionsHtml = '';
  const allImageSections: { title: string; items: { imageUrl: string; linkUrl?: string }[]; show: boolean }[] = [
    { ...paymentMethods, title: paymentMethods.title || 'Formas de Pagamento', show: showPaymentMethods },
    { ...securitySeals, title: securitySeals.title || 'Selos de Segurança', show: showSecuritySeals },
    { ...shippingMethods, title: shippingMethods.title || 'Formas de Envio', show: true },
    { ...officialStores, title: officialStores.title || 'Lojas Oficiais', show: true },
  ].filter(s => s.show && s.items.length > 0);
  
  if (allImageSections.length > 0) {
    const sectionCols = allImageSections.map(section => {
      const images = section.items.map((item: any) => {
        const imgTag = `<img src="${escapeHtml(optimizeImageUrl(item.imageUrl, 200, 90))}" alt="" style="height:32px;width:auto;object-fit:contain;" loading="lazy">`;
        return item.linkUrl
          ? `<a href="${escapeHtml(item.linkUrl)}" target="_blank" rel="noopener noreferrer">${imgTag}</a>`
          : imgTag;
      }).join('');
      return `<div style="text-align:center;">
        <h4 style="font-size:12px;font-weight:500;color:${escapeHtml(footerTextColor)};opacity:0.7;margin-bottom:12px;">${escapeHtml(section.title)}</h4>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;">${images}</div>
      </div>`;
    }).join('');
    
    // Desktop: N columns side by side. Mobile: 1 column stacked vertically (matches Builder grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)
    imageSectionsHtml = `
      <div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:32px;padding-top:24px;">
        <div class="sf-footer-images-grid" style="display:grid;grid-template-columns:repeat(${allImageSections.length},1fr);gap:24px;">
          ${sectionCols}
        </div>
      </div>`;
  }
  
  // Copyright
  let copyrightHtml = '';
  const copyrightOverride = getString('copyrightText');
  if (showCopyright) {
    const legalLine = (legalName || cnpj)
      ? `<p style="font-size:11px;color:${escapeHtml(footerTextColor)};opacity:0.6;margin-bottom:4px;">${legalName ? escapeHtml(legalName) : ''}${legalName && cnpj ? ' – ' : ''}${cnpj ? 'CNPJ: ' + escapeHtml(cnpj) : ''}</p>`
      : '';
    const copyLine = copyrightOverride
      ? `<p style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;">${escapeHtml(copyrightOverride)}</p>`
      : `<p style="font-size:13px;color:${escapeHtml(footerTextColor)};opacity:0.8;">© ${year} ${escapeHtml(storeName)}. Todos os direitos reservados.</p>`;
    copyrightHtml = `
      <div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:24px;padding-top:24px;text-align:center;">
        ${legalLine}${copyLine}
      </div>`;
  }
  
  return `
    <footer style="background:${escapeHtml(footerBgColor)};color:${escapeHtml(footerTextColor)};margin-top:0;">
      ${newsletterHtml}
      <div style="max-width:1280px;margin:0 auto;padding:40px 16px;">
        <div class="sf-footer-grid" style="display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:32px;">
          ${col1Html}${col2Html}${col3Html}${col4Html}
        </div>
        ${imageSectionsHtml}
        ${copyrightHtml}
      </div>
      <style>
        @media(max-width:768px){
          footer .sf-footer-grid{grid-template-columns:1fr !important;text-align:center !important;}
          footer .sf-footer-grid>div{display:flex !important;flex-direction:column !important;align-items:center !important;}
          footer .sf-footer-grid>div>div{display:flex !important;flex-direction:column !important;align-items:center !important;}
          footer .sf-footer-grid div[style*="flex-wrap:wrap"]{justify-content:center !important;}
          footer .sf-footer-images-grid{grid-template-columns:1fr !important;}
          footer .sf-footer-newsletter-row{flex-direction:column !important;text-align:center !important;}
          footer .sf-footer-newsletter-row form{min-width:100% !important;max-width:100% !important;}
        }
        @media(min-width:640px) and (max-width:1023px){
          footer .sf-footer-images-grid{grid-template-columns:repeat(2,1fr) !important;}
        }
      </style>
    </footer>`;
}
