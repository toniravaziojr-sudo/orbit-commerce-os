// =====================================================
// INTELLIGENT BLOCK MAPPER
// =====================================================
// 
// This module creates Builder blocks based on AI classification results.
// It works in conjunction with the classify-content edge function
// to transform HTML sections into appropriate native blocks.
//
// BLOCK TYPES CREATED:
// - Hero: Hero section with title, subtitle, CTA, background
// - BenefitsGrid: Grid of benefits/features with icons
// - Columns: Two-column layout with image + text
// - Features: Feature list with descriptions
// - CTA: Call-to-action section
// - Generic: Fallback to RichText
// =====================================================

export interface ClassificationResult {
  sectionType: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta' | 'about' | 'contact' | 'generic';
  layout: 'columns-image-left' | 'columns-image-right' | 'grid-2' | 'grid-3' | 'grid-4' | 'stacked' | 'hero-centered' | 'hero-split';
  elements: {
    hasHeading: boolean;
    hasSubheading: boolean;
    hasImage: boolean;
    hasVideo: boolean;
    hasList: boolean;
    hasButton: boolean;
    hasIcons: boolean;
    itemCount: number;
  };
  confidence: number;
  reasoning: string;
}

export interface ContentPrimitive {
  type: 'heading' | 'paragraph' | 'image' | 'video' | 'button' | 'list';
  content: string;
  level?: number;
  src?: string;
  alt?: string;
  href?: string;
  items?: string[];
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
// HERO BLOCK CREATOR
// =====================================================
export function createHeroBlock(
  primitives: ContentPrimitive[],
  classification: ClassificationResult
): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  const heading = primitives.find(p => p.type === 'heading');
  const paragraphs = primitives.filter(p => p.type === 'paragraph');
  const images = primitives.filter(p => p.type === 'image');
  const videos = primitives.filter(p => p.type === 'video');
  const buttons = primitives.filter(p => p.type === 'button');
  
  // Get subtitle from paragraphs (first short one)
  const subtitle = paragraphs.find(p => p.content.length < 200)?.content || '';
  const description = paragraphs.find(p => p.content.length >= 50 && p.content.length < 500)?.content || '';
  
  // Determine layout type
  const isSplit = classification.layout === 'hero-split' || 
                  (images.length > 0 && heading);
  
