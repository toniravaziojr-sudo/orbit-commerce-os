// =============================================
// LANDING PAGE TEMPLATES — V1.0.0
// Production-ready HTML section templates
// AI fills content data; humans designed the layout
// =============================================

export interface ProductData {
  name: string;
  slug?: string;
  price: number;
  compareAtPrice?: number | null;
  discountPercent?: number | null;
  primaryImage?: string;
  allImages?: string[];
  shortDescription?: string;
  description?: string;
  brand?: string;
  isKit?: boolean;
}

export interface ReviewData {
  name: string;
  rating: number;
  comment: string;
}

export interface PageTemplateInput {
  storeName: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  visualWeight: 'premium' | 'comercial' | 'minimalista' | 'direto';
  mainProduct: ProductData;
  allProducts: ProductData[];
  kits: ProductData[];
  reviews: ReviewData[];
  socialProofImages: string[];
  ctaText: string;
  ctaUrl: string;
}

// ========== COLOR SCHEMES ==========

function getColorScheme(visualWeight: string, primaryColor: string) {
  switch (visualWeight) {
    case 'premium':
      return {
        bg: '#0a0a0a',
        bgAlt: '#111111',
        bgCard: 'rgba(255,255,255,0.04)',
        bgCardBorder: 'rgba(255,255,255,0.08)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.7)',
        textSubtle: 'rgba(255,255,255,0.5)',
        accent: '#c9a96e',
        accentGlow: 'rgba(201,169,110,0.15)',
        accentGradient: 'linear-gradient(135deg, #c9a96e 0%, #e8d5a3 50%, #c9a96e 100%)',
        badgeBg: 'rgba(201,169,110,0.15)',
        badgeText: '#c9a96e',
        ctaBg: 'linear-gradient(135deg, #c9a96e, #e8d5a3)',
        ctaText: '#0a0a0a',
        ctaHover: 'linear-gradient(135deg, #d4af37, #f0e0b0)',
        priceCurrent: '#c9a96e',
        priceOld: 'rgba(255,255,255,0.4)',
        divider: 'rgba(255,255,255,0.06)',
        shadow: 'rgba(0,0,0,0.5)',
        featuredBorder: '#c9a96e',
        fontDisplay: "'Playfair Display', Georgia, serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImport: "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');",
      };
    case 'comercial':
      return {
        bg: '#ffffff',
        bgAlt: '#f8f9fa',
        bgCard: '#ffffff',
        bgCardBorder: '#e5e7eb',
        text: '#111827',
        textMuted: '#6b7280',
        textSubtle: '#9ca3af',
        accent: primaryColor || '#ef4444',
        accentGlow: `${primaryColor}22`,
        accentGradient: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
        badgeBg: '#fef2f2',
        badgeText: '#dc2626',
        ctaBg: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
        ctaText: '#ffffff',
        ctaHover: primaryColor,
        priceCurrent: '#16a34a',
        priceOld: '#9ca3af',
        divider: '#f3f4f6',
        shadow: 'rgba(0,0,0,0.1)',
        featuredBorder: primaryColor,
        fontDisplay: "'Montserrat', -apple-system, sans-serif",
        fontBody: "'Open Sans', -apple-system, sans-serif",
        fontImport: "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;500;600&display=swap');",
      };
    case 'minimalista':
      return {
        bg: '#fafafa',
        bgAlt: '#ffffff',
        bgCard: '#ffffff',
        bgCardBorder: '#e5e7eb',
        text: '#1a1a1a',
        textMuted: '#666666',
        textSubtle: '#999999',
        accent: primaryColor || '#1a1a1a',
        accentGlow: `${primaryColor}15`,
        accentGradient: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
        badgeBg: '#f5f5f5',
        badgeText: '#333333',
        ctaBg: '#1a1a1a',
        ctaText: '#ffffff',
        ctaHover: '#333333',
        priceCurrent: '#1a1a1a',
        priceOld: '#bbbbbb',
        divider: '#eeeeee',
        shadow: 'rgba(0,0,0,0.06)',
        featuredBorder: '#1a1a1a',
        fontDisplay: "'Sora', -apple-system, sans-serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImport: "@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');",
      };
    default: // 'direto'
      return {
        bg: '#ffffff',
        bgAlt: '#f9fafb',
        bgCard: '#ffffff',
        bgCardBorder: '#e5e7eb',
        text: '#111827',
        textMuted: '#4b5563',
        textSubtle: '#9ca3af',
        accent: primaryColor || '#2563eb',
        accentGlow: `${primaryColor}15`,
        accentGradient: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
        badgeBg: `${primaryColor}15`,
        badgeText: primaryColor,
        ctaBg: primaryColor,
        ctaText: '#ffffff',
        ctaHover: `${primaryColor}dd`,
        priceCurrent: '#16a34a',
        priceOld: '#9ca3af',
        divider: '#f3f4f6',
        shadow: 'rgba(0,0,0,0.08)',
        featuredBorder: primaryColor,
        fontDisplay: "'Inter', -apple-system, sans-serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');",
      };
  }
}

