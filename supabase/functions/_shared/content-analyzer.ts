// =====================================================
// CONTENT ANALYZER - Análise Semântica de Conteúdo
// =====================================================
// Baseado no estudo de estrutura de blocos em e-commerce:
// - Identifica tipos de conteúdo por padrões semânticos
// - Extrai dados estruturados (produtos, depoimentos, FAQs)
// - Analisa hierarquia visual e lógica da página
// =====================================================

export interface AnalyzedContent {
  type: ContentBlockType;
  confidence: number;
  data: ExtractedData;
  metadata: ContentMetadata;
}

export type ContentBlockType =
  // Hero/Banner
  | 'hero_banner'
  | 'carousel_banner'
  | 'promo_bar'
  | 'secondary_banner'
  // Products
  | 'product_showcase'
  | 'category_showcase'
  | 'collection_highlight'
  // Social Proof
  | 'testimonials'
  | 'reviews'
  | 'social_proof'
  | 'logos_partners'
  | 'trust_badges'
  // Content
  | 'benefits'
  | 'features'
  | 'faq'
  | 'steps_how_it_works'
  | 'about_section'
  | 'stats_numbers'
  // Engagement
  | 'newsletter'
  | 'countdown'
  | 'cta_block'
  // Media
  | 'gallery'
  | 'video'
  | 'instagram_feed'
  // Institutional
  | 'text_content'
  | 'contact_form'
  | 'store_locator'
  | 'policy_content'
  // Footer
  | 'footer_links'
  | 'footer_info'
  // Unknown
  | 'unknown';

export interface ExtractedData {
  title?: string;
  subtitle?: string;
  description?: string;
  items?: Array<{
    title?: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    originalPrice?: string;
    link?: string;
    rating?: number;
    author?: string;
  }>;
  images?: Array<{ src: string; alt: string }>;
  videos?: Array<{ url: string; type: 'youtube' | 'vimeo' | 'mp4' }>;
  buttons?: Array<{ text: string; url: string }>;
  paragraphs?: string[];
  lists?: string[][];
  contacts?: {
    phone?: string;
    email?: string;
    whatsapp?: string;
    address?: string;
  };
}

export interface ContentMetadata {
  wordCount: number;
  hasImages: boolean;
  hasVideo: boolean;
  hasForm: boolean;
  hasPrices: boolean;
  hasLinks: boolean;
  estimatedPurpose: 'promotional' | 'informational' | 'transactional' | 'navigational';
}

// =====================================================
// BLOCK SIGNATURE PATTERNS (from study)
// =====================================================

// Banner Principal/Carrossel - largura total, ofertas importantes
const HERO_PATTERNS = {
  classPatterns: [
    /hero/i, /banner-principal/i, /main-banner/i, /slideshow/i,
    /carousel-banner/i, /destaque-principal/i, /full-width/i,
    /slider-home/i, /splash/i, /masthead/i,
  ],
  contentPatterns: [
    /compre\s+agora/i, /saiba\s+mais/i, /confira/i, /aproveite/i,
    /frete\s+gr[áa]tis/i, /at[ée]\s+\d+%\s+off/i, /lan[çc]amento/i,
    /promo[çc][ãa]o/i, /desconto/i, /oferta/i,
  ],
  structuralPatterns: [
    /class="[^"]*swiper[^"]*"/i,
    /class="[^"]*slick[^"]*"/i,
    /class="[^"]*owl-carousel[^"]*"/i,
    /data-slide/i,
  ],
};

// Faixa Promocional - condições da loja
const PROMO_BAR_PATTERNS = {
  classPatterns: [
    /promo-bar/i, /top-bar/i, /announcement/i, /faixa/i,
    /info-bar/i, /benefits-bar/i, /shipping-bar/i, /free-shipping/i,
  ],
  contentPatterns: [
    /frete\s+gr[áa]tis/i, /\d+x\s+sem\s+juros/i, /parcelamento/i,
    /entrega\s+r[áa]pida/i, /troca\s+gr[áa]tis/i, /primeira\s+troca/i,
    /cupom/i, /desconto\s+de/i, /acima\s+de\s+R\$/i,
  ],
};

