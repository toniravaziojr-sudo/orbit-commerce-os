// =====================================================
// INTELLIGENT BLOCK MAPPER
// =====================================================
// 
// Creates Builder blocks from AI classification results.
// Works with the classify-content edge function that provides
// both classification AND extracted content.
//
// BLOCK TYPES CREATED:
// - Hero: Hero section with title, subtitle, CTA
// - BenefitsGrid: Grid of benefits/features with icons
// - Columns: Two-column layout with image + text
// - CTA: Call-to-action section
// - Generic: Fallback to RichText
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
  sectionType: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta' | 'about' | 'contact' | 'generic';
  layout: 'columns-image-left' | 'columns-image-right' | 'grid-2' | 'grid-3' | 'grid-4' | 'stacked' | 'hero-centered' | 'hero-split';
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

// Icon mapping
const ICON_MAP: Record<string, string> = {
  check: '✓',
  shield: '🛡️',
  zap: '⚡',
  star: '⭐',
  heart: '❤️',
  award: '🏆',
  truck: '🚚',
  clock: '⏰',
  gift: '🎁',
  percent: '💰',
};

// =====================================================
// HERO BLOCK CREATOR
// =====================================================
export function createHeroBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, subtitle, images, videos, buttons } = extractedContent;
  
  const isSplit = layout === 'hero-split' || layout === 'columns-image-left' || layout === 'columns-image-right';
  const hasImage = images.length > 0;
  const hasVideo = videos.length > 0;
  
  if (isSplit && hasImage) {
    // Split hero: Image + Text side by side
    const imageOnLeft = layout !== 'columns-image-right';
    
    const textColumn: BlockNode = {
      id: generateBlockId('hero-text-col'),
      type: 'Column',
      props: { width: '50%' },
      children: [
        {
          id: generateBlockId('hero-heading'),
          type: 'RichText',
          props: {
            content: `<h1 style="font-size: 2.5rem; font-weight: 700; line-height: 1.2;">${title || 'Título Principal'}</h1>`,
            textAlign: 'left',
          },
        },
        ...(subtitle ? [{
          id: generateBlockId('hero-subtitle'),
          type: 'RichText',
          props: {
            content: `<p style="font-size: 1.25rem; opacity: 0.9;">${subtitle}</p>`,
            textAlign: 'left',
          },
        }] : []),
        ...(buttons.length > 0 ? [{
          id: generateBlockId('hero-cta'),
          type: 'Button',
          props: {
            text: buttons[0].text,
            url: buttons[0].url || '#',
            variant: 'primary',
            size: 'lg',
          },
        }] : []),
      ],
    };
    
    const imageColumn: BlockNode = {
      id: generateBlockId('hero-image-col'),
      type: 'Column',
      props: { width: '50%' },
      children: [
        {
          id: generateBlockId('hero-image'),
          type: 'Image',
          props: {
            imageDesktop: images[0].src,
            imageMobile: images[0].src,
            alt: images[0].alt || 'Hero image',
            aspectRatio: '16:9',
            borderRadius: 8,
          },
        },
      ],
    };
    
    return [{
      id: generateBlockId('hero-section'),
      type: 'Section',
      props: {
        backgroundColor: 'transparent',
        paddingY: 64,
        paddingX: 16,
      },
      children: [
        {
          id: generateBlockId('hero-columns'),
          type: 'Columns',
          props: { gap: 48, verticalAlign: 'center' },
          children: imageOnLeft ? [imageColumn, textColumn] : [textColumn, imageColumn],
        },
      ],
    }];
  }
  
  // Centered hero
  const heroChildren: BlockNode[] = [
    {
      id: generateBlockId('hero-heading'),
      type: 'RichText',
      props: {
        content: `<h1 style="font-size: 3rem; font-weight: 700; line-height: 1.1;">${title || 'Título Principal'}</h1>`,
        textAlign: 'center',
      },
    },
  ];
  
  if (subtitle) {
    heroChildren.push({
      id: generateBlockId('hero-subtitle'),
      type: 'RichText',
      props: {
        content: `<p style="font-size: 1.25rem; max-width: 600px; margin: 0 auto;">${subtitle}</p>`,
        textAlign: 'center',
      },
    });
  }
  
  if (hasVideo) {
    heroChildren.push({
      id: generateBlockId('hero-video'),
      type: 'YouTubeVideo',
      props: {
        youtubeUrl: videos[0].url,
        widthPreset: 'xl',
        aspectRatio: '16:9',
      },
    });
  }
  
  if (buttons.length > 0) {
    heroChildren.push({
      id: generateBlockId('hero-cta'),
      type: 'Button',
      props: {
        text: buttons[0].text,
        url: buttons[0].url || '#',
        variant: 'primary',
        size: 'lg',
      },
    });
  }
  
  return [{
    id: generateBlockId('hero-section'),
    type: 'Section',
    props: {
      backgroundColor: 'transparent',
      paddingY: 80,
      paddingX: 16,
      ...(hasImage && !hasVideo && {
        backgroundImage: images[0].src,
        backgroundOverlay: 0.5,
      }),
    },
    children: [
      {
        id: generateBlockId('hero-container'),
        type: 'Container',
        props: { maxWidth: 'lg', textAlign: 'center' },
        children: heroChildren,
      },
    ],
  }];
}

