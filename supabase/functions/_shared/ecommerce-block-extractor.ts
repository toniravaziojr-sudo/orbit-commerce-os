// =====================================================
// E-COMMERCE BLOCK EXTRACTOR v2
// =====================================================
// Extrai seções de HTML de páginas de e-commerce brasileiras
// Detecta padrões específicos de plataformas: VTEX, Nuvemshop,
// Shopify, Loja Integrada, Tray, Yampi, WooCommerce, Wix, etc.
// 
// Baseado no estudo de estrutura de blocos:
// - Banner Principal/Carrossel (Hero)
// - Faixa Promocional (Condições da loja)
// - Vitrine de Produtos em Destaque
// - Coleções/Categorias em Destaque
// - Prova Social (Reviews/Trends)
// - Bloco de Ofertas Personalizadas
// - Cadastro de Newsletter
// - Vantagens/Condições da Loja
// - Banners Promocionais Secundários
// - Rodapé com Blocos Informativos
// 
// Usa detector avançado de header/footer para limpar conteúdo
// Usa content-analyzer para análise semântica
// =====================================================

import { detectLayoutElements, extractMainContent } from './header-footer-detector.ts';
import { analyzeContent, type ContentBlockType, BLOCK_PATTERNS } from './content-analyzer.ts';

export interface ExtractedSection {
  type: SectionType;
  html: string;
  confidence: number;
  platform?: string;
  metadata: {
    title?: string;
    itemCount?: number;
    hasImages?: boolean;
    hasVideo?: boolean;
    hasCTA?: boolean;
    position: number;
  };
}

export type SectionType =
  | 'hero_banner'
  | 'carousel_banner'
  | 'promo_bar'
  | 'product_showcase'
  | 'category_showcase'
  | 'testimonials'
  | 'faq'
  | 'benefits'
  | 'features'
  | 'newsletter'
  | 'about'
  | 'contact'
  | 'gallery'
  | 'video'
  | 'countdown'
  | 'steps'
  | 'stats'
  | 'logos'
  | 'social_proof'
  | 'institutional_content'
  | 'footer_info'
  | 'unknown';

// =====================================================
// PLATFORM DETECTION PATTERNS
// =====================================================
const PLATFORM_PATTERNS = {
  vtex: [
    /vtex/i,
    /data-vtex/i,
    /vtex-store-components/i,
    /render\.vtex\.com/i,
    /__RENDER_8_STATE__/,
    /vtexassets\.com/i,
  ],
  shopify: [
    /shopify/i,
    /cdn\.shopify\.com/i,
    /shopify-section/i,
    /data-shopify/i,
    /Shopify\.theme/i,
  ],
  nuvemshop: [
    /nuvemshop/i,
    /tiendanube/i,
    /NuvemShop/i,
    /js-nuvemshop/i,
    /d26lpennugtm8s\.cloudfront\.net/i,
  ],
  woocommerce: [
    /woocommerce/i,
    /wc-/i,
    /wp-content/i,
    /wordpress/i,
  ],
  tray: [
    /tray\.com\.br/i,
    /traycorp/i,
    /data-tray/i,
    /cdn\.tray\.com\.br/i,
  ],
  yampi: [
    /yampi/i,
    /checkout\.yampi/i,
    /cdn\.yampi\.com\.br/i,
  ],
  loja_integrada: [
    /lojaintegrada/i,
    /loja-integrada/i,
    /cdn\.awsli\.com\.br/i,
    /awsli\.com\.br/i,
  ],
  bagy: [
    /bagy\.com\.br/i,
    /cdn\.bagy/i,
  ],
  magento: [
    /mage-/i,
    /Mage\.Cookies/i,
    /data-mage-init/i,
  ],
  wix: [
    /wix\.com/i,
    /parastorage\.com/i,
    /static\.wixstatic\.com/i,
  ],
};

