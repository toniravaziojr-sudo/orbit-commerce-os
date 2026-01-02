// =====================================================
// PAGE COMPOSER v3 - Intelligent Block Ordering System
// =====================================================
// 
// Receives classified blocks and reorganizes them into
// a logical, hierarchical page structure.
//
// IMPROVEMENTS v3:
// - Strict noise validation (rejects blocks with YouTube noise)
// - Better testimonial validation (rejects generic "Cliente 1")
// - Improved deduplication
// - VideoCarousel support
// =====================================================

import type { BlockNode } from './intelligent-block-mapper.ts';

// =====================================================
// NOISE PATTERNS - Reject blocks with these titles
// =====================================================
const NOISE_TITLE_PATTERNS = [
  /^more videos$/i,
  /^mais vídeos$/i,
  /^hide more videos$/i,
  /^ocultar mais vídeos$/i,
  /^watch later$/i,
  /^assistir mais tarde$/i,
  /^share$/i,
  /^compartilhar$/i,
  /^subscribe$/i,
  /^inscrever-se$/i,
  /^copy link$/i,
  /^copiar link$/i,
  /^you're signed out$/i,
  /^você não está conectado$/i,
  /^\d+\s*views?$/i,
  /^\d+\s*visualizações?$/i,
  /^tap to unmute$/i,
  /^toque para ativar o som$/i,
  /^video unavailable$/i,
  /^vídeo indisponível$/i,
  /^watch on youtube$/i,
  /^assistir no youtube$/i,
];

// Platform-specific noise patterns
const PLATFORM_NOISE_PATTERNS: Record<string, RegExp[]> = {
  shopify: [
    /^announcement$/i,
    /^quick view$/i,
    /^add to cart$/i,
    /^sold out$/i,
  ],
  nuvemshop: [
    /^carregando$/i,
    /^loading$/i,
    /^ver mais$/i,
  ],
  tray: [
    /^vitrine$/i,
    /^lançamentos$/i,
  ],
  yampi: [
    /^comprar agora$/i,
    /^adicionar$/i,
  ],
};

function isNoiseTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return NOISE_TITLE_PATTERNS.some(pattern => pattern.test(title.trim()));
}

// =====================================================
// BLOCK ORDER PRIORITY (lower = higher in page)
// =====================================================
const BLOCK_ORDER_PRIORITY: Record<string, number> = {
  // Position 0: Hero/Banner (always first)
  'Hero': 0,
  'HeroBanner': 0,
  
  // Position 1: Image Carousel (banner rotator)
  'ImageCarousel': 1,
  
  // Position 2: Video (main video after hero)
  'YouTubeVideo': 2,
  'VideoUpload': 2,
  'VideoCarousel': 2,
  
  // Position 3: Benefits/Features (present the product)
  'InfoHighlights': 3,
  'FeatureList': 3,
  
  // Position 4: Stats (social proof with numbers)
  'StatsNumbers': 4,
  
  // Position 5: Content columns (product details)
  'ContentColumns': 5,
  'TextBanners': 5,
  
  // Position 6: Steps/Timeline (how it works)
  'StepsTimeline': 6,
  
  // Position 7: Gallery/Images
  'ImageGallery': 7,
  'Image': 7,
  
  // Position 8: Testimonials (social proof)
  'Testimonials': 8,
  
  // Position 9: FAQ/Accordion
  'FAQ': 9,
  'AccordionBlock': 9,
  
  // Position 10: Logos (partners)
  'LogosCarousel': 10,
  
  // Position 11: Countdown (urgency)
  'CountdownTimer': 11,
  
  // Position 99: Generic/Fallback (at the end before CTA)
  'RichText': 99,
  'Section': 99,
};

// =====================================================
// DEDUPLICATION RULES
// =====================================================
interface DedupRule {
  maxCount: number;
  keepStrategy: 'first' | 'last' | 'merge';
}

const DEDUP_RULES: Record<string, DedupRule> = {
  'Hero': { maxCount: 1, keepStrategy: 'first' },
  'HeroBanner': { maxCount: 1, keepStrategy: 'first' },
  'ImageCarousel': { maxCount: 1, keepStrategy: 'first' },
  'VideoCarousel': { maxCount: 1, keepStrategy: 'merge' },
  'CountdownTimer': { maxCount: 1, keepStrategy: 'first' },
  'StatsNumbers': { maxCount: 1, keepStrategy: 'first' },
  'StepsTimeline': { maxCount: 1, keepStrategy: 'first' },
  'FAQ': { maxCount: 1, keepStrategy: 'merge' },
  'Testimonials': { maxCount: 1, keepStrategy: 'merge' },
  'LogosCarousel': { maxCount: 1, keepStrategy: 'first' },
};