// Vitrine de Produtos
const PRODUCT_SHOWCASE_PATTERNS = {
  classPatterns: [
    /product-grid/i, /products?-list/i, /vitrine/i, /showcase/i,
    /featured-products?/i, /bestseller/i, /mais-vendidos/i,
    /lancamentos/i, /ofertas/i, /destaques/i, /novidades/i,
  ],
  contentPatterns: [
    /mais\s+vendidos/i, /destaques/i, /lan[çc]amentos/i,
    /ofertas/i, /promo[çc][ãa]o/i, /R\$\s*[\d.,]+/,
    /comprar/i, /adicionar/i, /ver\s+produto/i,
  ],
  structuralPatterns: [
    // Repetitive elements with price
    /R\$\s*[\d.,]+.*R\$\s*[\d.,]+/,
    // Multiple product cards
    /class="[^"]*product-card[^"]*"/i,
  ],
};

// Categorias/Coleções em Destaque
const CATEGORY_SHOWCASE_PATTERNS = {
  classPatterns: [
    /category-list/i, /categories/i, /departamentos/i,
    /collection-list/i, /navegue-por/i, /compre-por/i,
    /shop-by/i, /browse/i,
  ],
  contentPatterns: [
    /categorias/i, /departamentos/i, /navegue\s+por/i,
    /compre\s+por/i, /cole[çc][ãa]o/i, /ver\s+todos?/i,
  ],
};

// Depoimentos/Reviews
const TESTIMONIALS_PATTERNS = {
  classPatterns: [
    /testimonial/i, /depoimento/i, /review/i, /avalia/i,
    /cliente-diz/i, /feedback/i, /opiniao/i,
  ],
  contentPatterns: [
    /o\s+que\s+dizem/i, /depoimentos/i, /avalia[çc][ãa]o/i,
    /clientes?\s+satisfeit/i, /★|⭐/, /\d\s+estrelas?/i,
    /recomendo/i, /adorei/i, /excelente/i,
  ],
  structuralPatterns: [
    // Multiple quotes or testimonial cards
    /class="[^"]*quote[^"]*"/i,
    /class="[^"]*rating[^"]*"/i,
  ],
};

// FAQ
const FAQ_PATTERNS = {
  classPatterns: [
    /faq/i, /perguntas/i, /accordion/i, /duvidas/i,
    /questoes/i, /collapse/i, /expandable/i,
  ],
  contentPatterns: [
    /perguntas?\s+frequentes?/i, /d[úu]vidas/i,
    /como\s+funciona/i, /faq/i, /\?$/m,
  ],
  structuralPatterns: [
    // Accordion structure
    /data-toggle="collapse"/i,
    /aria-expanded/i,
  ],
};

// Benefícios/Vantagens
const BENEFITS_PATTERNS = {
  classPatterns: [
    /benefits?/i, /vantagens?/i, /diferencia/i,
    /porque-comprar/i, /reasons?/i, /por-que/i,
    /features?/i, /caracteristicas/i,
  ],
  contentPatterns: [
    /por\s*que\s+comprar/i, /vantagens/i, /benef[íi]cios/i,
    /diferenciais/i, /garantia/i, /qualidade/i,
    /satisfa[çc][ãa]o/i, /exclusivo/i,
  ],
};

// Newsletter
const NEWSLETTER_PATTERNS = {
  classPatterns: [
    /newsletter/i, /subscribe/i, /cadastro-email/i,
    /email-capture/i, /mailing/i, /inscreva/i,
  ],
  contentPatterns: [
    /cadastre.*email/i, /receba.*ofertas/i, /assine/i,
    /newsletter/i, /inscrev/i, /novidades\s+por\s+email/i,
    /cupom.*desconto/i, /ganhe.*off/i,
  ],
  structuralPatterns: [
    /type="email"/i,
    /action="[^"]*newsletter/i,
  ],
};