// =====================================================
// BENEFITS/FEATURES GRID CREATOR
// =====================================================
export function createBenefitsGridBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, items } = extractedContent;
  
  // Determine grid columns
  let gridCols = 3;
  if (layout === 'grid-2') gridCols = 2;
  if (layout === 'grid-4') gridCols = 4;
  
  const sectionChildren: BlockNode[] = [];
  
  // Section title
  if (title) {
    sectionChildren.push({
      id: generateBlockId('benefits-title'),
      type: 'RichText',
      props: {
        content: `<h2 style="font-size: 2rem; font-weight: 600; text-align: center; margin-bottom: 2rem;">${title}</h2>`,
        textAlign: 'center',
      },
    });
  }
  
  // Grid of items
  if (items.length > 0) {
    const gridItems: BlockNode[] = items.slice(0, 6).map((item, index) => {
      const icon = item.suggestedIcon ? ICON_MAP[item.suggestedIcon] || '✓' : '✓';
      
      return {
        id: generateBlockId(`benefit-item-${index}`),
        type: 'Column',
        props: { width: `${100 / gridCols}%` },
        children: [
          {
            id: generateBlockId(`benefit-icon-${index}`),
            type: 'RichText',
            props: {
              content: `<div style="font-size: 2rem; margin-bottom: 0.5rem;">${icon}</div>`,
              textAlign: 'center',
            },
          },
          {
            id: generateBlockId(`benefit-title-${index}`),
            type: 'RichText',
            props: {
              content: `<h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">${item.title}</h3>`,
              textAlign: 'center',
            },
          },
          ...(item.description ? [{
            id: generateBlockId(`benefit-desc-${index}`),
            type: 'RichText',
            props: {
              content: `<p style="font-size: 0.875rem; opacity: 0.8;">${item.description}</p>`,
              textAlign: 'center',
            },
          }] : []),
        ],
      };
    });
    
    sectionChildren.push({
      id: generateBlockId('benefits-grid'),
      type: 'Columns',
      props: { gap: 32, verticalAlign: 'top' },
      children: gridItems,
    });
  }
  
  return [{
    id: generateBlockId('benefits-section'),
    type: 'Section',
    props: {
      backgroundColor: 'transparent',
      paddingY: 64,
      paddingX: 16,
    },
    children: [
      {
        id: generateBlockId('benefits-container'),
        type: 'Container',
        props: { maxWidth: 'xl' },
        children: sectionChildren,
      },
    ],
  }];
}

// =====================================================
// COLUMNS LAYOUT CREATOR (Image + Text)
// =====================================================
export function createColumnsBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent, layout } = classification;
  const { title, paragraphs, images, buttons } = extractedContent;
  
  const imageOnLeft = layout !== 'columns-image-right';
  
  // Text column
  const textChildren: BlockNode[] = [];
  
  if (title) {
    textChildren.push({
      id: generateBlockId('col-heading'),
      type: 'RichText',
      props: {
        content: `<h2 style="font-size: 1.75rem; font-weight: 600;">${title}</h2>`,
        textAlign: 'left',
      },
    });
  }
  
  for (const p of paragraphs.slice(0, 3)) {
    textChildren.push({
      id: generateBlockId('col-text'),
      type: 'RichText',
      props: {
        content: `<p>${p}</p>`,
        textAlign: 'left',
      },
    });
  }
  
  if (buttons.length > 0) {
    textChildren.push({
      id: generateBlockId('col-button'),
      type: 'Button',
      props: {
        text: buttons[0].text,
        url: buttons[0].url || '#',
        variant: 'primary',
        size: 'md',
      },
    });
  }
  
  const textColumn: BlockNode = {
    id: generateBlockId('text-column'),
    type: 'Column',
    props: { width: '50%' },
    children: textChildren.length > 0 ? textChildren : [{
      id: generateBlockId('col-placeholder-text'),
      type: 'RichText',
      props: { content: '<p>Conteúdo da seção</p>' },
    }],
  };
  
  // Image column
  const imageColumn: BlockNode = {
    id: generateBlockId('image-column'),
    type: 'Column',
    props: { width: '50%' },
    children: images.length > 0 ? [
      {
        id: generateBlockId('col-image'),
        type: 'Image',
        props: {
          imageDesktop: images[0].src,
          imageMobile: images[0].src,
          alt: images[0].alt || 'Section image',
          aspectRatio: '4:3',
          borderRadius: 8,
        },
      },
    ] : [
      {
        id: generateBlockId('col-placeholder'),
        type: 'RichText',
        props: {
          content: '<div style="background: #f0f0f0; padding: 4rem; text-align: center; border-radius: 8px;">Imagem</div>',
        },
      },
    ],
  };
  
  return [{
    id: generateBlockId('columns-section'),
    type: 'Section',
    props: { paddingY: 64, paddingX: 16 },
    children: [
      {
        id: generateBlockId('columns-container'),
        type: 'Container',
        props: { maxWidth: 'xl' },
        children: [
          {
            id: generateBlockId('columns-layout'),
            type: 'Columns',
            props: { gap: 48, verticalAlign: 'center' },
            children: imageOnLeft ? [imageColumn, textColumn] : [textColumn, imageColumn],
          },
        ],
      },
    ],
  }];
}