// =====================================================
// SECTION DETECTION PATTERNS
// =====================================================
const SECTION_PATTERNS: Record<SectionType, {
  selectors: string[];
  classPatterns: RegExp[];
  contentPatterns: RegExp[];
  weight: number;
}> = {
  hero_banner: {
    selectors: [
      '[class*="hero"]',
      '[class*="banner-principal"]',
      '[class*="main-banner"]',
      '[class*="destaque"]',
      '[class*="slideshow"]',
      '[class*="slider"]',
      '.home-banner',
      '#banner-principal',
      '[data-section-type="slideshow"]',
    ],
    classPatterns: [
      /hero/i,
      /main-banner/i,
      /banner-principal/i,
      /slideshow/i,
      /carousel.*banner/i,
      /destaque-principal/i,
      /full-width-banner/i,
    ],
    contentPatterns: [
      /compre\s+agora/i,
      /saiba\s+mais/i,
      /confira/i,
      /aproveite/i,
      /frete\s+gr[áa]tis/i,
    ],
    weight: 10,
  },
  carousel_banner: {
    selectors: [
      '.swiper',
      '.slick-slider',
      '.owl-carousel',
      '[class*="carousel"]',
      '.splide',
      '.glide',
    ],
    classPatterns: [
      /carousel/i,
      /slider/i,
      /swiper/i,
      /slick/i,
      /owl-carousel/i,
      /splide/i,
    ],
    contentPatterns: [],
    weight: 8,
  },
  promo_bar: {
    selectors: [
      '[class*="promo-bar"]',
      '[class*="top-bar"]',
      '[class*="announcement"]',
      '[class*="faixa"]',
      '[class*="info-bar"]',
      '[class*="benefits-bar"]',
    ],
    classPatterns: [
      /promo-bar/i,
      /top-bar/i,
      /announcement/i,
      /faixa-promo/i,
      /shipping-bar/i,
      /benefits-bar/i,
    ],
    contentPatterns: [
      /frete\s+gr[áa]tis/i,
      /\d+x\s+sem\s+juros/i,
      /parcelamento/i,
      /entrega/i,
      /troca\s+gr[áa]tis/i,
      /desconto/i,
      /cupom/i,
    ],
    weight: 6,
  },
  product_showcase: {
    selectors: [
      '[class*="product-grid"]',
      '[class*="products-list"]',
      '[class*="vitrine"]',
      '[class*="showcase"]',
      '[class*="destaque-produtos"]',
      '[class*="featured-products"]',
      '[data-section-type="featured-collection"]',
    ],
    classPatterns: [
      /product-grid/i,
      /products?-list/i,
      /vitrine/i,
      /showcase/i,
      /featured.*product/i,
      /bestseller/i,
      /mais-vendidos/i,
      /lancamentos/i,
      /ofertas/i,
    ],
    contentPatterns: [
      /mais\s+vendidos/i,
      /destaques/i,
      /lan[çc]amentos/i,
      /ofertas/i,
      /promo[çc][ãa]o/i,
      /R\$\s*\d/i,
    ],
    weight: 9,
  },
  category_showcase: {
    selectors: [
      '[class*="category-list"]',
      '[class*="categories"]',
      '[class*="departamentos"]',
      '[class*="collection-list"]',
    ],
    classPatterns: [
      /category/i,
      /categories/i,
      /departamento/i,
      /collection-list/i,
      /navegue-por/i,
    ],
    contentPatterns: [
      /categorias/i,
      /departamentos/i,
      /navegue\s+por/i,
      /compre\s+por/i,
    ],
    weight: 8,
  },
  testimonials: {
    selectors: [
      '[class*="testimonial"]',
      '[class*="depoimento"]',
      '[class*="review"]',
      '[class*="avalia"]',
      '[class*="cliente-diz"]',
    ],
    classPatterns: [
      /testimonial/i,
      /depoimento/i,
      /review/i,
      /avalia/i,
      /cliente/i,
      /feedback/i,
    ],
    contentPatterns: [
      /o\s+que\s+dizem/i,
      /depoimentos/i,
      /avalia[çc][ãa]o/i,
      /clientes?\s+satisfeit/i,
      /★+|⭐/,
    ],
    weight: 7,
  },
  faq: {
    selectors: [
      '[class*="faq"]',
      '[class*="perguntas"]',
      '[class*="accordion"]',
      '[class*="duvidas"]',
    ],
    classPatterns: [
      /faq/i,
      /perguntas?-frequentes?/i,
      /accordion/i,
      /duvidas/i,
    ],
    contentPatterns: [
      /perguntas?\s+frequentes?/i,
      /d[úu]vidas/i,
      /como\s+funciona/i,
      /faq/i,
    ],
    weight: 7,
  },
  benefits: {
    selectors: [
      '[class*="benefits"]',
      '[class*="vantagens"]',
      '[class*="diferenciais"]',
      '[class*="porque-comprar"]',
      '[class*="reasons"]',
    ],
    classPatterns: [
      /benefits?/i,
      /vantagens?/i,
      /diferencia/i,
      /porque/i,
      /reasons?/i,
      /por-que/i,
    ],
    contentPatterns: [
      /por\s*que\s+comprar/i,
      /vantagens/i,
      /benefícios/i,
      /diferenciais/i,
      /garantia/i,
    ],
    weight: 7,
  },
  features: {
    selectors: [
      '[class*="features"]',
      '[class*="caracteristicas"]',
      '[class*="specs"]',
    ],
    classPatterns: [
      /features?/i,
      /caracteristica/i,
      /specs?/i,
    ],
    contentPatterns: [],
    weight: 6,
  },
  newsletter: {
    selectors: [
      '[class*="newsletter"]',
      '[class*="subscribe"]',
      '[class*="cadastro-email"]',
      '[class*="email-capture"]',
      'form[action*="newsletter"]',
    ],
    classPatterns: [
      /newsletter/i,
      /subscribe/i,
      /email-capture/i,
      /cadastr/i,
    ],
    contentPatterns: [
      /cadastre.*email/i,
      /receba.*ofertas/i,
      /assine/i,
      /newsletter/i,
      /inscrev/i,
    ],
    weight: 5,
  },
  about: {
    selectors: [
      '[class*="about"]',
      '[class*="sobre"]',
      '[class*="quem-somos"]',
      '[class*="historia"]',
    ],
    classPatterns: [
      /about/i,
      /sobre/i,
      /quem-somos/i,
      /historia/i,
      /nossa-empresa/i,
    ],
    contentPatterns: [
      /sobre\s+n[óo]s/i,
      /quem\s+somos/i,
      /nossa\s+hist[óo]ria/i,
      /miss[ãa]o/i,
      /vis[ãa]o/i,
      /valores/i,
    ],
    weight: 6,
  },
  contact: {
    selectors: [
      '[class*="contact"]',
      '[class*="contato"]',
      '[class*="atendimento"]',
      'form[action*="contact"]',
    ],
    classPatterns: [
      /contact/i,
      /contato/i,
      /atendimento/i,
      /fale-conosco/i,
    ],
    contentPatterns: [
      /fale\s+conosco/i,
      /contato/i,
      /atendimento/i,
      /whatsapp/i,
      /telefone/i,
      /\(\d{2}\)\s*\d{4,5}-?\d{4}/,
    ],
    weight: 5,
  },
  gallery: {
    selectors: [
      '[class*="gallery"]',
      '[class*="galeria"]',
      '[class*="instagram-feed"]',
      '[class*="photos"]',
    ],
    classPatterns: [
      /gallery/i,
      /galeria/i,
      /instagram/i,
      /photo/i,
      /fotos/i,
    ],
    contentPatterns: [
      /instagram/i,
      /siga-nos/i,
      /galeria/i,
      /#\w+/,
    ],
    weight: 5,
  },
  video: {
    selectors: [
      '[class*="video"]',
      'iframe[src*="youtube"]',
      'iframe[src*="vimeo"]',
      '[class*="embed"]',
    ],
    classPatterns: [
      /video/i,
      /embed/i,
      /player/i,
    ],
    contentPatterns: [],
    weight: 6,
  },
  countdown: {
    selectors: [
      '[class*="countdown"]',
      '[class*="timer"]',
      '[class*="oferta-tempo"]',
      '[class*="urgency"]',
    ],
    classPatterns: [
      /countdown/i,
      /timer/i,
      /urgency/i,
      /limited-time/i,
    ],
    contentPatterns: [
      /tempo\s+limitado/i,
      /oferta.*encerra/i,
      /restam?\s+\d/i,
      /dias?\s*:\s*horas?/i,
    ],
    weight: 7,
  },
  steps: {
    selectors: [
      '[class*="steps"]',
      '[class*="how-it-works"]',
      '[class*="como-funciona"]',
      '[class*="passo"]',
      '[class*="timeline"]',
    ],
    classPatterns: [
      /steps?/i,
      /how-it-works/i,
      /como-funciona/i,
      /passo/i,
      /timeline/i,
    ],
    contentPatterns: [
      /como\s+funciona/i,
      /passo\s+\d/i,
      /etapa\s+\d/i,
      /\d[°º]?\s+passo/i,
    ],
    weight: 6,
  },
  stats: {
    selectors: [
      '[class*="stats"]',
      '[class*="numbers"]',
      '[class*="counter"]',
      '[class*="numeros"]',
    ],
    classPatterns: [
      /stats?/i,
      /numbers?/i,
      /counter/i,
      /numeros/i,
      /achievements?/i,
    ],
    contentPatterns: [
      /\d+\s*(mil|k|%|\+)/i,
      /clientes?\s+satisfeit/i,
      /vendas?/i,
      /anos?\s+de/i,
    ],
    weight: 6,
  },
  logos: {
    selectors: [
      '[class*="logos"]',
      '[class*="partners"]',
      '[class*="parceiros"]',
      '[class*="brands"]',
      '[class*="clients"]',
    ],
    classPatterns: [
      /logos?/i,
      /partners?/i,
      /parceiros?/i,
      /brands?/i,
      /clients?/i,
      /marcas?/i,
    ],
    contentPatterns: [
      /parceiros?/i,
      /marcas?/i,
      /clientes?/i,
      /confiam\s+em/i,
    ],
    weight: 5,
  },
  social_proof: {
    selectors: [
      '[class*="social-proof"]',
      '[class*="trust"]',
      '[class*="selo"]',
      '[class*="certificado"]',
      '[class*="badge"]',
    ],
    classPatterns: [
      /social-proof/i,
      /trust/i,
      /selo/i,
      /certificad/i,
      /badge/i,
      /seguro/i,
    ],
    contentPatterns: [
      /site\s+seguro/i,
      /compra\s+segura/i,
      /certificado/i,
      /selo/i,
      /reclame\s+aqui/i,
    ],
    weight: 5,
  },
  institutional_content: {
    selectors: [
      '[class*="institutional"]',
      '[class*="content-page"]',
      '[class*="page-content"]',
      'article',
      '.entry-content',
    ],
    classPatterns: [
      /institutional/i,
      /content-page/i,
      /page-content/i,
      /entry-content/i,
    ],
    contentPatterns: [],
    weight: 4,
  },
  footer_info: {
    selectors: [
      'footer',
      '[class*="footer"]',
      '[class*="rodape"]',
    ],
    classPatterns: [
      /footer/i,
      /rodape/i,
    ],
    contentPatterns: [],
    weight: 3,
  },
  unknown: {
    selectors: [],
    classPatterns: [],
    contentPatterns: [],
    weight: 1,
  },
};