// Steps/Como Funciona
const STEPS_PATTERNS = {
  classPatterns: [
    /steps?/i, /how-it-works/i, /como-funciona/i,
    /passo/i, /timeline/i, /processo/i,
  ],
  contentPatterns: [
    /como\s+funciona/i, /passo\s+\d/i, /etapa\s+\d/i,
    /\d[°º]?\s+passo/i, /primeiro/i, /segundo/i, /terceiro/i,
  ],
};

// Stats/Numbers
const STATS_PATTERNS = {
  classPatterns: [
    /stats?/i, /numbers?/i, /counter/i, /numeros/i,
    /achievements?/i, /conquistas/i,
  ],
  contentPatterns: [
    /\d+\s*(mil|k|%|\+)/i, /clientes?\s+satisfeit/i,
    /vendas?/i, /anos?\s+de/i, /\d+\s+anos/i,
    /\d+\+?\s+clientes/i, /\d+\+?\s+entregas/i,
  ],
};

// Logos/Parceiros
const LOGOS_PATTERNS = {
  classPatterns: [
    /logos?/i, /partners?/i, /parceiros?/i,
    /brands?/i, /clients?/i, /marcas?/i,
    /trust-logos/i, /payment-logos/i,
  ],
  contentPatterns: [
    /parceiros?/i, /marcas?/i, /clientes?/i,
    /confiam\s+em/i, /nossos?\s+clientes?/i,
  ],
};

// Social Proof / Trust
const TRUST_PATTERNS = {
  classPatterns: [
    /social-proof/i, /trust/i, /selo/i, /certificado/i,
    /badge/i, /seguro/i, /security/i,
  ],
  contentPatterns: [
    /site\s+seguro/i, /compra\s+segura/i, /certificado/i,
    /selo/i, /reclame\s+aqui/i, /ssl/i, /protegido/i,
  ],
};

// Galeria/Instagram
const GALLERY_PATTERNS = {
  classPatterns: [
    /gallery/i, /galeria/i, /instagram/i,
    /photos?/i, /fotos/i, /imagens/i,
  ],
  contentPatterns: [
    /instagram/i, /siga-nos/i, /galeria/i,
    /@\w+/i, /#\w+/,
  ],
};

// Vídeo
const VIDEO_PATTERNS = {
  classPatterns: [
    /video/i, /embed/i, /player/i,
    /youtube/i, /vimeo/i,
  ],
  structuralPatterns: [
    /youtube\.com\/embed/i,
    /player\.vimeo\.com/i,
    /<video[^>]*>/i,
  ],
};

// Countdown/Urgência
const COUNTDOWN_PATTERNS = {
  classPatterns: [
    /countdown/i, /timer/i, /urgency/i,
    /limited-time/i, /oferta-tempo/i,
  ],
  contentPatterns: [
    /tempo\s+limitado/i, /oferta.*encerra/i,
    /restam?\s+\d/i, /dias?\s*:\s*horas?/i,
    /\d+h\s*:\s*\d+m/i,
  ],
};

// Contato
const CONTACT_PATTERNS = {
  classPatterns: [
    /contact/i, /contato/i, /atendimento/i,
    /fale-conosco/i, /suporte/i,
  ],
  contentPatterns: [
    /fale\s+conosco/i, /contato/i, /atendimento/i,
    /whatsapp/i, /telefone/i, /\(\d{2}\)\s*\d{4,5}-?\d{4}/,
    /email/i, /chat/i,
  ],
  structuralPatterns: [
    /type="tel"/i,
    /action="[^"]*contact/i,
  ],
};

// Sobre
const ABOUT_PATTERNS = {
  classPatterns: [
    /about/i, /sobre/i, /quem-somos/i,
    /historia/i, /nossa-empresa/i,
  ],
  contentPatterns: [
    /sobre\s+n[óo]s/i, /quem\s+somos/i, /nossa\s+hist[óo]ria/i,
    /miss[ãa]o/i, /vis[ãa]o/i, /valores/i,
    /fundada/i, /desde\s+\d{4}/i,
  ],
};