  if (isSplit && images.length > 0) {
    // Split hero: Image + Text side by side using Columns
    const imageOnLeft = classification.layout !== 'columns-image-right';
    
    const textColumn: BlockNode = {
      id: generateBlockId('hero-text-col'),
      type: 'Column',
      props: { width: '50%' },
      children: [
        {
          id: generateBlockId('hero-heading'),
          type: 'RichText',
          props: {
            content: `<h1 style="font-size: 2.5rem; font-weight: 700; line-height: 1.2;">${heading?.content || 'Título Principal'}</h1>`,
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
            text: buttons[0].content,
            url: buttons[0].href || '#',
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
    
    blocks.push({
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
          props: {
            gap: 48,
            verticalAlign: 'center',
          },
          children: imageOnLeft 
            ? [imageColumn, textColumn] 
            : [textColumn, imageColumn],
        },
      ],
    });
  } else {
    // Centered hero
    const heroSection: BlockNode = {
      id: generateBlockId('hero-section'),
      type: 'Section',
      props: {
        backgroundColor: 'transparent',
        paddingY: 80,
        paddingX: 16,
        ...(images.length > 0 && {
          backgroundImage: images[0].src,
          backgroundOverlay: 0.5,
        }),
      },
      children: [
        {
          id: generateBlockId('hero-container'),
          type: 'Container',
          props: {
            maxWidth: 'lg',
            textAlign: 'center',
          },
          children: [
            {
              id: generateBlockId('hero-heading'),
              type: 'RichText',
              props: {
                content: `<h1 style="font-size: 3rem; font-weight: 700; line-height: 1.1;">${heading?.content || 'Título Principal'}</h1>`,
                textAlign: 'center',
              },
            },
            ...(subtitle ? [{
              id: generateBlockId('hero-subtitle'),
              type: 'RichText',
              props: {
                content: `<p style="font-size: 1.25rem; max-width: 600px; margin: 0 auto;">${subtitle}</p>`,
                textAlign: 'center',
              },
            }] : []),
            ...(videos.length > 0 ? [{
              id: generateBlockId('hero-video'),
              type: 'YouTubeVideo',
              props: {
                youtubeUrl: videos[0].content,
                widthPreset: 'xl',
                aspectRatio: '16:9',
              },
            }] : []),
            ...(buttons.length > 0 ? [{
              id: generateBlockId('hero-cta'),
              type: 'Button',
              props: {
                text: buttons[0].content,
                url: buttons[0].href || '#',
                variant: 'primary',
                size: 'lg',
              },
            }] : []),
          ],
        },
      ],
    };
    
    blocks.push(heroSection);
  }
  
  return blocks;
}

// =====================================================
// BENEFITS/FEATURES GRID CREATOR
// =====================================================
export function createBenefitsGridBlock(
  primitives: ContentPrimitive[],
  classification: ClassificationResult
): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  const heading = primitives.find(p => p.type === 'heading');
  const paragraphs = primitives.filter(p => p.type === 'paragraph');
  const lists = primitives.filter(p => p.type === 'list');
  
  // Determine grid columns based on layout
  let gridCols = 3;
  if (classification.layout === 'grid-2') gridCols = 2;
  if (classification.layout === 'grid-4') gridCols = 4;
  
  // Extract benefit items from lists or paragraphs
  const benefitItems: Array<{ title: string; description: string; icon: string }> = [];
  
  // Try to extract from lists first
  for (const list of lists) {
    if (list.items) {
      for (const item of list.items) {
        // Try to split item into title and description
        const parts = item.split(/[:\-–—]/);
        if (parts.length >= 2) {
          benefitItems.push({
            title: parts[0].trim(),
            description: parts.slice(1).join(' ').trim(),
            icon: detectIcon(parts[0]),
          });
        } else if (item.length < 100) {
          benefitItems.push({
            title: item,
            description: '',
            icon: 'CheckCircle',
          });
        }
      }
    }
  }
  
  // If no list items, try to extract from short paragraphs
  if (benefitItems.length < 2) {
    const shortParagraphs = paragraphs.filter(p => p.content.length < 150);
    for (const p of shortParagraphs) {
      if (benefitItems.length < 6) {
        benefitItems.push({
          title: p.content.split(/[.!?]/)[0].trim(),
          description: p.content,
          icon: detectIcon(p.content),
        });
      }
    }
  }
  
  // Create section with title and grid
  const sectionChildren: BlockNode[] = [];
  
  if (heading) {
    sectionChildren.push({
      id: generateBlockId('benefits-title'),
      type: 'RichText',
      props: {
        content: `<h2 style="font-size: 2rem; font-weight: 600; text-align: center; margin-bottom: 2rem;">${heading.content}</h2>`,
        textAlign: 'center',
      },
    });
  }
  
  // Create grid of benefit cards
  if (benefitItems.length > 0) {
    const gridItems: BlockNode[] = benefitItems.slice(0, 6).map((item, index) => ({
      id: generateBlockId(`benefit-item-${index}`),
      type: 'Column',
      props: { width: `${100 / gridCols}%` },
      children: [
        {
          id: generateBlockId(`benefit-icon-${index}`),
          type: 'RichText',
          props: {
            content: `<div style="font-size: 2rem; margin-bottom: 0.5rem;">✓</div>`,
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
    }));
    
    sectionChildren.push({
      id: generateBlockId('benefits-grid'),
      type: 'Columns',
      props: {
        gap: 32,
        verticalAlign: 'top',
      },
      children: gridItems,
    });
  }
  
  blocks.push({
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
  });
  
  return blocks;
}

// =====================================================
// COLUMNS LAYOUT CREATOR (Image + Text)
// =====================================================
export function createColumnsBlock(
  primitives: ContentPrimitive[],
  classification: ClassificationResult
): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  const heading = primitives.find(p => p.type === 'heading');
  const paragraphs = primitives.filter(p => p.type === 'paragraph');
  const images = primitives.filter(p => p.type === 'image');
  const buttons = primitives.filter(p => p.type === 'button');
  
  const imageOnLeft = classification.layout !== 'columns-image-right';
  
  // Text column
  const textChildren: BlockNode[] = [];
  
  if (heading) {
    textChildren.push({
      id: generateBlockId('col-heading'),
      type: 'RichText',
      props: {
        content: `<h2 style="font-size: 1.75rem; font-weight: 600;">${heading.content}</h2>`,
        textAlign: 'left',
      },
    });
  }
  
  for (const p of paragraphs.slice(0, 3)) {
    textChildren.push({
      id: generateBlockId('col-text'),
      type: 'RichText',
      props: {
        content: `<p>${p.content}</p>`,
        textAlign: 'left',
      },
    });
  }
  
  if (buttons.length > 0) {
    textChildren.push({
      id: generateBlockId('col-button'),
      type: 'Button',
      props: {
        text: buttons[0].content,
        url: buttons[0].href || '#',
        variant: 'primary',
        size: 'md',
      },
    });
  }
  
  const textColumn: BlockNode = {
    id: generateBlockId('text-column'),
    type: 'Column',
    props: { width: '50%' },
    children: textChildren,
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
  
  blocks.push({
    id: generateBlockId('columns-section'),
    type: 'Section',
    props: {
      paddingY: 64,
      paddingX: 16,
    },
    children: [
      {
        id: generateBlockId('columns-container'),
        type: 'Container',
        props: { maxWidth: 'xl' },
        children: [
          {
            id: generateBlockId('columns-layout'),
            type: 'Columns',
            props: {
              gap: 48,
              verticalAlign: 'center',
            },
            children: imageOnLeft ? [imageColumn, textColumn] : [textColumn, imageColumn],
          },
        ],
      },
    ],
  });
  
  return blocks;
}

// =====================================================
// CTA BLOCK CREATOR
// =====================================================
export function createCTABlock(
  primitives: ContentPrimitive[],
  classification: ClassificationResult
): BlockNode[] {
  const heading = primitives.find(p => p.type === 'heading');
  const paragraphs = primitives.filter(p => p.type === 'paragraph');
  const buttons = primitives.filter(p => p.type === 'button');
  
  const subtitle = paragraphs.find(p => p.content.length < 200)?.content || '';
  
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
              content: `<h2 style="font-size: 2rem; font-weight: 700; color: white;">${heading?.content || 'Pronto para começar?'}</h2>`,
              textAlign: 'center',
            },
          },
          ...(subtitle ? [{
            id: generateBlockId('cta-subtitle'),
            type: 'RichText',
            props: {
              content: `<p style="font-size: 1.125rem; color: rgba(255,255,255,0.9);">${subtitle}</p>`,
              textAlign: 'center',
            },
          }] : []),
          {
            id: generateBlockId('cta-button'),
            type: 'Button',
            props: {
              text: buttons[0]?.content || 'Saiba Mais',
              url: buttons[0]?.href || '#',
              variant: 'secondary',
              size: 'lg',
            },
          },
        ],
      },
    ],
  }];
}

