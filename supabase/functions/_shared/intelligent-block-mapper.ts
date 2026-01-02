// =====================================================
// INTELLIGENT BLOCK MAPPER - NATIVE BLOCKS
// =====================================================
// 
// Creates NATIVE Builder blocks from AI classification results.
// Uses existing blocks from registry: Hero, InfoHighlights, 
// Testimonials, FAQ, YouTubeVideo, Image.
//
// NO MORE generic Section + RichText + emojis!
// =====================================================

export interface ExtractedContent {
  title: string | null;
  subtitle: string | null;
  items: Array<{
    title: string;
    description: string;
    suggestedIcon: 'check' | 'shield' | 'zap' | 'star' | 'heart' | 'award' | 'truck' | 'clock' | 'gift' | 'percent' | null;
  }>;
  images: Array<{ src: string; alt: string }>;
  videos: Array<{ url: string; type: 'youtube' | 'vimeo' | 'mp4' }>;
  buttons: Array<{ text: string; url: string }>;
  paragraphs: string[];
}

export interface ClassificationResult {
  sectionType: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta' | 'about' | 'contact' | 'steps' | 'stats' | 'gallery' | 'countdown' | 'logos' | 'generic';
  layout: 'columns-image-left' | 'columns-image-right' | 'grid-2' | 'grid-3' | 'grid-4' | 'stacked' | 'hero-centered' | 'hero-split' | 'timeline-horizontal' | 'timeline-vertical';
  confidence: number;
  reasoning: string;
  extractedContent: ExtractedContent;
}

export interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BlockNode[];
}

// Generate unique block ID
function generateBlockId(prefix: string = 'block'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
}

// =====================================================
// ICON MAP: AI suggestions -> Lucide icon names
// =====================================================
const ICON_MAP: Record<string, string> = {
  check: 'CheckCircle',
  shield: 'Shield',
  zap: 'Zap',
  star: 'Star',
  heart: 'Heart',
  award: 'Award',
  truck: 'Truck',
  clock: 'Clock',
  gift: 'Gift',
  percent: 'Percent',
  // Fallbacks
  default: 'CheckCircle',
};

// =====================================================
// HERO BLOCK CREATOR - Uses native Hero block
// =====================================================
export function createHeroBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, images, videos, buttons } = extractedContent;
  
  const blocks: BlockNode[] = [];
  
  // Main Hero block
  blocks.push({
    id: generateBlockId('hero'),
    type: 'Hero',
    props: {
      title: title || 'Título Principal',
      subtitle: subtitle || '',
      imageDesktop: images[0]?.src || '',
      imageMobile: images[0]?.src || '',
      buttonText: buttons[0]?.text || '',
      buttonUrl: buttons[0]?.url || '#',
      backgroundColor: '#1e293b',
      textColor: '#ffffff',
      alignment: 'center',
      height: 'md',
      overlayOpacity: images[0]?.src ? 0.5 : 0,
    },
  });
  
  // If there's a video, add YouTubeVideo block after hero
  if (videos.length > 0) {
    blocks.push({
      id: generateBlockId('hero-video'),
      type: 'YouTubeVideo',
      props: {
        youtubeUrl: videos[0].url,
        widthPreset: 'xl',
        aspectRatio: '16:9',
        autoplay: false,
      },
    });
  }
  
  return blocks;
}