// =====================================================
// PAGE COMPOSITION STRUCTURE
// =====================================================
interface PageComposition {
  hero: BlockNode[];
  imageCarousel: BlockNode[];
  video: BlockNode[];
  benefits: BlockNode[];
  stats: BlockNode[];
  content: BlockNode[];
  steps: BlockNode[];
  gallery: BlockNode[];
  testimonials: BlockNode[];
  faq: BlockNode[];
  logos: BlockNode[];
  countdown: BlockNode[];
  generic: BlockNode[];
}

// =====================================================
// BLOCK VALIDATION - Reject noise blocks
// =====================================================
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Generic testimonial patterns to reject
const GENERIC_TESTIMONIAL_PATTERNS = [
  /^cliente\s*\d*$/i,
  /^customer\s*\d*$/i,
  /^usuário\s*\d*$/i,
  /^user\s*\d*$/i,
  /^pessoa\s*\d*$/i,
];

const GENERIC_TESTIMONIAL_TEXTS = [
  'excelente produto!',
  'recomendo a todos.',
  'recomendo a todos',
  'depoimento do cliente.',
  'depoimento do cliente',
  'muito bom!',
  'ótimo produto!',
  'adorei!',
  'produto incrível!',
  'super recomendo!',
  'melhor compra que fiz!',
];

function validateBlock(block: BlockNode): ValidationResult {
  const title = block.props.title as string | undefined;
  
  // Check for noise titles
  if (isNoiseTitle(title)) {
    return { valid: false, reason: `Título de ruído: "${title}"` };
  }
  
  // Validate TextBanners - title must have real content
  if (block.type === 'TextBanners') {
    if (!title || title.length < 3) {
      return { valid: false, reason: 'TextBanners sem título válido' };
    }
  }
  
  // Validate Testimonials - check for generic content
  if (block.type === 'Testimonials') {
    const items = block.props.items as Array<{ name: string; text: string }> | undefined;
    if (!items || items.length === 0) {
      return { valid: false, reason: 'Testimonials sem items' };
    }
    
    // Check for generic names
    const hasGenericNames = items.some(item => {
      const name = (item.name || '').toLowerCase().trim();
      const text = (item.text || '').toLowerCase().trim();
      
      // Check name patterns
      const isGenericName = GENERIC_TESTIMONIAL_PATTERNS.some(p => p.test(name)) ||
                           name === 'cliente' ||
                           name === 'customer' ||
                           name.length < 2;
      
      // Check text patterns
      const isGenericText = GENERIC_TESTIMONIAL_TEXTS.includes(text) ||
                           text.length < 10;
      
      return isGenericName || isGenericText;
    });
    
    if (hasGenericNames) {
      return { valid: false, reason: 'Testimonials com conteúdo genérico' };
    }
  }
  
  // Validate RichText - check for interface noise
  if (block.type === 'RichText') {
    const content = block.props.content as string | undefined;
    if (!content || content.length < 20) {
      return { valid: false, reason: 'RichText vazio ou muito curto' };
    }
    
    // Check for noise patterns in content
    const lowerContent = content.toLowerCase();
    const hasNoise = NOISE_TITLE_PATTERNS.some(pattern => 
      pattern.test(lowerContent)
    );
    
    if (hasNoise) {
      return { valid: false, reason: 'RichText com ruído de interface' };
    }
    
    // Check for CSS/HTML noise
    if (lowerContent.includes('{') && lowerContent.includes('}') && lowerContent.includes(':')) {
      const cssLikeRatio = (lowerContent.match(/[{};:]/g) || []).length / lowerContent.length;
      if (cssLikeRatio > 0.05) {
        return { valid: false, reason: 'RichText parece conter CSS/código' };
      }
    }
  }
  
  // Validate InfoHighlights
  if (block.type === 'InfoHighlights') {
    const items = block.props.items as Array<{ title: string }> | undefined;
    if (!items || items.length === 0) {
      return { valid: false, reason: 'InfoHighlights sem items' };
    }
    // Check for minimum content
    const hasValidItems = items.some(item => item.title && item.title.length > 2);
    if (!hasValidItems) {
      return { valid: false, reason: 'InfoHighlights com items vazios' };
    }
  }
  
  // Validate FAQ
  if (block.type === 'FAQ') {
    const items = block.props.items as Array<{ question: string }> | undefined;
    if (!items || items.length === 0) {
      return { valid: false, reason: 'FAQ sem items' };
    }
    // Check for minimum content
    const hasValidItems = items.some(item => item.question && item.question.length > 5);
    if (!hasValidItems) {
      return { valid: false, reason: 'FAQ com perguntas vazias' };
    }
  }
  
  // Validate VideoCarousel
  if (block.type === 'VideoCarousel') {
    const videos = block.props.videos as Array<{ url?: string }> | undefined;
    if (!videos || videos.length === 0) {
      return { valid: false, reason: 'VideoCarousel sem vídeos' };
    }
  }
  
  // Validate ImageCarousel
  if (block.type === 'ImageCarousel') {
    const images = block.props.images as Array<{ imageDesktop?: string }> | undefined;
    if (!images || images.length === 0) {
      return { valid: false, reason: 'ImageCarousel sem imagens' };
    }
  }
  
  return { valid: true };
}