// ========== UTILITY ==========

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function installments(price: number, n = 12): string {
  const inst = price / n;
  return `${n}x de R$ ${inst.toFixed(2).replace('.', ',')}`;
}

// ========== SECTION TEMPLATES ==========

function sectionHero(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  const p = input.mainProduct;
  const img = p.primaryImage || '';
  const benefits = [
    p.shortDescription || 'Resultados comprovados por milhares de clientes',
    'Fórmula exclusiva de alta performance',
    'Satisfação garantida ou seu dinheiro de volta',
  ];

  return `
<section class="lp-hero">
  <div class="lp-hero-content">
    <span class="lp-hero-badge">${p.brand || input.storeName}</span>
    <h1 class="lp-hero-title">${p.name}</h1>
    <p class="lp-hero-subtitle">${p.shortDescription || p.description?.substring(0, 150) || 'Descubra por que milhares de pessoas já escolheram este produto.'}</p>
    <ul class="lp-hero-benefits">
      ${benefits.map(b => `<li>✅ ${b}</li>`).join('\n      ')}
    </ul>
    <a href="${input.ctaUrl}" class="lp-cta-button">${input.ctaText}</a>
    ${p.compareAtPrice && p.compareAtPrice > p.price ? `<p class="lp-hero-price-hint">De <s>${formatPrice(p.compareAtPrice)}</s> por <strong>${formatPrice(p.price)}</strong></p>` : ''}
  </div>
  <div class="lp-hero-image">
    ${img ? `<img src="${img}" alt="${p.name}" />` : ''}
  </div>
</section>`;
}

function sectionBenefits(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  const p = input.mainProduct;
  const images = p.allImages || [p.primaryImage || ''];
  
  // Generate 3 benefit blocks alternating image position
  const benefitBlocks = [
    { label: 'QUALIDADE PREMIUM', title: 'Desenvolvido com os melhores ingredientes', desc: 'Cada detalhe foi pensado para entregar o máximo resultado. Tecnologia avançada combinada com ingredientes selecionados.', img: images[0] || '' },
    { label: 'RESULTADO COMPROVADO', title: 'Aprovado por quem mais entende', desc: 'Milhares de clientes satisfeitos comprovam a eficácia. Resultados visíveis desde as primeiras utilizações.', img: images[1] || images[0] || '' },
    { label: 'FÁCIL DE USAR', title: 'Praticidade no seu dia a dia', desc: 'Integre facilmente na sua rotina. Simples, rápido e eficiente — sem complicação.', img: images[2] || images[0] || '' },
  ];

  return benefitBlocks.map((b, i) => `
<section class="lp-benefit" style="background: ${i % 2 === 0 ? c.bg : c.bgAlt}">
  <div class="lp-benefit-grid${i % 2 !== 0 ? ' lp-reverse' : ''}">
    <div class="lp-benefit-text">
      <span class="lp-benefit-label">${b.label}</span>
      <h2 class="lp-benefit-title">${b.title}</h2>
      <p class="lp-benefit-desc">${b.desc}</p>
    </div>
    <div class="lp-benefit-image">
      ${b.img ? `<img src="${b.img}" alt="${b.label}" />` : ''}
    </div>
  </div>
</section>`).join('\n');
}