// =====================================================
// BENEFITS/FEATURES BLOCK - Uses InfoHighlights or FeatureList
// =====================================================
export function createBenefitsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, items } = extractedContent;
  
  const blocks: BlockNode[] = [];
  
  // Add title as TextBanners if exists
  if (title) {
    blocks.push({
      id: generateBlockId('benefits-title'),
      type: 'TextBanners',
      props: {
        title: title,
        subtitle: '',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  // Decide: FeatureList (vertical, 5+ items) vs InfoHighlights (horizontal grid, ≤4 items)
  if (items.length > 4) {
    // Use FeatureList for longer lists
    const featureItems = items.map((item, index) => ({
      id: generateBlockId(`feature-${index}`),
      icon: ICON_MAP[item.suggestedIcon || 'check'] || ICON_MAP.default,
      text: item.title + (item.description ? `: ${item.description}` : ''),
    }));
    
    blocks.push({
      id: generateBlockId('feature-list'),
      type: 'FeatureList',
      props: {
        title: '',
        items: featureItems,
        iconColor: '#22c55e',
        showButton: false,
      },
    });
  } else {
    // Use InfoHighlights for shorter lists (grid layout)
    const highlightItems = items.slice(0, 6).map((item, index) => ({
      id: generateBlockId(`highlight-${index}`),
      icon: ICON_MAP[item.suggestedIcon || 'check'] || ICON_MAP.default,
      title: item.title,
      description: item.description || '',
    }));
    
    // If no items, create default ones
    if (highlightItems.length === 0) {
      highlightItems.push(
        { id: generateBlockId('highlight-0'), icon: 'CheckCircle', title: 'Benefício 1', description: '' },
        { id: generateBlockId('highlight-1'), icon: 'Shield', title: 'Benefício 2', description: '' },
        { id: generateBlockId('highlight-2'), icon: 'Zap', title: 'Benefício 3', description: '' },
      );
    }
    
    blocks.push({
      id: generateBlockId('info-highlights'),
      type: 'InfoHighlights',
      props: {
        items: highlightItems,
        layout: 'horizontal',
        iconColor: '#6366f1',
        textColor: '#1f2937',
      },
    });
  }
  
  return blocks;
}

// =====================================================
// CONTENT COLUMNS BLOCK - Image + Text side by side
// =====================================================
export function createContentColumnsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, subtitle, paragraphs, images, items, buttons } = extractedContent;
  
  // Determine image position from layout hint
  const imagePosition = layout === 'columns-image-right' ? 'right' : 'left';
  
  // Build features list from items
  const features = items.slice(0, 6).map((item, index) => ({
    id: generateBlockId(`content-feature-${index}`),
    icon: ICON_MAP[item.suggestedIcon || 'check'] || 'Check',
    text: item.title,
  }));
  
  // Combine paragraphs into content HTML
  const content = paragraphs.length > 0
    ? paragraphs.slice(0, 3).map(p => `<p>${p}</p>`).join('')
    : '';
  
  return [{
    id: generateBlockId('content-columns'),
    type: 'ContentColumns',
    props: {
      title: title || '',
      subtitle: subtitle || '',
      content: content,
      imageDesktop: images[0]?.src || '',
      imageMobile: images[0]?.src || '',
      imagePosition: imagePosition,
      features: features,
      iconColor: '#22c55e',
      showButton: buttons.length > 0,
      buttonText: buttons[0]?.text || 'Saiba mais',
      buttonUrl: buttons[0]?.url || '#',
      backgroundColor: 'transparent',
    },
  }];
}

// =====================================================
// TESTIMONIALS BLOCK - Uses native Testimonials
// =====================================================
export function createTestimonialsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items } = extractedContent;
  
  // Map items to Testimonials format
  const testimonialItems = items.slice(0, 6).map(item => ({
    name: item.title || 'Cliente',
    text: item.description || 'Depoimento do cliente.',
    rating: 5,
    avatar: '',
  }));
  
  // If no items, create default ones
  if (testimonialItems.length === 0) {
    testimonialItems.push(
      { name: 'Cliente 1', text: 'Excelente produto!', rating: 5, avatar: '' },
      { name: 'Cliente 2', text: 'Recomendo a todos.', rating: 5, avatar: '' },
    );
  }
  
  return [{
    id: generateBlockId('testimonials'),
    type: 'Testimonials',
    props: {
      title: title || 'O que dizem nossos clientes',
      items: testimonialItems,
      layout: 'grid',
      showRating: true,
    },
  }];
}