// =====================================================
// CATEGORIZE BLOCKS
// =====================================================
function categorizeBlocks(blocks: BlockNode[]): PageComposition {
  const composition: PageComposition = {
    hero: [],
    imageCarousel: [],
    video: [],
    benefits: [],
    stats: [],
    content: [],
    steps: [],
    gallery: [],
    testimonials: [],
    faq: [],
    logos: [],
    countdown: [],
    generic: [],
  };
  
  for (const block of blocks) {
    // First validate the block
    const validation = validateBlock(block);
    if (!validation.valid) {
      console.log(`[composer] Rejecting block ${block.type}: ${validation.reason}`);
      continue;
    }
    
    const type = block.type;
    
    // Hero/Banner
    if (type === 'Hero' || type === 'HeroBanner') {
      composition.hero.push(block);
    }
    // Image Carousel
    else if (type === 'ImageCarousel') {
      composition.imageCarousel.push(block);
    }
    // Video
    else if (type === 'YouTubeVideo' || type === 'VideoUpload' || type === 'VideoCarousel') {
      composition.video.push(block);
    }
    // Benefits/Features
    else if (type === 'InfoHighlights' || type === 'FeatureList') {
      composition.benefits.push(block);
    }
    // Stats
    else if (type === 'StatsNumbers') {
      composition.stats.push(block);
    }
    // Content
    else if (type === 'ContentColumns' || type === 'TextBanners') {
      composition.content.push(block);
    }
    // Steps
    else if (type === 'StepsTimeline') {
      composition.steps.push(block);
    }
    // Gallery
    else if (type === 'ImageGallery' || type === 'Image') {
      composition.gallery.push(block);
    }
    // Testimonials
    else if (type === 'Testimonials') {
      composition.testimonials.push(block);
    }
    // FAQ
    else if (type === 'FAQ' || type === 'AccordionBlock') {
      composition.faq.push(block);
    }
    // Logos
    else if (type === 'LogosCarousel') {
      composition.logos.push(block);
    }
    // Countdown
    else if (type === 'CountdownTimer') {
      composition.countdown.push(block);
    }
    // Generic/Fallback
    else {
      composition.generic.push(block);
    }
  }
  
  return composition;
}

// =====================================================
// MERGE TESTIMONIALS
// =====================================================
function mergeTestimonials(blocks: BlockNode[]): BlockNode[] {
  if (blocks.length <= 1) return blocks;
  
  const allItems: any[] = [];
  let mergedTitle = '';
  
  for (const block of blocks) {
    if (block.props.items && Array.isArray(block.props.items)) {
      // Only add non-generic items
      const validItems = (block.props.items as any[]).filter(item => 
        !/^cliente\s*\d*$/i.test(item.name) &&
        item.name !== 'Cliente' &&
        item.text !== 'Excelente produto!' &&
        item.text !== 'Depoimento do cliente.'
      );
      allItems.push(...validItems);
    }
    if (!mergedTitle && block.props.title) {
      mergedTitle = block.props.title as string;
    }
  }
  
  if (allItems.length === 0) {
    return [];
  }
  
  return [{
    id: blocks[0].id,
    type: 'Testimonials',
    props: {
      ...blocks[0].props,
      title: mergedTitle || 'Depoimentos',
      items: allItems.slice(0, 12),
    },
  }];
}