// =====================================================
// MAIN ANALYZER FUNCTION
// =====================================================
export function analyzeContent(html: string): AnalyzedContent {
  const cleanHtml = removeScriptsAndStyles(html);
  
  // Calculate metadata first
  const metadata = calculateMetadata(cleanHtml);
  
  // Try to identify content type
  const typeResult = identifyContentType(cleanHtml);
  
  // Extract structured data based on type
  const data = extractStructuredData(cleanHtml, typeResult.type);
  
  return {
    type: typeResult.type,
    confidence: typeResult.confidence,
    data,
    metadata,
  };
}

// =====================================================
// CONTENT TYPE IDENTIFICATION
// =====================================================
function identifyContentType(html: string): { type: ContentBlockType; confidence: number } {
  const scores: Array<{ type: ContentBlockType; score: number }> = [];
  
  // Check each pattern group
  scores.push({ type: 'hero_banner', score: matchPatterns(html, HERO_PATTERNS) });
  scores.push({ type: 'promo_bar', score: matchPatterns(html, PROMO_BAR_PATTERNS) });
  scores.push({ type: 'product_showcase', score: matchPatterns(html, PRODUCT_SHOWCASE_PATTERNS) });
  scores.push({ type: 'category_showcase', score: matchPatterns(html, CATEGORY_SHOWCASE_PATTERNS) });
  scores.push({ type: 'testimonials', score: matchPatterns(html, TESTIMONIALS_PATTERNS) });
  scores.push({ type: 'faq', score: matchPatterns(html, FAQ_PATTERNS) });
  scores.push({ type: 'benefits', score: matchPatterns(html, BENEFITS_PATTERNS) });
  scores.push({ type: 'newsletter', score: matchPatterns(html, NEWSLETTER_PATTERNS) });
  scores.push({ type: 'steps_how_it_works', score: matchPatterns(html, STEPS_PATTERNS) });
  scores.push({ type: 'stats_numbers', score: matchPatterns(html, STATS_PATTERNS) });
  scores.push({ type: 'logos_partners', score: matchPatterns(html, LOGOS_PATTERNS) });
  scores.push({ type: 'trust_badges', score: matchPatterns(html, TRUST_PATTERNS) });
  scores.push({ type: 'gallery', score: matchPatterns(html, GALLERY_PATTERNS) });
  scores.push({ type: 'video', score: matchPatterns(html, VIDEO_PATTERNS) });
  scores.push({ type: 'countdown', score: matchPatterns(html, COUNTDOWN_PATTERNS) });
  scores.push({ type: 'contact_form', score: matchPatterns(html, CONTACT_PATTERNS) });
  scores.push({ type: 'about_section', score: matchPatterns(html, ABOUT_PATTERNS) });
  
  // Sort by score
  scores.sort((a, b) => b.score - a.score);
  
  const best = scores[0];
  
  if (best.score >= 3) {
    return { type: best.type, confidence: Math.min(best.score / 5, 1) };
  }
  
  if (best.score >= 2) {
    return { type: best.type, confidence: best.score / 6 };
  }
  
  // Fallback checks
  if (hasSubstantialText(html)) {
    return { type: 'text_content', confidence: 0.5 };
  }
  
  return { type: 'unknown', confidence: 0.1 };
}

function matchPatterns(html: string, patterns: {
  classPatterns?: RegExp[];
  contentPatterns?: RegExp[];
  structuralPatterns?: RegExp[];
}): number {
  let score = 0;
  
  if (patterns.classPatterns) {
    for (const pattern of patterns.classPatterns) {
      if (pattern.test(html)) score += 1;
    }
  }
  
  if (patterns.contentPatterns) {
    for (const pattern of patterns.contentPatterns) {
      if (pattern.test(html)) score += 1.5; // Content patterns are stronger
    }
  }
  
  if (patterns.structuralPatterns) {
    for (const pattern of patterns.structuralPatterns) {
      if (pattern.test(html)) score += 2; // Structural patterns are strongest
    }
  }
  
  return score;
}