// =====================================================
// FAQ BLOCK - Uses native FAQ
// =====================================================
export function createFAQBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items } = extractedContent;
  
  // Map items to FAQ format
  const faqItems = items.slice(0, 10).map(item => ({
    question: item.title,
    answer: item.description || 'Resposta em breve.',
  }));
  
  // If no items, create default ones
  if (faqItems.length === 0) {
    faqItems.push(
      { question: 'Pergunta 1?', answer: 'Resposta 1.' },
      { question: 'Pergunta 2?', answer: 'Resposta 2.' },
    );
  }
  
  return [{
    id: generateBlockId('faq'),
    type: 'FAQ',
    props: {
      title: title || 'Perguntas Frequentes',
      items: faqItems,
    },
  }];
}

// =====================================================
// CTA BLOCK - Uses native Hero as CTA variant
// =====================================================
export function createCTABlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, buttons } = extractedContent;
  
  return [{
    id: generateBlockId('cta'),
    type: 'Hero',
    props: {
      title: title || 'Pronto para começar?',
      subtitle: subtitle || 'Aproveite agora mesmo!',
      buttonText: buttons[0]?.text || 'Comprar Agora',
      buttonUrl: buttons[0]?.url || '#',
      backgroundColor: '#6366f1',
      textColor: '#ffffff',
      alignment: 'center',
      height: 'sm',
      imageDesktop: '',
      imageMobile: '',
    },
  }];
}

// =====================================================
// IMAGE BLOCK - Uses native Image
// =====================================================
export function createImageBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { images } = extractedContent;
  
  if (images.length === 0) return [];
  
  return [{
    id: generateBlockId('image'),
    type: 'Image',
    props: {
      imageDesktop: images[0].src,
      imageMobile: images[0].src,
      alt: images[0].alt || 'Imagem',
      aspectRatio: '16:9',
      borderRadius: 8,
    },
  }];
}

// =====================================================
// VIDEO BLOCK - Uses native YouTubeVideo
// =====================================================
export function createVideoBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { videos } = extractedContent;
  
  if (videos.length === 0) return [];
  
  return [{
    id: generateBlockId('video'),
    type: 'YouTubeVideo',
    props: {
      youtubeUrl: videos[0].url,
      widthPreset: 'xl',
      aspectRatio: '16:9',
      autoplay: false,
    },
  }];
}

