// =====================================================
// PAGE COMPOSER - Intelligent Block Ordering System
// =====================================================
// 
// Receives classified blocks and reorganizes them into
// a logical, hierarchical page structure.
//
// Features:
// - Priority-based ordering (Hero first, CTA last)
// - Deduplication rules (max 1 Hero, 1 Countdown, etc.)
// - Merging similar blocks (multiple Testimonials → one)
// - Quality validation
// =====================================================

import type { BlockNode } from './intelligent-block-mapper.ts';

// =====================================================
// BLOCK ORDER PRIORITY (lower = higher in page)
// =====================================================
const BLOCK_ORDER_PRIORITY: Record<string, number> = {
  // Position 0: Hero/Banner (always first)
  'Hero': 0,
  'HeroBanner': 0,
  
  // Position 1: Video (main video after hero)
  'YouTubeVideo': 1,
  'VideoUpload': 1,
  'VideoCarousel': 1,
  
  // Position 2: Benefits/Features (present the product)
  'InfoHighlights': 2,
  'FeatureList': 2,
  
  // Position 3: Stats (social proof with numbers)
  'StatsNumbers': 3,
  
  // Position 4: Content columns (product details)
  'ContentColumns': 4,
  'TextBanners': 4,
  
  // Position 5: Steps/Timeline (how it works)
  'StepsTimeline': 5,
  
  // Position 6: Gallery/Images
  'ImageGallery': 6,
  'ImageCarousel': 6,
  'Image': 6,
  
  // Position 7: Testimonials (social proof)
  'Testimonials': 7,
  
  // Position 8: FAQ/Accordion
  'FAQ': 8,
  'AccordionBlock': 8,
  
  // Position 9: Logos (partners)
  'LogosCarousel': 9,
  
  // Position 10: Countdown (urgency)
  'CountdownTimer': 10,
  
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
// CATEGORIZE BLOCKS
// =====================================================
function categorizeBlocks(blocks: BlockNode[]): PageComposition {
  const composition: PageComposition = {
    hero: [],
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
    const type = block.type;
    
    // Hero/Banner
    if (type === 'Hero' || type === 'HeroBanner') {
      composition.hero.push(block);
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
    else if (type === 'ImageGallery' || type === 'ImageCarousel' || type === 'Image') {
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
  
  // Collect all testimonial items
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
  
  // Return single merged block
  return [{
    id: blocks[0].id,
    type: 'Testimonials',
    props: {
      ...blocks[0].props,
      title: mergedTitle || 'Depoimentos',
      items: allItems.slice(0, 12), // Max 12 testimonials
    },
  }];
}

// =====================================================
// MERGE FAQ
// =====================================================
function mergeFAQ(blocks: BlockNode[]): BlockNode[] {
  if (blocks.length <= 1) return blocks;
  
  // Collect all FAQ items
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
  
  // Return single merged block
  return [{
    id: blocks[0].id,
    type: 'FAQ',
    props: {
      ...blocks[0].props,
      title: mergedTitle || 'Perguntas Frequentes',
      items: allItems.slice(0, 20), // Max 20 FAQ items
    },
  }];
}

// =====================================================
// APPLY DEDUPLICATION RULES
// =====================================================
function deduplicateBlocks(composition: PageComposition): PageComposition {
  const deduplicated = { ...composition };
  
  // Apply dedup rules to each category
  for (const [blockType, rule] of Object.entries(DEDUP_RULES)) {
    // Find the category that contains this block type
    for (const category of Object.keys(composition) as (keyof PageComposition)[]) {
      const blocks = deduplicated[category];
      const matchingBlocks = blocks.filter(b => b.type === blockType);
      
      if (matchingBlocks.length > rule.maxCount) {
        if (rule.keepStrategy === 'merge') {
          // Merge blocks (for Testimonials, FAQ)
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
          }
        } else if (rule.keepStrategy === 'first') {
          // Keep first only
          deduplicated[category] = [
            ...blocks.filter(b => b.type !== blockType),
            matchingBlocks[0],
          ];
        } else if (rule.keepStrategy === 'last') {
          // Keep last only
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
  
  // Add blocks in priority order
  // 0: Hero (first)
  orderedBlocks.push(...composition.hero);
  
  // 1: Video (main video after hero)
  orderedBlocks.push(...composition.video);
  
  // 2: Benefits/Features
  orderedBlocks.push(...composition.benefits);
  
  // 3: Stats
  orderedBlocks.push(...composition.stats);
  
  // 4: Content columns
  orderedBlocks.push(...composition.content);
  
  // 5: Steps/Timeline
  orderedBlocks.push(...composition.steps);
  
  // 6: Gallery
  orderedBlocks.push(...composition.gallery);
  
  // 7: Testimonials
  orderedBlocks.push(...composition.testimonials);
  
  // 8: FAQ
  orderedBlocks.push(...composition.faq);
  
  // 9: Logos
  orderedBlocks.push(...composition.logos);
  
  // 99: Generic (before countdown)
  orderedBlocks.push(...composition.generic);
  
  // 10: Countdown (urgency, near the end)
  orderedBlocks.push(...composition.countdown);
  
  return orderedBlocks;
}

// =====================================================
// PAGE QUALITY VALIDATION
// =====================================================
export interface PageQuality {
  valid: boolean;
  score: number; // 0-100
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
  
  return {
    valid: score >= 50,
    score: Math.max(0, score),
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
  
  // 1. Categorize blocks by type
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