// =====================================================
// STRUCTURED DATA EXTRACTION
// =====================================================
function extractStructuredData(html: string, type: ContentBlockType): ExtractedData {
  const data: ExtractedData = {};
  
  // Extract title (first h1, h2, or prominent element)
  data.title = extractTitle(html);
  
  // Extract images
  data.images = extractImages(html);
  
  // Extract videos
  data.videos = extractVideos(html);
  
  // Extract buttons/CTAs
  data.buttons = extractButtons(html);
  
  // Extract paragraphs
  data.paragraphs = extractParagraphs(html);
  
  // Type-specific extraction
  switch (type) {
    case 'testimonials':
    case 'reviews':
      data.items = extractTestimonials(html);
      break;
    case 'faq':
      data.items = extractFaqItems(html);
      break;
    case 'benefits':
    case 'features':
      data.items = extractBenefitItems(html);
      break;
    case 'product_showcase':
      data.items = extractProductCards(html);
      break;
    case 'contact_form':
      data.contacts = extractContactInfo(html);
      break;
  }
  
  return data;
}

function extractTitle(html: string): string | undefined {
  // Try h1
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const title = cleanText(h1Match[1]);
    if (title.length > 2 && title.length < 200) return title;
  }
  
  // Try h2
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Match) {
    const title = cleanText(h2Match[1]);
    if (title.length > 2 && title.length < 200) return title;
  }
  
  // Try title class
  const titleClassMatch = html.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//i);
  if (titleClassMatch) {
    const title = cleanText(titleClassMatch[1]);
    if (title.length > 2 && title.length < 200) return title;
  }
  
  return undefined;
}

function extractImages(html: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = [];
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    const alt = match[2] || '';
    
    // Skip tiny images, icons, and data URIs
    if (
      src.length > 10 &&
      !src.includes('data:image') &&
      !src.includes('1x1') &&
      !src.includes('pixel') &&
      !src.match(/icon|logo.*small|badge.*small/i)
    ) {
      images.push({ src, alt });
    }
  }
  
  return images.slice(0, 20);
}