// =====================================================
// CTA BLOCK CREATOR
// =====================================================
export function createCTABlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, subtitle, buttons } = extractedContent;
  
  return [{
    id: generateBlockId('cta-section'),
    type: 'Section',
    props: {
      backgroundColor: 'var(--primary)',
      paddingY: 64,
      paddingX: 16,
    },
    children: [
      {
        id: generateBlockId('cta-container'),
        type: 'Container',
        props: { maxWidth: 'md', textAlign: 'center' },
        children: [
          {
            id: generateBlockId('cta-heading'),
            type: 'RichText',
            props: {
              content: `<h2 style="font-size: 2rem; font-weight: 700; color: white;">${title || 'Pronto para começar?'}</h2>`,
              textAlign: 'center',
            },
          },
          ...(subtitle ? [{
            id: generateBlockId('cta-text'),
            type: 'RichText',
            props: {
              content: `<p style="color: white; opacity: 0.9;">${subtitle}</p>`,
              textAlign: 'center',
            },
          }] : []),
          ...(buttons.length > 0 ? [{
            id: generateBlockId('cta-button'),
            type: 'Button',
            props: {
              text: buttons[0].text,
              url: buttons[0].url || '#',
              variant: 'secondary',
              size: 'lg',
            },
          }] : []),
        ],
      },
    ],
  }];
}

// =====================================================
// GENERIC/FALLBACK BLOCK CREATOR
// =====================================================
export function createGenericBlock(classification: ClassificationResult): BlockNode[] {
  const { extractedContent } = classification;
  const { title, paragraphs, images, buttons } = extractedContent;
  
  const children: BlockNode[] = [];
  
  if (title) {
    children.push({
      id: generateBlockId('generic-heading'),
      type: 'RichText',
      props: {
        content: `<h2 style="font-size: 1.75rem; font-weight: 600;">${title}</h2>`,
      },
    });
  }
  
  for (const p of paragraphs.slice(0, 5)) {
    children.push({
      id: generateBlockId('generic-text'),
      type: 'RichText',
      props: { content: `<p>${p}</p>` },
    });
  }
  
  for (const img of images.slice(0, 2)) {
    children.push({
      id: generateBlockId('generic-image'),
      type: 'Image',
      props: {
        imageDesktop: img.src,
        imageMobile: img.src,
        alt: img.alt,
        aspectRatio: '16:9',
        borderRadius: 8,
      },
    });
  }
  
  if (buttons.length > 0) {
    children.push({
      id: generateBlockId('generic-button'),
      type: 'Button',
      props: {
        text: buttons[0].text,
        url: buttons[0].url || '#',
        variant: 'primary',
        size: 'md',
      },
    });
  }
  
  // Fallback if no content
  if (children.length === 0) {
    children.push({
      id: generateBlockId('generic-empty'),
      type: 'RichText',
      props: { content: '<p>Conteúdo da seção</p>' },
    });
  }
  
  return [{
    id: generateBlockId('generic-section'),
    type: 'Section',
    props: { paddingY: 48, paddingX: 16 },
    children: [
      {
        id: generateBlockId('generic-container'),
        type: 'Container',
        props: { maxWidth: 'lg' },
        children,
      },
    ],
  }];
}

// =====================================================
// MAIN MAPPER FUNCTION
// =====================================================
export function mapClassificationToBlocks(classification: ClassificationResult): BlockNode[] {
  const { sectionType, confidence } = classification;
  
  console.log(`[MAPPER] Mapeando seção: tipo=${sectionType}, conf=${confidence}`);
  
  // Use generic for low confidence
  if (confidence < 0.5) {
    console.log(`[MAPPER] Confiança baixa (${confidence}), usando bloco genérico`);
    return createGenericBlock(classification);
  }
  
  switch (sectionType) {
    case 'hero':
      return createHeroBlock(classification);
    
    case 'benefits':
    case 'features':
      return createBenefitsGridBlock(classification);
    
    case 'cta':
      return createCTABlock(classification);
    
    case 'about':
    case 'contact':
    case 'testimonials':
    case 'faq':
      // These could have specific implementations later
      return createColumnsBlock(classification);
    
    case 'generic':
    default:
      return createGenericBlock(classification);
  }
}