// =====================================================
// GENERIC STACKED BLOCK CREATOR
// =====================================================
export function createStackedBlock(
  primitives: ContentPrimitive[],
  classification: ClassificationResult
): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  const children: BlockNode[] = [];
  
  for (const p of primitives) {
    switch (p.type) {
      case 'heading':
        const tag = p.level === 1 ? 'h1' : p.level === 2 ? 'h2' : 'h3';
        children.push({
          id: generateBlockId('heading'),
          type: 'RichText',
          props: {
            content: `<${tag}>${p.content}</${tag}>`,
            textAlign: 'center',
          },
        });
        break;
        
      case 'paragraph':
        children.push({
          id: generateBlockId('text'),
          type: 'RichText',
          props: {
            content: `<p>${p.content}</p>`,
            textAlign: 'left',
          },
        });
        break;
        
      case 'image':
        children.push({
          id: generateBlockId('image'),
          type: 'Image',
          props: {
            imageDesktop: p.src,
            imageMobile: p.src,
            alt: p.alt || p.content,
            aspectRatio: 'auto',
          },
        });
        break;
        
      case 'video':
        children.push({
          id: generateBlockId('video'),
          type: 'YouTubeVideo',
          props: {
            youtubeUrl: p.content,
            widthPreset: 'xl',
            aspectRatio: '16:9',
          },
        });
        break;
        
      case 'button':
        children.push({
          id: generateBlockId('button'),
          type: 'Button',
          props: {
            text: p.content,
            url: p.href || '#',
            variant: 'primary',
            size: 'md',
          },
        });
        break;
    }
  }
  
  if (children.length > 0) {
    blocks.push({
      id: generateBlockId('stacked-section'),
      type: 'Section',
      props: {
        paddingY: 48,
        paddingX: 16,
        gap: 24,
      },
      children: [
        {
          id: generateBlockId('stacked-container'),
          type: 'Container',
          props: { maxWidth: 'lg' },
          children,
        },
      ],
    });
  }
  
  return blocks;
}