function sectionTestimonials(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  if (input.reviews.length === 0) return '';
  
  const reviews = input.reviews.slice(0, 6);
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '5.0';

  return `
<section class="lp-testimonials" style="background: ${c.bgAlt}">
  <div class="lp-section-header">
    <span class="lp-section-badge">AVALIAÇÕES REAIS</span>
    <h2 class="lp-section-title">O que nossos clientes dizem</h2>
    <p class="lp-section-subtitle">Nota média: <strong>${avgRating}/5</strong> — ${reviews.length}+ avaliações verificadas</p>
  </div>
  <div class="lp-testimonials-grid">
    ${reviews.map(r => `
    <div class="lp-testimonial-card">
      <div class="lp-testimonial-stars">${stars(r.rating)}</div>
      <p class="lp-testimonial-text">"${r.comment}"</p>
      <p class="lp-testimonial-author">— ${r.name}</p>
    </div>`).join('\n    ')}
  </div>
</section>`;
}

function sectionSocialProof(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  if (input.socialProofImages.length === 0) return '';

  return `
<section class="lp-social-proof" style="background: ${c.bg}">
  <div class="lp-section-header">
    <span class="lp-section-badge">RESULTADOS REAIS</span>
    <h2 class="lp-section-title">Transformações de quem já usa</h2>
  </div>
  <div class="lp-proof-grid">
    ${input.socialProofImages.slice(0, 4).map((url, i) => `
    <div class="lp-proof-item">
      <img src="${url}" alt="Resultado ${i + 1}" />
    </div>`).join('\n    ')}
  </div>
</section>`;
}

function sectionPricing(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  // Combine main product + kits for pricing
  const pricingProducts = [...input.kits];
  
  // If no kits, show main product alone
  if (pricingProducts.length === 0) {
    pricingProducts.push(input.mainProduct);
  }

  // Sort by price ascending
  pricingProducts.sort((a, b) => a.price - b.price);

  // Featured = middle item or item with biggest discount
  const featuredIdx = pricingProducts.length === 3 ? 1 : 
    pricingProducts.reduce((best, p, i) => (p.discountPercent || 0) > (pricingProducts[best].discountPercent || 0) ? i : best, 0);

  return `
<section class="lp-pricing" id="ofertas" style="background: ${c.bgAlt}">
  <div class="lp-section-header">
    <span class="lp-section-badge">OFERTAS ESPECIAIS</span>
    <h2 class="lp-section-title">Escolha a melhor opção para você</h2>
    <p class="lp-section-subtitle">Quanto maior o kit, maior a economia</p>
  </div>
  <div class="lp-pricing-grid lp-pricing-cols-${Math.min(pricingProducts.length, 3)}">
    ${pricingProducts.map((p, i) => {
      const isFeatured = i === featuredIdx;
      return `
    <div class="lp-pricing-card${isFeatured ? ' lp-featured' : ''}">
      ${isFeatured ? `<div class="lp-featured-badge">🔥 MAIS VENDIDO</div>` : ''}
      <div class="lp-pricing-card-header">
        <h3>${p.name}</h3>
      </div>
      <div class="lp-pricing-card-image">
        ${p.primaryImage ? `<img src="${p.primaryImage}" alt="${p.name}" />` : ''}
      </div>
      <div class="lp-pricing-card-body">
        ${p.discountPercent ? `<span class="lp-discount-badge">${p.discountPercent}% OFF</span>` : ''}
        ${p.compareAtPrice ? `<p class="lp-price-old">De ${formatPrice(p.compareAtPrice)}</p>` : ''}
        <p class="lp-price-current">${formatPrice(p.price)}</p>
        <p class="lp-price-installment">ou ${installments(p.price)}</p>
        <a href="${input.ctaUrl}" class="lp-cta-button">${input.ctaText}</a>
      </div>
    </div>`;
    }).join('\n    ')}
  </div>
</section>`;
}