// =====================================================
// MERGE FAQ
// =====================================================
function mergeFAQ(blocks: BlockNode[]): BlockNode[] {
  if (blocks.length <= 1) return blocks;
  
  const allItems: any[] = [];
  let mergedTitle = '';
  
  for (const block of blocks) {
    if (block.props.items && Array.isArray(block.props.items)) {
      allItems.push(...block.props.items);
    }
    if (!mergedTitle && block.props.title) {
      mergedTitle = block.props.title as string;
    }
  }
  
  return [{
    id: blocks[0].id,
    type: 'FAQ',
    props: {
      ...blocks[0].props,
      title: mergedTitle || 'Perguntas Frequentes',
      items: allItems.slice(0, 20),
    },
  }];
}

// =====================================================
// MERGE VIDEO CAROUSELS
// =====================================================
function mergeVideoCarousels(blocks: BlockNode[]): BlockNode[] {
  if (blocks.length <= 1) return blocks;
  
  const allVideos: any[] = [];
  
  for (const block of blocks) {
    if (block.type === 'VideoCarousel' && Array.isArray(block.props.videos)) {
      allVideos.push(...block.props.videos);
    } else if (block.type === 'YouTubeVideo' && block.props.youtubeUrl) {
      allVideos.push({
        id: block.id,
        type: 'youtube',
        url: block.props.youtubeUrl,
        title: 'Vídeo',
      });
    }
  }
  
  // Deduplicate by URL
  const uniqueVideos = allVideos.filter((video, index, self) => 
    index === self.findIndex(v => v.url === video.url)
  );
  
  if (uniqueVideos.length === 0) {
    return [];
  }
  
  if (uniqueVideos.length === 1) {
    return [{
      id: blocks[0].id,
      type: 'YouTubeVideo',
      props: {
        youtubeUrl: uniqueVideos[0].url,
        widthPreset: 'xl',
        aspectRatio: '16:9',
        autoplay: false,
      },
    }];
  }
  
  return [{
    id: blocks[0].id,
    type: 'VideoCarousel',
    props: {
      videos: uniqueVideos.slice(0, 10),
      autoplay: false,
      interval: 5000,
      showNavigation: true,
      showPagination: true,
      aspectRatio: '16:9',
    },
  }];
}

// =====================================================
// APPLY DEDUPLICATION RULES
// =====================================================
function deduplicateBlocks(composition: PageComposition): PageComposition {
  const deduplicated = { ...composition };
  
  // Special handling for videos - merge into carousel
  if (deduplicated.video.length > 1) {
    deduplicated.video = mergeVideoCarousels(deduplicated.video);
  }
  
  // Apply dedup rules to each category
  for (const [blockType, rule] of Object.entries(DEDUP_RULES)) {
    for (const category of Object.keys(composition) as (keyof PageComposition)[]) {
      const blocks = deduplicated[category];
      const matchingBlocks = blocks.filter(b => b.type === blockType);
      
      if (matchingBlocks.length > rule.maxCount) {
        if (rule.keepStrategy === 'merge') {
          if (blockType === 'Testimonials') {
            deduplicated[category] = [
              ...blocks.filter(b => b.type !== blockType),
              ...mergeTestimonials(matchingBlocks),
            ];
          } else if (blockType === 'FAQ' || blockType === 'AccordionBlock') {
            deduplicated[category] = [
              ...blocks.filter(b => b.type !== blockType),
              ...mergeFAQ(matchingBlocks),
            ];
          } else if (blockType === 'VideoCarousel') {
            deduplicated[category] = [
              ...blocks.filter(b => b.type !== blockType),
              ...mergeVideoCarousels(matchingBlocks),
            ];
          }
        } else if (rule.keepStrategy === 'first') {
          deduplicated[category] = [
            ...blocks.filter(b => b.type !== blockType),
            matchingBlocks[0],
          ];
        } else if (rule.keepStrategy === 'last') {
          deduplicated[category] = [
            ...blocks.filter(b => b.type !== blockType),
            matchingBlocks[matchingBlocks.length - 1],
          ];
        }
      }
    }
  }
  
  return deduplicated;
}

// =====================================================
// BUILD ORDERED PAGE
// =====================================================
function buildOrderedPage(composition: PageComposition): BlockNode[] {
  const orderedBlocks: BlockNode[] = [];
  
  // 0: Hero (first)
  orderedBlocks.push(...composition.hero);
  
  // 1: Image Carousel (banner rotator)
  orderedBlocks.push(...composition.imageCarousel);
  
  // 2: Video (main video after hero)
  orderedBlocks.push(...composition.video);
  
  // 3: Benefits/Features
  orderedBlocks.push(...composition.benefits);
  
  // 4: Stats
  orderedBlocks.push(...composition.stats);
  
  // 5: Content columns
  orderedBlocks.push(...composition.content);
  
  // 6: Steps/Timeline
  orderedBlocks.push(...composition.steps);
  
  // 7: Gallery
  orderedBlocks.push(...composition.gallery);
  
  // 8: Testimonials
  orderedBlocks.push(...composition.testimonials);
  
  // 9: FAQ
  orderedBlocks.push(...composition.faq);
  
  // 10: Logos
  orderedBlocks.push(...composition.logos);
  
  // 99: Generic (before countdown)
  orderedBlocks.push(...composition.generic);
  
  // 11: Countdown (urgency, near the end)
  orderedBlocks.push(...composition.countdown);
  
  return orderedBlocks;
}