// =====================================================
// MAIN EXTRACTION FUNCTION (Enhanced with Content Analysis)
// =====================================================
export function extractSectionsFromHTML(html: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  
  // Detect platform
  const platform = detectPlatform(html);
  console.log(`[block-extractor] Platform detected: ${platform || 'unknown'}`);
  
  // Use advanced header/footer detector to get clean main content
  console.log(`[block-extractor] Running header/footer detection...`);
  const layoutResult = detectLayoutElements(html);
  
  if (layoutResult.header) {
    console.log(`[block-extractor] Header detected (confidence: ${layoutResult.header.confidence.toFixed(2)}, source: ${layoutResult.header.source})`);
  }
  if (layoutResult.footer) {
    console.log(`[block-extractor] Footer detected (confidence: ${layoutResult.footer.confidence.toFixed(2)}, source: ${layoutResult.footer.source})`);
    console.log(`[block-extractor] Footer sections: ${layoutResult.footerSections.length}`);
  }
  
  // Extract main content (without header/footer)
  const cleanHtml = extractMainContent(html);
  console.log(`[block-extractor] Clean HTML size: ${cleanHtml.length} (original: ${html.length})`);
  
  // Extract major sections from cleaned HTML structure
  const rawSections = extractRawSections(cleanHtml);
  console.log(`[block-extractor] Found ${rawSections.length} raw sections`);
  
  // Classify each section using BOTH traditional patterns AND semantic analysis
  for (let i = 0; i < rawSections.length; i++) {
    const rawSection = rawSections[i];
    
    // Traditional pattern-based classification
    const patternClassification = classifySection(rawSection, platform);
    
    // Semantic content analysis (from content-analyzer)
    const contentAnalysis = analyzeContent(rawSection);
    
    // Combine results - prefer higher confidence
    let finalType: SectionType = patternClassification.type;
    let finalConfidence = patternClassification.confidence;
    
    // If content analysis has higher confidence, use that
    if (contentAnalysis.confidence > patternClassification.confidence) {
      finalType = mapContentTypeToSectionType(contentAnalysis.type);
      finalConfidence = contentAnalysis.confidence;
    }
    
    // Boost confidence if both agree
    if (mapContentTypeToSectionType(contentAnalysis.type) === patternClassification.type) {
      finalConfidence = Math.min(1, finalConfidence * 1.3);
    }
    
    if (finalType !== 'unknown' || finalConfidence > 0.3) {
      sections.push({
        type: finalType,
        html: rawSection,
        confidence: finalConfidence,
        metadata: {
          title: patternClassification.metadata.title || contentAnalysis.data.title,
          itemCount: patternClassification.metadata.itemCount || contentAnalysis.data.items?.length,
          hasImages: patternClassification.metadata.hasImages || contentAnalysis.metadata.hasImages,
          hasVideo: patternClassification.metadata.hasVideo || contentAnalysis.metadata.hasVideo,
          hasCTA: patternClassification.metadata.hasCTA,
          position: i,
        },
        platform: platform || undefined,
      });
    }
  }
  
  // Sort by position and confidence
  sections.sort((a, b) => {
    if (a.metadata.position !== b.metadata.position) {
      return a.metadata.position - b.metadata.position;
    }
    return b.confidence - a.confidence;
  });
  
  console.log(`[block-extractor] Classified ${sections.length} sections`);
  return sections;
}