function sectionFaq(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  const faqs = [
    { q: `O ${input.mainProduct.name} realmente funciona?`, a: 'Sim! Nosso produto é testado e aprovado por milhares de clientes satisfeitos. Os resultados são comprovados por avaliações reais.' },
    { q: 'Qual o prazo de entrega?', a: 'Enviamos em até 24h úteis após a confirmação do pagamento. O prazo de entrega varia de acordo com a sua região.' },
    { q: 'Posso parcelar minha compra?', a: `Sim! Parcelamos em até 12x no cartão de crédito. O ${input.mainProduct.name} por apenas ${installments(input.mainProduct.price)} sem juros.` },
    { q: 'Tem garantia?', a: 'Oferecemos garantia de satisfação. Se não ficar satisfeito, devolvemos seu dinheiro.' },
    { q: 'O produto é original?', a: `Sim, 100% original e com nota fiscal. Somos ${input.storeName}, revendedor autorizado.` },
  ];

  return `
<section class="lp-faq" style="background: ${c.bg}">
  <div class="lp-section-header">
    <span class="lp-section-badge">DÚVIDAS FREQUENTES</span>
    <h2 class="lp-section-title">Perguntas Frequentes</h2>
  </div>
  <div class="lp-faq-list">
    ${faqs.map(f => `
    <details class="lp-faq-item">
      <summary class="lp-faq-question">${f.q}</summary>
      <p class="lp-faq-answer">${f.a}</p>
    </details>`).join('\n    ')}
  </div>
</section>`;
}

function sectionGuarantee(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  return `
<section class="lp-guarantee" style="background: ${c.bgAlt}">
  <div class="lp-guarantee-content">
    <div class="lp-guarantee-icon">🛡️</div>
    <h2 class="lp-section-title">Garantia de Satisfação</h2>
    <p class="lp-guarantee-text">Sua compra é 100% segura. Se por qualquer motivo você não ficar satisfeito com o ${input.mainProduct.name}, devolvemos seu dinheiro integralmente. Sem burocracia, sem perguntas.</p>
    <div class="lp-guarantee-badges">
      <span class="lp-guarantee-badge">✓ Compra Segura</span>
      <span class="lp-guarantee-badge">✓ Pagamento Protegido</span>
      <span class="lp-guarantee-badge">✓ Envio Garantido</span>
    </div>
  </div>
</section>`;
}

function sectionCtaFinal(input: PageTemplateInput, c: ReturnType<typeof getColorScheme>): string {
  const p = input.mainProduct;
  return `
<section class="lp-cta-final" style="background: ${c.bg}">
  <div class="lp-cta-final-grid">
    <div class="lp-cta-final-image">
      ${p.primaryImage ? `<img src="${p.primaryImage}" alt="${p.name}" />` : ''}
    </div>
    <div class="lp-cta-final-content">
      <h2 class="lp-section-title">Não perca essa oportunidade</h2>
      <p class="lp-cta-final-text">Garanta o seu ${p.name} agora mesmo com condições especiais. Estoque limitado!</p>
      ${p.compareAtPrice && p.compareAtPrice > p.price ? `
      <div class="lp-cta-final-price">
        <span class="lp-price-old">De ${formatPrice(p.compareAtPrice)}</span>
        <span class="lp-price-current">${formatPrice(p.price)}</span>
      </div>` : `
      <div class="lp-cta-final-price">
        <span class="lp-price-current">${formatPrice(p.price)}</span>
      </div>`}
      <a href="${input.ctaUrl}" class="lp-cta-button lp-cta-large">${input.ctaText}</a>
    </div>
  </div>
</section>`;
}

// ========== CSS GENERATOR ==========