// =====================================================
// GENERIC/FALLBACK BLOCK - Section + RichText (minimal)
// =====================================================
export function createGenericBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, paragraphs, images, videos, buttons } = extractedContent;
  
  const blocks: BlockNode[] = [];
  
  // Add title if exists
  if (title) {
    blocks.push({
      id: generateBlockId('generic-title'),
      type: 'TextBanners',
      props: {
        title: title,
        subtitle: '',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  // Add video if exists (prioritize video over image)
  if (videos.length > 0) {
    blocks.push({
      id: generateBlockId('generic-video'),
      type: 'YouTubeVideo',
      props: {
        youtubeUrl: videos[0].url,
        widthPreset: 'xl',
        aspectRatio: '16:9',
      },
    });
  } else if (images.length > 0) {
    // Add image if no video
    blocks.push({
      id: generateBlockId('generic-image'),
      type: 'Image',
      props: {
        imageDesktop: images[0].src,
        imageMobile: images[0].src,
        alt: images[0].alt || 'Imagem',
        aspectRatio: '16:9',
      },
    });
  }
  
  // Add paragraphs as RichText (sanitized, no inline styles)
  if (paragraphs.length > 0) {
    const sanitizedContent = paragraphs
      .slice(0, 5)
      .map(p => `<p>${p}</p>`)
      .join('');
    
    blocks.push({
      id: generateBlockId('generic-content'),
      type: 'RichText',
      props: {
        content: sanitizedContent,
      },
    });
  }
  
  // Add CTA button if exists
  if (buttons.length > 0) {
    blocks.push({
      id: generateBlockId('generic-cta'),
      type: 'Hero',
      props: {
        title: '',
        subtitle: '',
        buttonText: buttons[0].text,
        buttonUrl: buttons[0].url || '#',
        backgroundColor: '#6366f1',
        textColor: '#ffffff',
        alignment: 'center',
        height: 'xs',
        imageDesktop: '',
        imageMobile: '',
      },
    });
  }
  
  return blocks;
}

// =====================================================
// STEPS/TIMELINE BLOCK - Uses StepsTimeline
// =====================================================
export function createStepsTimelineBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, subtitle, items } = extractedContent;
  
  const steps = items.map((item, index) => ({
    number: index + 1,
    title: item.title,
    description: item.description || '',
  }));
  
  // Default steps if none found
  if (steps.length === 0) {
    steps.push(
      { number: 1, title: 'Passo 1', description: 'Descrição do primeiro passo' },
      { number: 2, title: 'Passo 2', description: 'Descrição do segundo passo' },
      { number: 3, title: 'Passo 3', description: 'Descrição do terceiro passo' },
    );
  }
  
  return [{
    id: generateBlockId('steps-timeline'),
    type: 'StepsTimeline',
    props: {
      title: title || 'Como Funciona',
      subtitle: subtitle || '',
      steps,
      layout: layout === 'timeline-vertical' ? 'vertical' : 'horizontal',
      accentColor: '#6366f1',
      showNumbers: true,
      backgroundColor: 'transparent',
    },
  }];
}

// =====================================================
// STATS/NUMBERS BLOCK - Uses StatsNumbers
// =====================================================
export function createStatsNumbersBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, items } = extractedContent;
  
  const stats = items.map(item => ({
    number: item.title, // The number is usually in the title
    label: item.description || '',
  }));
  
  // Default stats if none found
  if (stats.length === 0) {
    stats.push(
      { number: '10k+', label: 'Clientes' },
      { number: '99%', label: 'Satisfação' },
      { number: '24h', label: 'Suporte' },
    );
  }
  
  return [{
    id: generateBlockId('stats-numbers'),
    type: 'StatsNumbers',
    props: {
      title: title || '',
      subtitle: subtitle || '',
      items: stats,
      layout: 'horizontal',
      animateNumbers: true,
      backgroundColor: 'transparent',
      accentColor: '#6366f1',
    },
  }];
}

// =====================================================
// GALLERY BLOCK - Uses ImageGallery
// =====================================================
export function createImageGalleryBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, images } = extractedContent;
  
  const galleryImages = images.map(img => ({
    src: img.src,
    alt: img.alt || '',
    caption: '',
  }));
  
  return [{
    id: generateBlockId('image-gallery'),
    type: 'ImageGallery',
    props: {
      title: title || '',
      subtitle: subtitle || '',
      images: galleryImages,
      columns: images.length <= 4 ? images.length : 3,
      gap: 'md',
      enableLightbox: true,
      aspectRatio: 'square',
      borderRadius: 8,
      backgroundColor: 'transparent',
    },
  }];
}

// =====================================================
// COUNTDOWN BLOCK - Uses CountdownTimer
// =====================================================
export function createCountdownBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, buttons } = extractedContent;
  
  // Set a default end date 7 days from now
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  
  return [{
    id: generateBlockId('countdown-timer'),
    type: 'CountdownTimer',
    props: {
      title: title || 'Oferta por tempo limitado',
      subtitle: subtitle || '',
      endDate: futureDate.toISOString(),
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: true,
      backgroundColor: '#dc2626',
      textColor: '#ffffff',
      expiredMessage: 'Oferta encerrada',
      buttonText: buttons[0]?.text || '',
      buttonUrl: buttons[0]?.url || '#',
    },
  }];
}