// Map ContentBlockType to SectionType
function mapContentTypeToSectionType(contentType: ContentBlockType): SectionType {
  const mapping: Record<ContentBlockType, SectionType> = {
    'hero_banner': 'hero_banner',
    'carousel_banner': 'carousel_banner',
    'promo_bar': 'promo_bar',
    'secondary_banner': 'hero_banner',
    'product_showcase': 'product_showcase',
    'category_showcase': 'category_showcase',
    'collection_highlight': 'category_showcase',
    'testimonials': 'testimonials',
    'reviews': 'testimonials',
    'social_proof': 'social_proof',
    'logos_partners': 'logos',
    'trust_badges': 'social_proof',
    'benefits': 'benefits',
    'features': 'features',
    'faq': 'faq',
    'steps_how_it_works': 'steps',
    'about_section': 'about',
    'stats_numbers': 'stats',
    'newsletter': 'newsletter',
    'countdown': 'countdown',
    'cta_block': 'newsletter',
    'gallery': 'gallery',
    'video': 'video',
    'instagram_feed': 'gallery',
    'text_content': 'institutional_content',
    'contact_form': 'contact',
    'store_locator': 'contact',
    'policy_content': 'institutional_content',
    'footer_links': 'footer_info',
    'footer_info': 'footer_info',
    'unknown': 'unknown',
  };
  return mapping[contentType] || 'unknown';
}