function generateCSS(c: ReturnType<typeof getColorScheme>): string {
  return `
${c.fontImport}

/* ===== RESET & BASE ===== */
* { margin: 0; padding: 0; box-sizing: border-box; }
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; }
ul { list-style: none; padding: 0; }

/* ===== TYPOGRAPHY ===== */
h1, h2, h3, .lp-hero-title, .lp-section-title, .lp-benefit-title {
  font-family: ${c.fontDisplay};
  color: ${c.text};
}
body, p, span, li, a, details, summary {
  font-family: ${c.fontBody};
  color: ${c.text};
}

/* ===== CTA BUTTON ===== */
.lp-cta-button {
  display: inline-block;
  background: ${c.ctaBg};
  color: ${c.ctaText};
  padding: 16px 40px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
  max-width: 400px;
  text-align: center;
}
.lp-cta-button:hover { opacity: 0.9; transform: translateY(-2px); }
.lp-cta-large { padding: 20px 48px; font-size: 1.1rem; }

/* ===== SECTION HEADERS ===== */
.lp-section-header { text-align: center; max-width: 700px; margin: 0 auto 48px; }
.lp-section-badge, .lp-hero-badge, .lp-benefit-label {
  display: inline-block;
  background: ${c.badgeBg};
  color: ${c.badgeText};
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
}
.lp-section-title { font-size: 2.2rem; font-weight: 800; line-height: 1.15; margin-bottom: 12px; }
.lp-section-subtitle { font-size: 1rem; color: ${c.textMuted}; line-height: 1.6; }

/* ===== HERO ===== */
.lp-hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  padding: 80px 5% 80px;
  gap: 48px;
  background: ${c.bg};
  min-height: 0;
}
.lp-hero-content { max-width: 600px; }
.lp-hero-title {
  font-size: 3.2rem;
  font-weight: 800;
  line-height: 1.08;
  margin-bottom: 20px;
  letter-spacing: -0.5px;
}
.lp-hero-subtitle {
  font-size: 1.1rem;
  line-height: 1.7;
  color: ${c.textMuted};
  margin-bottom: 28px;
}
.lp-hero-benefits { margin-bottom: 36px; }
.lp-hero-benefits li {
  padding: 6px 0;
  font-size: 1rem;
  color: ${c.textMuted};
}
.lp-hero-price-hint {
  margin-top: 16px;
  font-size: 0.95rem;
  color: ${c.textMuted};
}
.lp-hero-price-hint strong { color: ${c.priceCurrent}; font-size: 1.1rem; }
.lp-hero-image {
  display: flex;
  align-items: center;
  justify-content: center;
}
.lp-hero-image img {
  width: 100%;
  max-width: 480px;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 20px 50px ${c.shadow});
}

/* ===== BENEFITS ===== */
.lp-benefit { padding: 80px 5%; }
.lp-benefit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
}
.lp-benefit-grid.lp-reverse { direction: rtl; }
.lp-benefit-grid.lp-reverse > * { direction: ltr; }
.lp-benefit-title { font-size: 2rem; font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
.lp-benefit-desc {
  font-size: 1rem;
  line-height: 1.7;
  color: ${c.textMuted};
  margin-bottom: 20px;
}
.lp-benefit-image img {
  width: 100%;
  max-width: 420px;
  height: auto;
  object-fit: contain;
  border-radius: 16px;
  filter: drop-shadow(0 15px 40px ${c.shadow});
}

/* ===== TESTIMONIALS ===== */
.lp-testimonials { padding: 80px 5%; }
.lp-testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
}
.lp-testimonial-card {
  background: ${c.bgCard};
  border: 1px solid ${c.bgCardBorder};
  border-radius: 16px;
  padding: 28px 24px;
}
.lp-testimonial-stars { color: #f59e0b; font-size: 1.1rem; margin-bottom: 12px; }
.lp-testimonial-text {
  font-size: 0.95rem;
  line-height: 1.65;
  color: ${c.textMuted};
  margin-bottom: 16px;
  font-style: italic;
}
.lp-testimonial-author {
  font-size: 0.85rem;
  font-weight: 600;
  color: ${c.text};
}

/* ===== SOCIAL PROOF ===== */
.lp-social-proof { padding: 80px 5%; }
.lp-proof-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
}
.lp-proof-item img {
  width: 100%;
  height: 280px;
  object-fit: cover;
  border-radius: 12px;
}

/* ===== PRICING ===== */
.lp-pricing { padding: 80px 5%; }
.lp-pricing-grid {
  display: grid;
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
  align-items: stretch;
}
.lp-pricing-cols-1 { grid-template-columns: 1fr; max-width: 400px; }
.lp-pricing-cols-2 { grid-template-columns: repeat(2, 1fr); max-width: 800px; }
.lp-pricing-cols-3 { grid-template-columns: repeat(3, 1fr); }
.lp-pricing-card {
  background: ${c.bgCard};
  border: 1px solid ${c.bgCardBorder};
  border-radius: 20px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  transition: transform 0.3s ease;
}
.lp-pricing-card:hover { transform: translateY(-4px); }
.lp-pricing-card.lp-featured {
  transform: scale(1.05);
  border: 2px solid ${c.featuredBorder};
  z-index: 2;
  box-shadow: 0 20px 60px ${c.shadow};
}
.lp-pricing-card.lp-featured:hover { transform: scale(1.07); }
.lp-featured-badge {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  background: ${c.accentGradient};
  color: ${c.ctaText};
  padding: 6px 20px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}
.lp-pricing-card-header h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 4px; }
.lp-pricing-card-image { margin: 16px 0; }
.lp-pricing-card-image img {
  width: 180px;
  height: 180px;
  object-fit: contain;
  filter: drop-shadow(0 10px 20px ${c.shadow});
}
.lp-pricing-card-body { width: 100%; }
.lp-discount-badge {
  display: inline-block;
  background: ${c.badgeBg};
  color: ${c.badgeText};
  padding: 4px 14px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 8px;
}
.lp-price-old {
  text-decoration: line-through;
  color: ${c.priceOld};
  font-size: 0.9rem;
  margin: 4px 0;
}
.lp-price-current {
  font-size: 2.4rem;
  font-weight: 800;
  color: ${c.priceCurrent};
  margin: 4px 0;
  font-family: ${c.fontDisplay};
}
.lp-price-installment {
  font-size: 0.85rem;
  color: ${c.textSubtle};
  margin-bottom: 20px;
}

/* ===== FAQ ===== */
.lp-faq { padding: 80px 5%; }
.lp-faq-list {
  max-width: 750px;
  margin: 0 auto;
}
.lp-faq-item {
  border-bottom: 1px solid ${c.divider};
  padding: 20px 0;
}
.lp-faq-question {
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  color: ${c.text};
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.lp-faq-question::after { content: '+'; font-size: 1.4rem; color: ${c.textSubtle}; }
.lp-faq-item[open] .lp-faq-question::after { content: '−'; }
.lp-faq-answer {
  margin-top: 12px;
  font-size: 0.95rem;
  line-height: 1.7;
  color: ${c.textMuted};
}

/* ===== GUARANTEE ===== */
.lp-guarantee { padding: 80px 5%; }
.lp-guarantee-content {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
}
.lp-guarantee-icon { font-size: 3.5rem; margin-bottom: 20px; }
.lp-guarantee-text {
  font-size: 1rem;
  line-height: 1.7;
  color: ${c.textMuted};
  margin: 16px 0 28px;
}
.lp-guarantee-badges {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}
.lp-guarantee-badge {
  background: ${c.badgeBg};
  color: ${c.badgeText};
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
}

/* ===== CTA FINAL ===== */
.lp-cta-final { padding: 80px 5%; }
.lp-cta-final-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  max-width: 1000px;
  margin: 0 auto;
}
.lp-cta-final-image img {
  width: 100%;
  max-width: 400px;
  object-fit: contain;
  filter: drop-shadow(0 20px 50px ${c.shadow});
}
.lp-cta-final-content { }
.lp-cta-final-text {
  font-size: 1.05rem;
  line-height: 1.7;
  color: ${c.textMuted};
  margin: 16px 0 24px;
}
.lp-cta-final-price { margin-bottom: 24px; }
.lp-cta-final-price .lp-price-old { display: block; }
.lp-cta-final-price .lp-price-current { display: block; }

/* ===== MOBILE ===== */
@media (max-width: 768px) {
  .lp-hero {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 48px 5%;
    gap: 32px;
  }
  .lp-hero-image { order: -1; }
  .lp-hero-image img { max-width: 280px; margin: 0 auto; }
  .lp-hero-title { font-size: 2rem; }
  .lp-hero-benefits { text-align: left; }

  .lp-benefit { padding: 48px 5%; }
  .lp-benefit-grid,
  .lp-benefit-grid.lp-reverse {
    grid-template-columns: 1fr;
    direction: ltr;
    text-align: center;
    gap: 24px;
  }
  .lp-benefit-image { order: -1; }
  .lp-benefit-image img { max-width: 260px; margin: 0 auto; }
  .lp-benefit-title { font-size: 1.5rem; }

  .lp-testimonials { padding: 48px 5%; }
  .lp-testimonials-grid { grid-template-columns: 1fr; max-width: 500px; }

  .lp-proof-grid { grid-template-columns: repeat(2, 1fr); }

  .lp-pricing { padding: 48px 5%; }
  .lp-pricing-grid { grid-template-columns: 1fr !important; max-width: 380px !important; }
  .lp-pricing-card.lp-featured { transform: none; }
  .lp-pricing-card.lp-featured:hover { transform: none; }
  .lp-price-current { font-size: 1.8rem; }

  .lp-faq { padding: 48px 5%; }

  .lp-guarantee { padding: 48px 5%; }

  .lp-cta-final { padding: 48px 5%; }
  .lp-cta-final-grid { grid-template-columns: 1fr; text-align: center; gap: 32px; }
  .lp-cta-final-image img { max-width: 260px; margin: 0 auto; }

  .lp-section-title { font-size: 1.6rem; }
  .lp-cta-button { width: 100%; max-width: 100%; display: block; }
}
`;
}