// =====================================================
// MAIN MAPPER FUNCTION
// =====================================================
export function mapSectionToBlocks(
  primitives: ContentPrimitive[],
  classification: ClassificationResult
): BlockNode[] {
  console.log(`[INTELLIGENT-MAPPER] Mapping section: type=${classification.sectionType}, layout=${classification.layout}, confidence=${classification.confidence}`);
  
  // Use confidence threshold - if low confidence, fall back to stacked
  if (classification.confidence < 0.4 && classification.sectionType === 'generic') {
    console.log('[INTELLIGENT-MAPPER] Low confidence, using stacked layout');
    return createStackedBlock(primitives, classification);
  }
  
  switch (classification.sectionType) {
    case 'hero':
      console.log('[INTELLIGENT-MAPPER] Creating Hero block');
      return createHeroBlock(primitives, classification);
      
    case 'benefits':
    case 'features':
      console.log('[INTELLIGENT-MAPPER] Creating Benefits/Features grid');
      return createBenefitsGridBlock(primitives, classification);
      
    case 'cta':
      console.log('[INTELLIGENT-MAPPER] Creating CTA block');
      return createCTABlock(primitives, classification);
      
    case 'about':
    case 'contact':
      // For about/contact, use columns if there's an image
      if (classification.elements.hasImage) {
        console.log('[INTELLIGENT-MAPPER] Creating Columns layout for about/contact');
        return createColumnsBlock(primitives, classification);
      }
      // Fall through to stacked
      
    default:
      // For generic, testimonials, faq - let the original mapper handle specialized blocks
      // or use columns if image + text detected
      if (classification.elements.hasImage && classification.elements.hasHeading) {
        if (classification.layout.startsWith('columns-')) {
          console.log('[INTELLIGENT-MAPPER] Creating Columns layout');
          return createColumnsBlock(primitives, classification);
        }
      }
      
      console.log('[INTELLIGENT-MAPPER] Using stacked layout');
      return createStackedBlock(primitives, classification);
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function detectIcon(text: string): string {
  const textLower = text.toLowerCase();
  
  if (/entrega|frete|envio|shipping/i.test(textLower)) return 'Truck';
  if (/seguro|segurança|proteção|ssl/i.test(textLower)) return 'Shield';
  if (/pagamento|cartão|pix|parcel/i.test(textLower)) return 'CreditCard';
  if (/suporte|atendimento|ajuda|whatsapp/i.test(textLower)) return 'Headphones';
  if (/garantia|troca|devolução/i.test(textLower)) return 'Award';
  if (/qualidade|original|premium/i.test(textLower)) return 'Star';
  if (/rápido|veloz|express/i.test(textLower)) return 'Zap';
  
  return 'CheckCircle';
}