function extractVideos(html: string): Array<{ url: string; type: 'youtube' | 'vimeo' | 'mp4' }> {
  const videos: Array<{ url: string; type: 'youtube' | 'vimeo' | 'mp4' }> = [];
  
  // YouTube iframes
  const youtubeMatches = html.matchAll(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/gi);
  for (const match of youtubeMatches) {
    videos.push({
      url: `https://www.youtube.com/embed/${match[1]}`,
      type: 'youtube',
    });
  }
  
  // YouTube watch URLs
  const watchMatches = html.matchAll(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/gi);
  for (const match of watchMatches) {
    videos.push({
      url: `https://www.youtube.com/embed/${match[1]}`,
      type: 'youtube',
    });
  }
  
  // Vimeo
  const vimeoMatches = html.matchAll(/player\.vimeo\.com\/video\/(\d+)/gi);
  for (const match of vimeoMatches) {
    videos.push({
      url: `https://player.vimeo.com/video/${match[1]}`,
      type: 'vimeo',
    });
  }
  
  // MP4 videos
  const mp4Matches = html.matchAll(/src=["']([^"']+\.mp4)[^"']*["']/gi);
  for (const match of mp4Matches) {
    videos.push({
      url: match[1],
      type: 'mp4',
    });
  }
  
  return videos.slice(0, 10);
}

function extractButtons(html: string): Array<{ text: string; url: string }> {
  const buttons: Array<{ text: string; url: string }> = [];
  
  // Links with button classes
  const buttonRegex = /<a[^>]*class="[^"]*(?:btn|button|cta)[^"]*"[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  
  let match;
  while ((match = buttonRegex.exec(html)) !== null) {
    const url = match[1];
    const text = cleanText(match[2]);
    
    if (text.length > 1 && text.length < 50 && url.length > 1) {
      buttons.push({ text, url });
    }
  }
  
  // Also try button elements inside links
  const buttonElemRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<button[^>]*>([\s\S]*?)<\/button>/gi;
  while ((match = buttonElemRegex.exec(html)) !== null) {
    const url = match[1];
    const text = cleanText(match[2]);
    
    if (text.length > 1 && text.length < 50 && url.length > 1) {
      buttons.push({ text, url });
    }
  }
  
  return buttons.slice(0, 5);
}

function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const text = cleanText(match[1]);
    if (text.length > 20 && text.length < 1000) {
      paragraphs.push(text);
    }
  }
  
  return paragraphs.slice(0, 10);
}

function extractTestimonials(html: string): ExtractedData['items'] {
  const items: ExtractedData['items'] = [];
  
  // Common testimonial patterns
  const testimonialPatterns = [
    /<(?:div|blockquote)[^>]*class="[^"]*(?:testimonial|depoimento|review)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|blockquote)>/gi,
    /<div[^>]*class="[^"]*quote[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];
  
  for (const pattern of testimonialPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const content = match[1];
      
      // Try to extract author name
      const authorMatch = content.match(/class="[^"]*(?:author|name|cliente)[^"]*"[^>]*>([\s\S]*?)<\//i);
      const author = authorMatch ? cleanText(authorMatch[1]) : undefined;
      
      // Try to extract quote text
      const quoteMatch = content.match(/class="[^"]*(?:quote|text|depoimento)[^"]*"[^>]*>([\s\S]*?)<\//i);
      const quote = quoteMatch ? cleanText(quoteMatch[1]) : cleanText(content);
      
      // Try to extract rating
      const ratingMatch = content.match(/(\d)\s*(?:estrelas?|stars?)/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : undefined;
      
      if (quote.length > 10) {
        items.push({
          title: author || 'Cliente',
          description: quote,
          rating,
          author,
        });
      }
    }
  }
  
  return items.slice(0, 10);
}

function extractFaqItems(html: string): ExtractedData['items'] {
  const items: ExtractedData['items'] = [];
  
  // Common FAQ patterns (accordion structure)
  const questionPatterns = [
    /<(?:h3|h4|button|div)[^>]*class="[^"]*(?:question|pergunta|accordion-header)[^"]*"[^>]*>([\s\S]*?)<\/(?:h3|h4|button|div)>/gi,
  ];
  
  for (const pattern of questionPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const question = cleanText(match[1]);
      
      // Try to find the answer following the question
      const afterQuestion = html.substring(match.index + match[0].length, match.index + match[0].length + 2000);
      const answerMatch = afterQuestion.match(/class="[^"]*(?:answer|resposta|accordion-body|collapse)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const answer = answerMatch ? cleanText(answerMatch[1]) : '';
      
      if (question.length > 5) {
        items.push({
          title: question,
          description: answer,
        });
      }
    }
  }
  
  return items.slice(0, 15);
}

function extractBenefitItems(html: string): ExtractedData['items'] {
  const items: ExtractedData['items'] = [];
  
  // Common benefit/feature item patterns
  const itemPatterns = [
    /<div[^>]*class="[^"]*(?:benefit|vantagem|feature|diferencial)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<li[^>]*class="[^"]*(?:benefit|vantagem|feature)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
  ];
  
  for (const pattern of itemPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const content = match[1];
      
      // Extract title (h3, h4, strong, or first text)
      const titleMatch = content.match(/<(?:h3|h4|strong|span)[^>]*>([\s\S]*?)<\/(?:h3|h4|strong|span)>/i);
      const title = titleMatch ? cleanText(titleMatch[1]) : '';
      
      // Extract description
      const descMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const description = descMatch ? cleanText(descMatch[1]) : '';
      
      if (title.length > 2 || description.length > 10) {
        items.push({ title, description });
      }
    }
  }
  
  return items.slice(0, 12);
}