// =====================================================
// LOGOS BLOCK - Uses LogosCarousel
// =====================================================
export function createLogosCarouselBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, images } = extractedContent;
  
  const logos = images.map(img => ({
    imageUrl: img.src,
    alt: img.alt || '',
    linkUrl: '',
  }));
  
  return [{
    id: generateBlockId('logos-carousel'),
    type: 'LogosCarousel',
    props: {
      title: title || 'Nossos Parceiros',
      subtitle: subtitle || '',
      logos,
      autoplay: true,
      grayscale: true,
      columns: Math.min(logos.length, 5),
      backgroundColor: 'transparent',
    },
  }];
}

// =====================================================
// MAIN MAPPER FUNCTION
// =====================================================
export function mapClassificationToBlocks(classification: ClassificationResult): BlockNode[] {
  const { sectionType, confidence, layout, extractedContent } = classification;
  
  console.log(`[mapper] Mapping section: ${sectionType} (confidence: ${confidence}, layout: ${layout})`);
  
  // Low confidence -> generic fallback
  if (confidence < 0.4) {
    console.log('[mapper] Low confidence, using generic block');
    return createGenericBlock(classification);
  }
  
  // Check if this looks like a columns layout (image + text)
  const hasImage = extractedContent.images.length > 0;
  const hasTextContent = extractedContent.paragraphs.length > 0 || extractedContent.items.length > 0;
  const isColumnsLayout = layout?.includes('columns-image');
  
  // Map by section type to NATIVE blocks
  switch (sectionType) {
    case 'hero':
      console.log('[mapper] Creating native Hero block');
      return createHeroBlock(classification);
      
    case 'benefits':
    case 'features':
      // If it looks like image+text layout, use ContentColumns
      if (isColumnsLayout && hasImage && hasTextContent) {
        console.log('[mapper] Creating ContentColumns for benefits with image');
        return createContentColumnsBlock(classification);
      }
      console.log('[mapper] Creating native Benefits block (InfoHighlights or FeatureList)');
      return createBenefitsBlock(classification);
      
    case 'testimonials':
      console.log('[mapper] Creating native Testimonials block');
      return createTestimonialsBlock(classification);
      
    case 'faq':
      console.log('[mapper] Creating native FAQ block');
      return createFAQBlock(classification);
      
    case 'cta':
      console.log('[mapper] Creating CTA (Hero variant) block');
      return createCTABlock(classification);
    
    // NEW SECTION TYPES
    case 'steps':
      console.log('[mapper] Creating StepsTimeline block');
      return createStepsTimelineBlock(classification);
      
    case 'stats':
      console.log('[mapper] Creating StatsNumbers block');
      return createStatsNumbersBlock(classification);
      
    case 'gallery':
      console.log('[mapper] Creating ImageGallery block');
      return createImageGalleryBlock(classification);
      
    case 'countdown':
      console.log('[mapper] Creating CountdownTimer block');
      return createCountdownBlock(classification);
      
    case 'logos':
      console.log('[mapper] Creating LogosCarousel block');
      return createLogosCarouselBlock(classification);
      
    case 'about':
      // About sections often have image + text layout
      if (hasImage && hasTextContent) {
        console.log('[mapper] Creating ContentColumns for about section');
        return createContentColumnsBlock(classification);
      }
      console.log('[mapper] Creating generic blocks for about');
      return createGenericBlock(classification);
      
    case 'contact':
    case 'generic':
    default:
      // Check for image+text pattern even in generic sections
      if (isColumnsLayout && hasImage && hasTextContent) {
        console.log('[mapper] Creating ContentColumns for generic section with image+text');
        return createContentColumnsBlock(classification);
      }
      console.log('[mapper] Creating generic blocks');
      return createGenericBlock(classification);
  }
}

// =====================================================
// HELPER: Combine multiple classifications into page
// =====================================================
export function buildPageFromClassifications(classifications: ClassificationResult[]): BlockNode[] {
  const allBlocks: BlockNode[] = [];
  
  for (const classification of classifications) {
    const blocks = mapClassificationToBlocks(classification);
    allBlocks.push(...blocks);
  }
  
  console.log(`[mapper] Built page with ${allBlocks.length} native blocks`);
  return allBlocks;
}
