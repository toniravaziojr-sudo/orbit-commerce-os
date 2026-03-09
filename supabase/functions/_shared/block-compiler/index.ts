// =============================================
// BLOCK COMPILER — Registry & Tree Walker
// =============================================
// This is the core of the Block-to-HTML Compiler.
// It walks the BlockNode tree (same schema used by the builder)
// and calls the appropriate compiler function for each block type.
//
// MIGRATION PATH:
// - Blocks with a compiler: rendered via toStaticHTML (parity with builder)
// - Blocks WITHOUT a compiler: fallback to empty string (unsupported placeholder)
// - Over time, add compilers for all block types
//
// ADDING A NEW BLOCK COMPILER:
// 1. Create file: supabase/functions/_shared/block-compiler/blocks/{block-name}.ts
// 2. Export function: {blockName}ToStaticHTML(props, context, children?) => string
// 3. Register it in COMPILER_REGISTRY below
// 4. The function should mirror the React component's visual output
// =============================================

import type { BlockNode, CompilerContext, BlockCompilerFn } from './types.ts';

// Import block compilers
import { pageToStaticHTML } from './blocks/page.ts';
import { sectionToStaticHTML } from './blocks/section.ts';
import { heroBannerToStaticHTML } from './blocks/hero-banner.ts';
import { bannerToStaticHTML } from './blocks/banner.ts';
import { featuredCategoriesToStaticHTML } from './blocks/featured-categories.ts';
import { featuredProductsToStaticHTML } from './blocks/featured-products.ts';
import { imageCarouselToStaticHTML } from './blocks/image-carousel.ts';
import { infoHighlightsToStaticHTML } from './blocks/info-highlights.ts';
import { categoryBannerToStaticHTML } from './blocks/category-banner.ts';
import { categoryPageLayoutToStaticHTML } from './blocks/category-page-layout.ts';
import { productDetailsToStaticHTML } from './blocks/product-details.ts';

// Interactive blocks
import { faqToStaticHTML } from './blocks/faq.ts';
import { testimonialsToStaticHTML } from './blocks/testimonials.ts';
import { accordionToStaticHTML } from './blocks/accordion.ts';
import { newsletterToStaticHTML } from './blocks/newsletter.ts';

// Media blocks
import { youtubeVideoToStaticHTML } from './blocks/youtube-video.ts';
import { videoCarouselToStaticHTML } from './blocks/video-carousel.ts';
import { htmlSectionToStaticHTML } from './blocks/html-section.ts';
import { imageGalleryToStaticHTML } from './blocks/image-gallery.ts';

// E-commerce advanced blocks
import { productGridToStaticHTML } from './blocks/product-grid.ts';
import { productCarouselToStaticHTML } from './blocks/product-carousel.ts';
import { categoryListToStaticHTML } from './blocks/category-list.ts';
import { collectionSectionToStaticHTML } from './blocks/collection-section.ts';
import { bannerProductsToStaticHTML } from './blocks/banner-products.ts';

// Marketing blocks
import { countdownTimerToStaticHTML } from './blocks/countdown-timer.ts';
import { logosCarouselToStaticHTML } from './blocks/logos-carousel.ts';
import { statsNumbersToStaticHTML } from './blocks/stats-numbers.ts';
import { contentColumnsToStaticHTML } from './blocks/content-columns.ts';
import { featureListToStaticHTML } from './blocks/feature-list.ts';
import { stepsTimelineToStaticHTML } from './blocks/steps-timeline.ts';
import { textBannersToStaticHTML } from './blocks/text-banners.ts';

// Layout blocks
import { containerToStaticHTML } from './blocks/container.ts';
import { columnsToStaticHTML } from './blocks/columns.ts';
import { columnToStaticHTML } from './blocks/column.ts';
import { gridToStaticHTML } from './blocks/grid.ts';

// Content blocks
import { textToStaticHTML } from './blocks/text.ts';
import { richTextToStaticHTML } from './blocks/rich-text.ts';
import { imageToStaticHTML } from './blocks/image.ts';
import { buttonToStaticHTML } from './blocks/button.ts';
import { spacerToStaticHTML } from './blocks/spacer.ts';
import { dividerToStaticHTML } from './blocks/divider.ts';

/**
 * Registry mapping block type → compiler function.
 * This is the SINGLE place to register block compilers.
 * 
 * Each entry corresponds to a React component in src/components/builder/blocks/
 * and produces equivalent static HTML.
 */