// Export layout detection for external use
export { detectLayoutElements } from './header-footer-detector.ts';

// =====================================================
// PLATFORM DETECTION
// =====================================================
function detectPlatform(html: string): string | null {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(html)) {
        return platform;
      }
    }
  }
  return null;
}

// =====================================================
// RAW SECTION EXTRACTION
// =====================================================
function extractRawSections(html: string): string[] {
  const sections: string[] = [];
  
  // Strategy 1: Extract by semantic tags
  const semanticSections = extractByTags(html, ['section', 'article', 'main', 'aside']);
  sections.push(...semanticSections);
  
  // Strategy 2: Extract by common div patterns
  const divSections = extractByDivPatterns(html);
  sections.push(...divSections);
  
  // Strategy 3: If still not enough, split by major structural divs
  if (sections.length < 3) {
    const fallbackSections = extractByStructuralDivs(html);
    sections.push(...fallbackSections);
  }
  
  // Deduplicate by significant overlap
  return deduplicateSections(sections);
}

function extractByTags(html: string, tags: string[]): string[] {
  const sections: string[] = [];
  
  for (const tag of tags) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      const content = match[0];
      // Only include sections with meaningful content
      if (content.length > 100 && hasVisibleContent(content)) {
        sections.push(content);
      }
    }
  }
  
  return sections;
}