function extractProductCards(html: string): ExtractedData['items'] {
  const items: ExtractedData['items'] = [];
  
  // Common product card patterns
  const cardPatterns = [
    /<(?:div|article)[^>]*class="[^"]*(?:product-card|product-item|produto)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/gi,
  ];
  
  for (const pattern of cardPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const content = match[1];
      
      // Extract product name
      const nameMatch = content.match(/<(?:h2|h3|a|span)[^>]*class="[^"]*(?:name|title|nome)[^"]*"[^>]*>([\s\S]*?)<\//i);
      const title = nameMatch ? cleanText(nameMatch[1]) : '';
      
      // Extract price
      const priceMatch = content.match(/R\$\s*([\d.,]+)/);
      const price = priceMatch ? `R$ ${priceMatch[1]}` : undefined;
      
      // Extract image
      const imgMatch = content.match(/<img[^>]*src=["']([^"']+)["']/i);
      const imageUrl = imgMatch ? imgMatch[1] : undefined;
      
      // Extract link
      const linkMatch = content.match(/<a[^>]*href=["']([^"']+)["']/i);
      const link = linkMatch ? linkMatch[1] : undefined;
      
      if (title.length > 2) {
        items.push({ title, price, imageUrl, link });
      }
    }
  }
  
  return items.slice(0, 20);
}

function extractContactInfo(html: string): ExtractedData['contacts'] {
  const contacts: ExtractedData['contacts'] = {};
  
  // Phone
  const phoneMatch = html.match(/\(?[0-9]{2}\)?\s*[0-9]{4,5}[-\s]?[0-9]{4}/);
  if (phoneMatch) contacts.phone = phoneMatch[0];
  
  // Email
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) contacts.email = emailMatch[0];
  
  // WhatsApp
  const whatsappMatch = html.match(/wa\.me\/(\d+)/i);
  if (whatsappMatch) contacts.whatsapp = whatsappMatch[1];
  
  return contacts;
}

// =====================================================
// METADATA CALCULATION
// =====================================================
function calculateMetadata(html: string): ContentMetadata {
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(' ').length;
  
  const hasImages = /<img[^>]*src=/i.test(html);
  const hasVideo = /youtube|vimeo|<video/i.test(html);
  const hasForm = /<form[^>]*>/i.test(html) && /<input[^>]*type/i.test(html);
  const hasPrices = /R\$\s*[\d.,]+/.test(html);
  const hasLinks = /<a[^>]*href/i.test(html);
  
  // Estimate purpose
  let estimatedPurpose: ContentMetadata['estimatedPurpose'] = 'informational';
  
  if (hasPrices || /comprar|adicionar|carrinho/i.test(html)) {
    estimatedPurpose = 'transactional';
  } else if (/oferta|promo|desconto/i.test(html)) {
    estimatedPurpose = 'promotional';
  } else if (/<nav|menu|categoria|departamento/i.test(html)) {
    estimatedPurpose = 'navigational';
  }
  
  return {
    wordCount,
    hasImages,
    hasVideo,
    hasForm,
    hasPrices,
    hasLinks,
    estimatedPurpose,
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function removeScriptsAndStyles(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function hasSubstantialText(html: string): boolean {
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return textContent.length > 200;
}

// =====================================================
// EXPORT PATTERN GROUPS FOR EXTERNAL USE
// =====================================================
export const BLOCK_PATTERNS = {
  HERO_PATTERNS,
  PROMO_BAR_PATTERNS,
  PRODUCT_SHOWCASE_PATTERNS,
  CATEGORY_SHOWCASE_PATTERNS,
  TESTIMONIALS_PATTERNS,
  FAQ_PATTERNS,
  BENEFITS_PATTERNS,
  NEWSLETTER_PATTERNS,
  STEPS_PATTERNS,
  STATS_PATTERNS,
  LOGOS_PATTERNS,
  TRUST_PATTERNS,
  GALLERY_PATTERNS,
  VIDEO_PATTERNS,
  COUNTDOWN_PATTERNS,
  CONTACT_PATTERNS,
  ABOUT_PATTERNS,
};