// ========== MAIN ASSEMBLER ==========

export interface AssembledPage {
  html: string;
  css: string;
  sectionOrder: string[];
}

/**
 * Assemble a complete landing page from pre-built templates.
 * Returns production-ready HTML + CSS that works WITHOUT AI.
 * AI can later customize the copy via adjustment prompts.
 */
export function assembleLandingPage(input: PageTemplateInput): AssembledPage {
  const c = getColorScheme(input.visualWeight, input.primaryColor);
  
  const sections: { id: string; html: string }[] = [];

  // Always: Hero
  sections.push({ id: 'hero', html: sectionHero(input, c) });

  // Always: Benefits
  sections.push({ id: 'benefits', html: sectionBenefits(input, c) });

  // Testimonials (if reviews exist)
  const testimonialsHtml = sectionTestimonials(input, c);
  if (testimonialsHtml) {
    sections.push({ id: 'testimonials', html: testimonialsHtml });
  }

  // Social Proof (if images exist)
  const socialProofHtml = sectionSocialProof(input, c);
  if (socialProofHtml) {
    sections.push({ id: 'social-proof', html: socialProofHtml });
  }

  // Always: Pricing
  sections.push({ id: 'pricing', html: sectionPricing(input, c) });

  // Always: FAQ
  sections.push({ id: 'faq', html: sectionFaq(input, c) });

  // Always: Guarantee
  sections.push({ id: 'guarantee', html: sectionGuarantee(input, c) });

  // Always: CTA Final
  sections.push({ id: 'cta-final', html: sectionCtaFinal(input, c) });

  const allHtml = `<style>\n${generateCSS(c)}\n</style>\n\n${sections.map(s => s.html).join('\n\n')}`;

  return {
    html: allHtml,
    css: generateCSS(c),
    sectionOrder: sections.map(s => s.id),
  };
}