function extractByDivPatterns(html: string): string[] {
  const sections: string[] = [];
  
  // Common section class patterns
  const patterns = [
    /class="[^"]*(?:section|banner|hero|products|testimonials|faq|benefits|newsletter|about|contact|gallery|showcase|vitrine|carousel)[^"]*"/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      // Find the opening div that contains this class
      const startIndex = html.lastIndexOf('<div', match.index);
      if (startIndex !== -1) {
        const divContent = extractMatchingDiv(html, startIndex);
        if (divContent && divContent.length > 100 && hasVisibleContent(divContent)) {
          sections.push(divContent);
        }
      }
    }
  }
  
  return sections;
}

function extractByStructuralDivs(html: string): string[] {
  const sections: string[] = [];
  
  // Look for direct children of body or main
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return sections;
  
  const bodyContent = bodyMatch[1];
  
  // Extract top-level divs with significant content
  const divRegex = /<div[^>]*class="[^"]*"[^>]*>[\s\S]{500,}?<\/div>/gi;
  let match;
  while ((match = divRegex.exec(bodyContent)) !== null) {
    const content = match[0];
    if (hasVisibleContent(content)) {
      sections.push(content);
    }
  }
  
  return sections;
}

function extractMatchingDiv(html: string, startIndex: number): string | null {
  let depth = 0;
  let endIndex = startIndex;
  let inTag = false;
  let inString = false;
  let stringChar = '';
  
  for (let i = startIndex; i < html.length && i < startIndex + 50000; i++) {
    const char = html[i];
    
    if (inString) {
      if (char === stringChar && html[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"' || char === "'") {
      if (inTag) {
        inString = true;
        stringChar = char;
      }
      continue;
    }
    
    if (char === '<') {
      inTag = true;
      // Check if it's a div
      if (html.substring(i, i + 4).toLowerCase() === '<div') {
        depth++;
      } else if (html.substring(i, i + 6).toLowerCase() === '</div>') {
        depth--;
        if (depth === 0) {
          endIndex = i + 6;
          return html.substring(startIndex, endIndex);
        }
      }
    } else if (char === '>') {
      inTag = false;
    }
  }
  
  return null;
}

function hasVisibleContent(html: string): boolean {
  // Remove tags and check if there's actual text content
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return textContent.length > 20;
}

function deduplicateSections(sections: string[]): string[] {
  const unique: string[] = [];
  
  for (const section of sections) {
    let isDuplicate = false;
    const sectionText = section.replace(/<[^>]+>/g, '').slice(0, 200);
    
    for (const existing of unique) {
      const existingText = existing.replace(/<[^>]+>/g, '').slice(0, 200);
      
      // Check for significant overlap
      if (sectionText.includes(existingText.slice(0, 100)) ||
          existingText.includes(sectionText.slice(0, 100))) {
        // Keep the longer one
        if (section.length > existing.length) {
          const index = unique.indexOf(existing);
          unique[index] = section;
        }
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      unique.push(section);
    }
  }
  
  return unique;
}

// =====================================================
// SECTION CLASSIFICATION
// =====================================================
function classifySection(html: string, platform: string | null): {
  type: SectionType;
  html: string;
  confidence: number;
  metadata: {
    title?: string;
    itemCount?: number;
    hasImages?: boolean;
    hasVideo?: boolean;
    hasCTA?: boolean;
    position: number;
  };
} {
  const scores: Record<SectionType, number> = {} as Record<SectionType, number>;
  
  // Initialize scores
  for (const type of Object.keys(SECTION_PATTERNS) as SectionType[]) {
    scores[type] = 0;
  }
  
  const htmlLower = html.toLowerCase();
  
  // Score each section type
  for (const [type, patterns] of Object.entries(SECTION_PATTERNS) as [SectionType, typeof SECTION_PATTERNS[SectionType]][]) {
    // Check class patterns
    for (const pattern of patterns.classPatterns) {
      if (pattern.test(html)) {
        scores[type] += patterns.weight * 2;
      }
    }
    
    // Check content patterns
    for (const pattern of patterns.contentPatterns) {
      if (pattern.test(html)) {
        scores[type] += patterns.weight;
      }
    }
  }
  
  // Find best match
  let bestType: SectionType = 'unknown';
  let bestScore = 0;
  
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as SectionType;
    }
  }
  
  // Extract metadata
  const metadata = extractSectionMetadata(html);
  
  // Calculate confidence (0-1)
  const maxPossibleScore = 100;
  const confidence = Math.min(bestScore / maxPossibleScore, 1);
  
  return {
    type: bestType,
    html,
    confidence,
    metadata: {
      ...metadata,
      position: 0,
    },
  };
}

function extractSectionMetadata(html: string): {
  title?: string;
  itemCount?: number;
  hasImages: boolean;
  hasVideo: boolean;
  hasCTA: boolean;
} {
  // Extract title
  const titleMatch = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;
  
  // Count items (li, cards, etc.)
  const liCount = (html.match(/<li/gi) || []).length;
  const cardCount = (html.match(/class="[^"]*card[^"]*"/gi) || []).length;
  const itemCount = Math.max(liCount, cardCount);
  
  // Check for images
  const hasImages = /<img/i.test(html) || /background-image/i.test(html);
  
  // Check for video
  const hasVideo = /youtube|vimeo|<video/i.test(html);
  
  // Check for CTA buttons
  const hasCTA = /<button/i.test(html) ||
                 /<a[^>]*class="[^"]*btn[^"]*"/i.test(html) ||
                 /compre\s*agora|saiba\s*mais|comprar|adicionar/i.test(html);
  
  return {
    title,
    itemCount: itemCount > 0 ? itemCount : undefined,
    hasImages,
    hasVideo,
    hasCTA,
  };
}

// =====================================================
// HELPER: Extract all page URLs from a store
// =====================================================
export function extractPageLinks(html: string, baseUrl: string): {
  homePage: string;
  institutionalPages: Array<{ url: string; title: string; slug: string }>;
  categoryPages: Array<{ url: string; title: string; slug: string }>;
} {
  const institutionalPages: Array<{ url: string; title: string; slug: string }> = [];
  const categoryPages: Array<{ url: string; title: string; slug: string }> = [];
  
  // =====================================================
  // INSTITUTIONAL PAGE PATTERNS (BR E-COMMERCE FOCUSED)
  // =====================================================
  
  // URL PATH patterns that indicate institutional pages (platform-specific)
  const institutionalPathPatterns = [
    // Shopify uses /pages/ for all institutional pages
    /\/pages\//i,
    // VTEX uses /institucional/ or /paginas/
    /\/institucional\//i,
    /\/paginas?\//i,
    // Nuvemshop uses direct slugs but often /p/ or /pagina/
    /\/p\/[^/]+$/i,
    /\/pagina\//i,
    // WooCommerce/WordPress uses direct slugs
    /^\/(about|sobre|quem-somos|politica|termos|contato|faq|duvidas)/i,
  ];
  
  // Slug/title patterns that indicate institutional content
  const institutionalContentPatterns = [
    // About/History
    /sobre|about|quem-somos|nossa-historia|nossa-empresa|history|who-we-are/i,
    // Policies
    /politica|policy|privacidade|privacy|lgpd|cookies/i,
    // Terms
    /termos|terms|condicoes|conditions|uso|use/i,
    // Returns/Exchange
    /troca|devolucao|exchange|return|garantia|warranty/i,
    // FAQ
    /faq|perguntas|duvidas|frequentes|questions|ajuda|help|suporte/i,
    // How to buy
    /como-comprar|how-to-buy|como-funciona|how-it-works/i,
    // Payment
    /pagamento|payment|formas-de-pagamento|pagar/i,
    // Shipping/Delivery
    /entrega|shipping|envio|frete|delivery|prazo/i,
    // Work with us
    /trabalhe|careers|vagas|jobs/i,
    // Store/physical stores
    /lojas|stores|nossas-lojas|encontre/i,
  ];
  
  // Patterns to EXCLUDE (functional pages)
  const excludePatterns = [
    /login|cadastro|register|signup|sign-up/i,
    /checkout|carrinho|cart|pedido|order/i,
    /minha-conta|my-account|account|dashboard/i,
    /wishlist|favoritos|lista-de-desejos/i,
    /rastreio|rastrear|tracking|rastreamento/i,
    /busca|search|pesquisa/i,
    /produto|product|item/i,
    /colecao|collection|categoria|category/i,
    /blog/i, // Blog is separate
  ];
  
  // =====================================================
  // EXTRACT LINKS FROM ENTIRE PAGE (not just footer)
  // =====================================================
  // Search in: footer, header nav, and main content
  
  const searchAreas = [
    // Footer (primary source for institutional links)
    { name: 'footer', html: html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i)?.[1] || '' },
    // Navigation menus (often have institutional links)
    { name: 'nav', html: html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi)?.join(' ') || '' },
    // Header
    { name: 'header', html: html.match(/<header[^>]*>([\s\S]*?)<\/header>/i)?.[1] || '' },
    // Also search the full HTML for /pages/ links (Shopify specific)
    { name: 'full', html: html },
  ];
  
  const seenUrls = new Set<string>();
  
  for (const area of searchAreas) {
    if (!area.html) continue;
    
    // Find all links with href
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(area.html)) !== null) {
      const [, href, rawText] = match;
      if (!href) continue;
      
      // Clean text (remove inner tags)
      const cleanText = rawText.replace(/<[^>]*>/g, '').trim();
      if (cleanText.length < 2 || cleanText.length > 100) continue;
      
      // Normalize URL
      let url = href;
      try {
        if (href.startsWith('/')) {
          const base = new URL(baseUrl);
          url = `${base.origin}${href}`;
        } else if (!href.startsWith('http')) {
          continue;
        }
        
        // Skip external links
        const linkUrl = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        if (linkUrl.hostname !== baseUrlObj.hostname) continue;
        
        // Skip anchors
        if (url.includes('#') && !url.split('#')[0]) continue;
        
      } catch {
        continue;
      }
      
      // Skip already seen
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      
      const pathname = new URL(url).pathname;
      const slug = extractSlugFromUrl(url);
      
      // Skip if matches exclude patterns
      if (excludePatterns.some(p => p.test(pathname) || p.test(slug))) {
        continue;
      }
      
      // Check if institutional by PATH pattern
      const isInstitutionalByPath = institutionalPathPatterns.some(p => p.test(pathname));
      
      // Check if institutional by CONTENT pattern (slug or title)
      const isInstitutionalByContent = institutionalContentPatterns.some(p => 
        p.test(slug) || p.test(cleanText)
      );
      
      if (isInstitutionalByPath || isInstitutionalByContent) {
        institutionalPages.push({
          url,
          title: cleanText || formatSlugAsTitle(slug),
          slug,
        });
        console.log(`[page-links] Found institutional page: ${slug} (${area.name})`);
      } else if (slug && area.name !== 'full') {
        // Categories only from structured areas (not full HTML)
        categoryPages.push({
          url,
          title: cleanText,
          slug,
        });
      }
    }
  }
  
  // Deduplicate by URL
  const uniqueInstitutional = deduplicatePages(institutionalPages);
  const uniqueCategories = deduplicatePages(categoryPages);
  
  console.log(`[page-links] Total: ${uniqueInstitutional.length} institutional, ${uniqueCategories.length} category pages`);
  
  return {
    homePage: baseUrl,
    institutionalPages: uniqueInstitutional,
    categoryPages: uniqueCategories.slice(0, 20), // Limit categories
  };
}

function formatSlugAsTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

function extractSlugFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/^\/|\/$/g, '').split('/').pop() || '';
  } catch {
    return '';
  }
}

function deduplicatePages<T extends { url: string }>(pages: T[]): T[] {
  const seen = new Set<string>();
  return pages.filter(page => {
    if (seen.has(page.url)) return false;
    seen.add(page.url);
    return true;
  });
}

// =====================================================
// EXPORT SECTION TYPE MAPPER
// =====================================================
export function mapSectionTypeToBlockType(sectionType: SectionType): string {
  const mapping: Record<SectionType, string> = {
    hero_banner: 'hero',
    carousel_banner: 'hero',
    promo_bar: 'benefits',
    product_showcase: 'product_cards',
    category_showcase: 'category_grid',
    testimonials: 'testimonials',
    faq: 'faq',
    benefits: 'benefits',
    features: 'features',
    newsletter: 'cta',
    about: 'about',
    contact: 'contact',
    gallery: 'gallery',
    video: 'generic',
    countdown: 'countdown',
    steps: 'steps',
    stats: 'stats',
    logos: 'logos',
    social_proof: 'benefits',
    institutional_content: 'about',
    footer_info: 'generic',
    unknown: 'generic',
  };
  
  return mapping[sectionType] || 'generic';
}
