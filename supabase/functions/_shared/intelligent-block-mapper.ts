// =====================================================
// INTELLIGENT BLOCK MAPPER v3 - NATIVE BLOCKS
// =====================================================
// 
// Creates NATIVE Builder blocks from AI classification results.
// 
// IMPROVEMENTS v3:
// - VideoCarousel for multiple videos
// - Before/After block support
// - Real testimonial names (no more "Cliente 1")
// - Ingredient cards
// - Category grids
// - Better noise filtering
// =====================================================

export interface ExtractedContent {
  title: string | null;
  subtitle: string | null;
  items: Array<{
    title: string;
    description: string;
    suggestedIcon: 'check' | 'shield' | 'zap' | 'star' | 'heart' | 'award' | 'truck' | 'clock' | 'gift' | 'percent' | null;
    imageUrl?: string;
    name?: string;
    avatar?: string;
  }>;
  images: Array<{ src: string; alt: string }>;
  videos: Array<{ url: string; type: 'youtube' | 'vimeo' | 'mp4' }>;
  buttons: Array<{ text: string; url: string }>;
  paragraphs: string[];
}

export interface ClassificationResult {
  sectionType: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta' | 'about' | 'contact' | 'steps' | 'stats' | 'gallery' | 'countdown' | 'logos' | 'before_after' | 'product_cards' | 'category_grid' | 'ingredients' | 'generic';
  layout: 'columns-image-left' | 'columns-image-right' | 'grid-2' | 'grid-3' | 'grid-4' | 'stacked' | 'hero-centered' | 'hero-split' | 'timeline-horizontal' | 'timeline-vertical' | 'carousel';
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
// NOISE DETECTION - Filter out interface garbage
// =====================================================
const NOISE_TITLES = [
  'More videos',
  'Mais vídeos',
  'Hide more videos',
  'Ocultar mais vídeos',
  'Watch later',
  'Assistir mais tarde',
  'Share',
  'Compartilhar',
  'Subscribe',
  'Inscrever-se',
  'Copy link',
  'Copiar link',
  "You're signed out",
  'Você não está conectado',
];

function isNoiseTitle(title: string | null): boolean {
  if (!title) return false;
  return NOISE_TITLES.some(noise => 
    title.toLowerCase().includes(noise.toLowerCase())
  );
}

function isNoiseParagraph(text: string): boolean {
  const lowerText = text.toLowerCase();
  return NOISE_TITLES.some(noise => 
    lowerText.includes(noise.toLowerCase())
  ) || lowerText.length < 10;
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
  default: 'CheckCircle',
};

// =====================================================
// HERO BLOCK CREATOR
// =====================================================
export function createHeroBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, images, videos, buttons } = extractedContent;
  
  // Filter out noise titles
  const cleanTitle = isNoiseTitle(title) ? null : title;
  
  const blocks: BlockNode[] = [];
  
  // Main Hero block
  blocks.push({
    id: generateBlockId('hero'),
    type: 'Hero',
    props: {
      title: cleanTitle || 'Título Principal',
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
  
  // If there are multiple videos, create VideoCarousel; otherwise single video
  if (videos.length > 1) {
    blocks.push({
      id: generateBlockId('hero-video-carousel'),
      type: 'VideoCarousel',
      props: {
        videos: videos.slice(0, 6).map((video, i) => ({
          id: `video-${i}`,
          type: video.type,
          url: video.url,
          title: `Vídeo ${i + 1}`,
        })),
        autoplay: false,
        interval: 5000,
        showNavigation: true,
        showPagination: true,
        aspectRatio: '16:9',
      },
    });
  } else if (videos.length === 1) {
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
// BENEFITS/FEATURES BLOCK
// =====================================================
export function createBenefitsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, items } = extractedContent;
  
  const blocks: BlockNode[] = [];
  
  // Filter out noise titles
  const cleanTitle = isNoiseTitle(title) ? null : title;
  
  // Add title as TextBanners if exists
  if (cleanTitle) {
    blocks.push({
      id: generateBlockId('benefits-title'),
      type: 'TextBanners',
      props: {
        title: cleanTitle,
        subtitle: '',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  // Filter out items with noise titles
  const cleanItems = items.filter(item => !isNoiseTitle(item.title));
  
  if (cleanItems.length === 0) {
    return blocks; // No valid items
  }
  
  // Decide: FeatureList (vertical, 5+ items) vs InfoHighlights (horizontal grid, ≤4 items)
  if (cleanItems.length > 4) {
    const featureItems = cleanItems.map((item, index) => ({
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
    const highlightItems = cleanItems.slice(0, 6).map((item, index) => ({
      id: generateBlockId(`highlight-${index}`),
      icon: ICON_MAP[item.suggestedIcon || 'check'] || ICON_MAP.default,
      title: item.title,
      description: item.description || '',
    }));
    
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
// CONTENT COLUMNS BLOCK
// =====================================================
export function createContentColumnsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, subtitle, paragraphs, images, items, buttons } = extractedContent;
  
  const imagePosition = layout === 'columns-image-right' ? 'right' : 'left';
  
  // Filter items with noise
  const cleanItems = items.filter(item => !isNoiseTitle(item.title));
  
  const features = cleanItems.slice(0, 6).map((item, index) => ({
    id: generateBlockId(`content-feature-${index}`),
    icon: ICON_MAP[item.suggestedIcon || 'check'] || 'Check',
    text: item.title,
  }));
  
  // Filter paragraphs with noise
  const cleanParagraphs = paragraphs.filter(p => !isNoiseParagraph(p));
  
  const content = cleanParagraphs.length > 0
    ? cleanParagraphs.slice(0, 3).map(p => `<p>${p}</p>`).join('')
    : '';
  
  return [{
    id: generateBlockId('content-columns'),
    type: 'ContentColumns',
    props: {
      title: isNoiseTitle(title) ? '' : (title || ''),
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
// TESTIMONIALS BLOCK - With real names
// =====================================================
export function createTestimonialsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items } = extractedContent;
  
  // Filter out generic/noise testimonials
  const validItems = items.filter(item => {
    const name = item.name || item.title;
    // Reject generic names
    if (/^cliente\s*\d*$/i.test(name)) return false;
    if (name === 'Cliente') return false;
    // Reject generic descriptions
    if (item.description === 'Excelente produto!') return false;
    if (item.description === 'Recomendo a todos.') return false;
    if (item.description === 'Depoimento do cliente.') return false;
    // Reject noise
    if (isNoiseTitle(name)) return false;
    return true;
  });
  
  // Map items to Testimonials format with REAL names
  const testimonialItems = validItems.slice(0, 6).map(item => ({
    name: item.name || item.title || 'Cliente',
    text: item.description || 'Depoimento.',
    rating: 5,
    avatar: item.avatar || item.imageUrl || '',
  }));
  
  // If no valid items, don't create the block
  if (testimonialItems.length === 0) {
    console.log('[mapper] No valid testimonials found, skipping block');
    return [];
  }
  
  return [{
    id: generateBlockId('testimonials'),
    type: 'Testimonials',
    props: {
      title: isNoiseTitle(title) ? 'O que dizem nossos clientes' : (title || 'O que dizem nossos clientes'),
      items: testimonialItems,
      layout: 'grid',
      showRating: true,
    },
  }];
}

// =====================================================
// FAQ BLOCK
// =====================================================
export function createFAQBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items } = extractedContent;
  
  // Filter noise
  const validItems = items.filter(item => 
    !isNoiseTitle(item.title) && item.title.length > 5
  );
  
  const faqItems = validItems.slice(0, 10).map(item => ({
    question: item.title,
    answer: item.description || 'Resposta em breve.',
  }));
  
  if (faqItems.length === 0) {
    return [];
  }
  
  return [{
    id: generateBlockId('faq'),
    type: 'FAQ',
    props: {
      title: isNoiseTitle(title) ? 'Perguntas Frequentes' : (title || 'Perguntas Frequentes'),
      items: faqItems,
    },
  }];
}

// =====================================================
// CTA BLOCK
// =====================================================
export function createCTABlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, buttons } = extractedContent;
  
  return [{
    id: generateBlockId('cta'),
    type: 'Hero',
    props: {
      title: isNoiseTitle(title) ? 'Pronto para começar?' : (title || 'Pronto para começar?'),
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
// IMAGE BLOCK
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
// VIDEO BLOCK - Creates VideoCarousel for multiple
// =====================================================
export function createVideoBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { videos } = extractedContent;
  
  if (videos.length === 0) return [];
  
  // Deduplicate videos by URL
  const uniqueVideos = videos.filter((video, index, self) => 
    index === self.findIndex(v => v.url === video.url)
  );
  
  // If multiple videos, create VideoCarousel
  if (uniqueVideos.length > 1) {
    return [{
      id: generateBlockId('video-carousel'),
      type: 'VideoCarousel',
      props: {
        videos: uniqueVideos.slice(0, 8).map((video, i) => ({
          id: `video-${i}`,
          type: video.type,
          url: video.url,
          title: `Vídeo ${i + 1}`,
        })),
        autoplay: false,
        interval: 5000,
        showNavigation: true,
        showPagination: true,
        aspectRatio: '16:9',
      },
    }];
  }
  
  // Single video
  return [{
    id: generateBlockId('video'),
    type: 'YouTubeVideo',
    props: {
      youtubeUrl: uniqueVideos[0].url,
      widthPreset: 'xl',
      aspectRatio: '16:9',
      autoplay: false,
    },
  }];
}

// =====================================================
// GENERIC/FALLBACK BLOCK
// =====================================================
export function createGenericBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, paragraphs, images, videos, buttons } = extractedContent;
  
  const blocks: BlockNode[] = [];
  
  // Filter noise from title
  const cleanTitle = isNoiseTitle(title) ? null : title;
  
  // Add title if exists and not noise
  if (cleanTitle) {
    blocks.push({
      id: generateBlockId('generic-title'),
      type: 'TextBanners',
      props: {
        title: cleanTitle,
        subtitle: '',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  // Deduplicate and add videos
  const uniqueVideos = videos.filter((video, index, self) => 
    index === self.findIndex(v => v.url === video.url)
  );
  
  if (uniqueVideos.length > 1) {
    blocks.push({
      id: generateBlockId('generic-video-carousel'),
      type: 'VideoCarousel',
      props: {
        videos: uniqueVideos.slice(0, 6).map((video, i) => ({
          id: `video-${i}`,
          type: video.type,
          url: video.url,
          title: `Vídeo ${i + 1}`,
        })),
        autoplay: false,
        interval: 5000,
        showNavigation: true,
        showPagination: true,
        aspectRatio: '16:9',
      },
    });
  } else if (uniqueVideos.length === 1) {
    blocks.push({
      id: generateBlockId('generic-video'),
      type: 'YouTubeVideo',
      props: {
        youtubeUrl: uniqueVideos[0].url,
        widthPreset: 'xl',
        aspectRatio: '16:9',
      },
    });
  } else if (images.length > 0) {
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
  
  // Filter and add paragraphs
  const cleanParagraphs = paragraphs.filter(p => !isNoiseParagraph(p));
  
  if (cleanParagraphs.length > 0) {
    const sanitizedContent = cleanParagraphs
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
// STEPS/TIMELINE BLOCK
// =====================================================
export function createStepsTimelineBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, subtitle, items } = extractedContent;
  
  const steps = items.filter(item => !isNoiseTitle(item.title)).map((item, index) => ({
    number: index + 1,
    title: item.title,
    description: item.description || '',
  }));
  
  if (steps.length === 0) {
    return [];
  }
  
  return [{
    id: generateBlockId('steps-timeline'),
    type: 'StepsTimeline',
    props: {
      title: isNoiseTitle(title) ? 'Como Funciona' : (title || 'Como Funciona'),
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
// STATS/NUMBERS BLOCK
// =====================================================
export function createStatsNumbersBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, items } = extractedContent;
  
  const stats = items.filter(item => !isNoiseTitle(item.title)).map(item => ({
    number: item.title,
    label: item.description || '',
  }));
  
  if (stats.length === 0) {
    return [];
  }
  
  return [{
    id: generateBlockId('stats-numbers'),
    type: 'StatsNumbers',
    props: {
      title: isNoiseTitle(title) ? '' : (title || ''),
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
// GALLERY BLOCK
// =====================================================
export function createImageGalleryBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, images } = extractedContent;
  
  if (images.length === 0) return [];
  
  const galleryImages = images.map(img => ({
    src: img.src,
    alt: img.alt || '',
    caption: '',
  }));
  
  return [{
    id: generateBlockId('image-gallery'),
    type: 'ImageGallery',
    props: {
      title: isNoiseTitle(title) ? '' : (title || ''),
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
// COUNTDOWN BLOCK
// =====================================================
export function createCountdownBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, buttons } = extractedContent;
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  
  return [{
    id: generateBlockId('countdown-timer'),
    type: 'CountdownTimer',
    props: {
      title: isNoiseTitle(title) ? 'Oferta por tempo limitado' : (title || 'Oferta por tempo limitado'),
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
// LOGOS BLOCK
// =====================================================
export function createLogosCarouselBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, images } = extractedContent;
  
  if (images.length === 0) return [];
  
  const logos = images.map(img => ({
    imageUrl: img.src,
    alt: img.alt || '',
    linkUrl: '',
  }));
  
  return [{
    id: generateBlockId('logos-carousel'),
    type: 'LogosCarousel',
    props: {
      title: isNoiseTitle(title) ? 'Nossos Parceiros' : (title || 'Nossos Parceiros'),
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
// BEFORE/AFTER BLOCK (NEW)
// =====================================================
export function createBeforeAfterBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items, images } = extractedContent;
  
  // Create content columns with before/after styling
  const blocks: BlockNode[] = [];
  
  if (title && !isNoiseTitle(title)) {
    blocks.push({
      id: generateBlockId('before-after-title'),
      type: 'TextBanners',
      props: {
        title: title,
        subtitle: 'Resultados reais de nossos clientes',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  // Create testimonial-style items for before/after
  const testimonialItems = items.filter(item => !isNoiseTitle(item.title)).map(item => ({
    name: item.name || item.title || 'Cliente',
    text: item.description || 'Resultado após uso do produto',
    rating: 5,
    avatar: item.imageUrl || item.avatar || '',
  }));
  
  if (testimonialItems.length > 0) {
    blocks.push({
      id: generateBlockId('before-after-results'),
      type: 'Testimonials',
      props: {
        title: 'Resultados Comprovados',
        items: testimonialItems,
        layout: 'grid',
        showRating: true,
      },
    });
  }
  
  // Add images as gallery
  if (images.length > 0) {
    blocks.push({
      id: generateBlockId('before-after-gallery'),
      type: 'ImageGallery',
      props: {
        title: '',
        images: images.map(img => ({
          src: img.src,
          alt: img.alt || 'Resultado',
          caption: '',
        })),
        columns: Math.min(images.length, 3),
        gap: 'md',
        enableLightbox: true,
        aspectRatio: 'portrait',
        borderRadius: 8,
      },
    });
  }
  
  return blocks;
}

// =====================================================
// INGREDIENTS BLOCK (NEW)
// =====================================================
export function createIngredientsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items } = extractedContent;
  
  const validItems = items.filter(item => !isNoiseTitle(item.title));
  
  if (validItems.length === 0) return [];
  
  // Use InfoHighlights for ingredient cards
  const highlightItems = validItems.slice(0, 6).map((item, index) => ({
    id: generateBlockId(`ingredient-${index}`),
    icon: ICON_MAP[item.suggestedIcon || 'zap'] || 'Zap',
    title: item.title,
    description: item.description || '',
  }));
  
  const blocks: BlockNode[] = [];
  
  if (title && !isNoiseTitle(title)) {
    blocks.push({
      id: generateBlockId('ingredients-title'),
      type: 'TextBanners',
      props: {
        title: title,
        subtitle: 'Ingredientes ativos de alta performance',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  blocks.push({
    id: generateBlockId('ingredients-grid'),
    type: 'InfoHighlights',
    props: {
      items: highlightItems,
      layout: 'horizontal',
      iconColor: '#22c55e',
      textColor: '#1f2937',
    },
  });
  
  return blocks;
}

// =====================================================
// CATEGORY GRID BLOCK (NEW)
// =====================================================
export function createCategoryGridBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items, images } = extractedContent;
  
  const validItems = items.filter(item => !isNoiseTitle(item.title));
  
  const blocks: BlockNode[] = [];
  
  if (title && !isNoiseTitle(title)) {
    blocks.push({
      id: generateBlockId('category-title'),
      type: 'TextBanners',
      props: {
        title: title,
        subtitle: '',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  // Create grid of category cards
  const highlightItems = validItems.slice(0, 6).map((item, index) => ({
    id: generateBlockId(`category-${index}`),
    icon: ICON_MAP[item.suggestedIcon || 'star'] || 'Star',
    title: item.title,
    description: item.description || 'Ver produtos',
  }));
  
  if (highlightItems.length > 0) {
    blocks.push({
      id: generateBlockId('category-grid'),
      type: 'InfoHighlights',
      props: {
        items: highlightItems,
        layout: 'horizontal',
        iconColor: '#6366f1',
        textColor: '#1f2937',
      },
    });
  }
  
  // Add images as gallery if present
  if (images.length > 0) {
    blocks.push({
      id: generateBlockId('category-images'),
      type: 'ImageGallery',
      props: {
        title: '',
        images: images.map(img => ({
          src: img.src,
          alt: img.alt || 'Categoria',
          caption: '',
        })),
        columns: Math.min(images.length, 4),
        gap: 'md',
        enableLightbox: false,
        aspectRatio: 'square',
        borderRadius: 8,
      },
    });
  }
  
  return blocks;
}

// =====================================================
// PRODUCT CARDS BLOCK (NEW)
// =====================================================
export function createProductCardsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, items, images, buttons } = extractedContent;
  
  const blocks: BlockNode[] = [];
  
  if (title && !isNoiseTitle(title)) {
    blocks.push({
      id: generateBlockId('products-title'),
      type: 'TextBanners',
      props: {
        title: title,
        subtitle: '',
        alignment: 'center',
        backgroundColor: 'transparent',
      },
    });
  }
  
  // For now, represent as content columns or image gallery
  // TODO: Create a proper ProductCards block type
  if (images.length > 0) {
    blocks.push({
      id: generateBlockId('products-gallery'),
      type: 'ImageGallery',
      props: {
        title: '',
        images: images.map(img => ({
          src: img.src,
          alt: img.alt || 'Produto',
          caption: '',
        })),
        columns: Math.min(images.length, 4),
        gap: 'md',
        enableLightbox: false,
        aspectRatio: 'square',
        borderRadius: 8,
      },
    });
  }
  
  // Add CTA button if exists
  if (buttons.length > 0) {
    blocks.push({
      id: generateBlockId('products-cta'),
      type: 'Hero',
      props: {
        title: '',
        subtitle: '',
        buttonText: buttons[0].text || 'Ver Produtos',
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
// MAIN MAPPER FUNCTION
// =====================================================
export function mapClassificationToBlocks(classification: ClassificationResult): BlockNode[] {
  const { sectionType, confidence, layout, extractedContent } = classification;
  
  console.log(`[mapper] Mapping section: ${sectionType} (confidence: ${confidence}, layout: ${layout})`);
  
  // Very low confidence or pure noise -> skip entirely
  if (confidence < 0.2) {
    console.log('[mapper] Very low confidence, skipping section');
    return [];
  }
  
  // Low confidence -> generic fallback
  if (confidence < 0.4) {
    console.log('[mapper] Low confidence, using generic block');
    return createGenericBlock(classification);
  }
  
  // Check if this looks like a columns layout
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
      if (isColumnsLayout && hasImage && hasTextContent) {
        console.log('[mapper] Creating ContentColumns for benefits with image');
        return createContentColumnsBlock(classification);
      }
      console.log('[mapper] Creating native Benefits block');
      return createBenefitsBlock(classification);
      
    case 'testimonials':
      console.log('[mapper] Creating native Testimonials block');
      return createTestimonialsBlock(classification);
      
    case 'faq':
      console.log('[mapper] Creating native FAQ block');
      return createFAQBlock(classification);
      
    case 'cta':
      console.log('[mapper] Creating CTA block');
      return createCTABlock(classification);
    
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
    
    // NEW SECTION TYPES
    case 'before_after':
      console.log('[mapper] Creating Before/After block');
      return createBeforeAfterBlock(classification);
      
    case 'ingredients':
      console.log('[mapper] Creating Ingredients block');
      return createIngredientsBlock(classification);
      
    case 'category_grid':
      console.log('[mapper] Creating Category Grid block');
      return createCategoryGridBlock(classification);
      
    case 'product_cards':
      console.log('[mapper] Creating Product Cards block');
      return createProductCardsBlock(classification);
      
    case 'about':
      if (hasImage && hasTextContent) {
        console.log('[mapper] Creating ContentColumns for about section');
        return createContentColumnsBlock(classification);
      }
      console.log('[mapper] Creating generic blocks for about');
      return createGenericBlock(classification);
      
    case 'contact':
    case 'generic':
    default:
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