const COMPILER_REGISTRY: Record<string, BlockCompilerFn> = {
  // Layout blocks
  'Page': pageToStaticHTML,
  'Section': sectionToStaticHTML,
  'Container': containerToStaticHTML,
  'Columns': columnsToStaticHTML,
  'Column': columnToStaticHTML,
  'Grid': gridToStaticHTML,
  
  // Content blocks — Basic
  'Text': textToStaticHTML,
  'RichText': richTextToStaticHTML,
  'Image': imageToStaticHTML,
  'Button': buttonToStaticHTML,
  'Spacer': spacerToStaticHTML,
  'Divider': dividerToStaticHTML,
  
  // Content blocks — Complex
  'HeroBanner': heroBannerToStaticHTML,
  'Banner': bannerToStaticHTML,
  'ImageCarousel': imageCarouselToStaticHTML,
  'InfoHighlights': infoHighlightsToStaticHTML,
  
  // E-commerce blocks — Home
  'FeaturedCategories': featuredCategoriesToStaticHTML,
  'FeaturedProducts': featuredProductsToStaticHTML,
  
  // E-commerce blocks — Category page
  'CategoryBanner': categoryBannerToStaticHTML,
  'CategoryPageLayout': categoryPageLayoutToStaticHTML,
  
  // E-commerce blocks — Product page
  'ProductDetails': productDetailsToStaticHTML,
  
  // E-commerce blocks — Advanced
  'ProductGrid': productGridToStaticHTML,
  'ProductCarousel': productCarouselToStaticHTML,
  'CategoryList': categoryListToStaticHTML,
  'CollectionSection': collectionSectionToStaticHTML,
  'BannerProducts': bannerProductsToStaticHTML,
  
  // Interactive blocks
  'FAQ': faqToStaticHTML,
  'Testimonials': testimonialsToStaticHTML,
  'AccordionBlock': accordionToStaticHTML,
  'Newsletter': newsletterToStaticHTML,
  'NewsletterForm': newsletterToStaticHTML, // Same visual output
  
  // Media blocks
  'YouTubeVideo': youtubeVideoToStaticHTML,
  'VideoCarousel': videoCarouselToStaticHTML,
  'HTMLSection': htmlSectionToStaticHTML,
  'ImageGallery': imageGalleryToStaticHTML,
  
  // Marketing blocks
  'CountdownTimer': countdownTimerToStaticHTML,
  'LogosCarousel': logosCarouselToStaticHTML,
  'StatsNumbers': statsNumbersToStaticHTML,
  'ContentColumns': contentColumnsToStaticHTML,
  'FeatureList': featureListToStaticHTML,
  'StepsTimeline': stepsTimelineToStaticHTML,
  'TextBanners': textBannersToStaticHTML,
};

/**
 * List of block types that are handled by Header/Footer renderers 
 * (not part of content tree compilation).
 * These are skipped during tree walking.
 */
const STRUCTURAL_BLOCKS = new Set(['Header', 'Footer']);

/**
 * Blocks that currently have no compiler.
 * Listed explicitly for tracking migration progress.
 */
export const UNSUPPORTED_BLOCKS = new Set([
  'Reviews', 'VideoUpload',
  'TrackingLookup', 'BlogListing', 'BlogPostDetail', 'PageContent',
  'ContactForm',
  'CategoryFilters',
  'CartDemo', 'CheckoutDemo', 'CustomBlock',
  'NewsletterPopup', 'Map', 'SocialFeed',
  'PersonalizedProducts', 'LivePurchases', 'PricingTable',
  'PopupModal', 'QuizEmbed', 'EmbedSocialPost',
]);

/**
 * Compile a single BlockNode to static HTML.
 * Recursively compiles children first, then passes to the block's compiler.
 */
function compileNode(node: BlockNode, context: CompilerContext): string {
  // Skip hidden blocks
  if (node.hidden) return '';
  
  // Skip structural blocks (handled separately)
  if (STRUCTURAL_BLOCKS.has(node.type)) return '';
  
  // Recursively compile children
  let childrenHtml = '';
  if (node.children && node.children.length > 0) {
    childrenHtml = node.children.map(child => compileNode(child, context)).join('');
  }
  
  // Look up compiler
  const compiler = COMPILER_REGISTRY[node.type];
  if (compiler) {
    return compiler(node.props, context, childrenHtml);
  }
  
  // No compiler: return children directly (pass-through for layout wrappers)
  // This ensures unsupported wrapper blocks don't swallow their children
  if (childrenHtml) return childrenHtml;
  
  // Leaf block with no compiler: log and skip
  console.warn(`[block-compiler] No compiler for block type: ${node.type} (id: ${node.id})`);
  return '';
}

/**
 * Extract all product IDs needed by blocks in the tree.
 * Used to pre-fetch product data before compilation.
 */
export function extractProductIds(node: BlockNode): string[] {
  const ids: string[] = [];
  if (node.type === 'FeaturedProducts' && Array.isArray(node.props.productIds)) {
    ids.push(...(node.props.productIds as string[]));
  }
  if (node.children) {
    for (const child of node.children) {
      ids.push(...extractProductIds(child));
    }
  }
  return [...new Set(ids)];
}

/**
 * Extract all category IDs needed by blocks in the tree.
 * Used to pre-fetch category data before compilation.
 */
export function extractCategoryIds(node: BlockNode): string[] {
  const ids: string[] = [];
  if (node.type === 'FeaturedCategories' && Array.isArray(node.props.items)) {
    ids.push(...(node.props.items as any[]).map(i => i.categoryId).filter(Boolean));
  }
  if (node.children) {
    for (const child of node.children) {
      ids.push(...extractCategoryIds(child));
    }
  }
  return [...new Set(ids)];
}

/**
 * Compile a full BlockNode tree into static HTML.
 * This is the main entry point for the block compiler.
 * 
 * @param root - The root BlockNode (typically type: 'Page')
 * @param context - Data context with pre-fetched products, categories, etc.
 * @returns Static HTML string
 */
export function compileBlockTree(root: BlockNode, context: CompilerContext): string {
  return compileNode(root, context);
}

/**
 * Check if a block type has a compiler registered.
 */
export function hasCompiler(blockType: string): boolean {
  return blockType in COMPILER_REGISTRY || STRUCTURAL_BLOCKS.has(blockType);
}

/**
 * Get list of all supported block types.
 */
export function getSupportedBlockTypes(): string[] {
  return [...Object.keys(COMPILER_REGISTRY), ...STRUCTURAL_BLOCKS];
}

// Re-export types
export type { BlockNode, CompilerContext, BlockCompilerFn } from './types.ts';