// =====================================================
// PAGE QUALITY VALIDATION
// =====================================================
export interface PageQuality {
  valid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

export function validatePageQuality(blocks: BlockNode[]): PageQuality {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // Count block types
  const typeCounts: Record<string, number> = {};
  for (const block of blocks) {
    typeCounts[block.type] = (typeCounts[block.type] || 0) + 1;
  }
  
  // Check for Hero/Banner
  const hasHero = typeCounts['Hero'] > 0 || typeCounts['HeroBanner'] > 0;
  if (!hasHero) {
    issues.push('Falta hero/banner inicial');
    score -= 15;
  }
  
  // Count specific blocks (non-generic)
  const genericTypes = ['RichText', 'Section', 'TextBanners'];
  const specificBlocks = blocks.filter(b => !genericTypes.includes(b.type));
  
  if (specificBlocks.length < 3) {
    issues.push(`Poucos blocos específicos (${specificBlocks.length})`);
    score -= 20;
    suggestions.push('Adicione mais seções como Benefits, Testimonials ou FAQ');
  }
  
  // Check for social proof
  const hasSocialProof = typeCounts['Testimonials'] > 0 || typeCounts['StatsNumbers'] > 0;
  if (!hasSocialProof) {
    suggestions.push('Considere adicionar depoimentos ou estatísticas');
    score -= 5;
  }
  
  // Check for CTA elements
  const hasCTA = typeCounts['CountdownTimer'] > 0 || blocks.some(b => 
    b.props.buttonText || b.props.buttonUrl
  );
  if (!hasCTA) {
    suggestions.push('Adicione um call-to-action ou botão de conversão');
    score -= 5;
  }
  
  // Penalize too many generic blocks
  const genericCount = blocks.filter(b => genericTypes.includes(b.type)).length;
  const genericRatio = blocks.length > 0 ? genericCount / blocks.length : 0;
  if (genericRatio > 0.5) {
    issues.push(`Muitos blocos genéricos (${Math.round(genericRatio * 100)}%)`);
    score -= 10;
  }
  
  // Check for videos (good for engagement)
  const hasVideo = typeCounts['YouTubeVideo'] > 0 || typeCounts['VideoCarousel'] > 0;
  if (hasVideo) {
    score += 5; // Bonus for video content
  }
  
  // Check for image carousel (good for visual impact)
  const hasCarousel = typeCounts['ImageCarousel'] > 0;
  if (hasCarousel) {
    score += 5; // Bonus for carousel
  }
  
  return {
    valid: score >= 50,
    score: Math.max(0, Math.min(100, score)),
    issues,
    suggestions,
  };
}

// =====================================================
// MAIN COMPOSER FUNCTION
// =====================================================
export function composePageStructure(blocks: BlockNode[]): BlockNode[] {
  console.log(`[composer] Composing page with ${blocks.length} blocks`);
  
  if (blocks.length === 0) {
    return [];
  }
  
  // 1. Categorize blocks by type (includes validation)
  const composition = categorizeBlocks(blocks);
  console.log(`[composer] Categorized: hero=${composition.hero.length}, video=${composition.video.length}, benefits=${composition.benefits.length}, content=${composition.content.length}, testimonials=${composition.testimonials.length}, faq=${composition.faq.length}, generic=${composition.generic.length}`);
  
  // 2. Apply deduplication rules
  const deduplicated = deduplicateBlocks(composition);
  
  // 3. Build ordered page
  const orderedBlocks = buildOrderedPage(deduplicated);
  console.log(`[composer] Ordered page with ${orderedBlocks.length} blocks`);
  
  // 4. Validate quality
  const quality = validatePageQuality(orderedBlocks);
  console.log(`[composer] Quality: score=${quality.score}, valid=${quality.valid}`);
  if (quality.issues.length > 0) {
    console.log(`[composer] Issues: ${quality.issues.join(', ')}`);
  }
  
  return orderedBlocks;
}

// =====================================================
// EXPORT TYPES
// =====================================================
export type { BlockNode };
