// =============================================
// BLOCK ASSEMBLER V5 — Converts AI tool-calling output to BlockNode JSON
// Maps 1:1 to real Builder components (same as Lovable uses)
// v1.0.0
// =============================================

/**
 * BlockNode structure (matches src/lib/builder/types.ts)
 */
interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BlockNode[];
  hidden?: boolean;
}

// ========== TOOL CALLING SCHEMA ==========

/**
 * The tool definition for AI to call.
 * Each section maps 1:1 to a Builder block component.
 */
export const BLOCK_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "build_landing_page",
    description: "Build a high-conversion landing page using real React components. Each section maps to a pre-built component with specific props. Follow the section order and use ONLY the provided image URLs.",
    parameters: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          description: "Ordered array of sections to compose the landing page. Each section type maps to a real component.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "hero_banner",
                  "info_highlights",
                  "content_columns",
                  "feature_list",
                  "testimonials",
                  "faq",
                  "pricing_table",
                  "stats_numbers",
                  "steps_timeline",
                  "image_gallery",
                  "text_section",
                  "button_cta",
                  "spacer",
                  "divider",
                ],
                description: "The type of section/block to render",
              },
              props: {
                type: "object",
                description: "Props specific to this block type. See detailed schemas below.",
                additionalProperties: true,
              },
            },
            required: ["type", "props"],
            additionalProperties: false,
          },
        },
        page_background_color: {
          type: "string",
          description: "Background color for the entire page (hex, e.g. '#0a0a0a' for dark, '#ffffff' for light)",
        },
      },
      required: ["sections"],
      additionalProperties: false,
    },
  },
};

/**
 * Detailed props documentation injected into the system prompt.
 * This tells the AI exactly what props each section type accepts.
 */
export function getBlockPropsDocumentation(): string {
  return `
## BLOCK PROPS REFERENCE (use these EXACT prop names)

### hero_banner
Single hero banner with CTA overlay.
Props:
- imageDesktop: string (REQUIRED - hero image URL from the provided assets)
- imageMobile: string (optional - mobile version of image)
- title: string (REQUIRED - main headline, max 10 words)
- subtitle: string (sub-headline, max 25 words)
- buttonText: string (CTA button text, e.g. "Comprar Agora")
- buttonUrl: string (link, e.g. "#oferta" or checkout URL)
- backgroundColor: string (hex - used as fallback if no image)
- textColor: string (hex - text color for overlay, default "#ffffff")
- buttonColor: string (hex - button background color)
- buttonTextColor: string (hex - button text color)
- alignment: "left" | "center" | "right"
- overlayOpacity: number (0-100, darkness of overlay on image)
- height: "sm" | "md" | "lg" | "full" (banner height)

### info_highlights
Row of icon+text highlights (e.g., free shipping, secure payment).
Props:
- items: array of { icon: string, title: string, description?: string }
  - icon options: "Truck", "CreditCard", "Shield", "Clock", "Phone", "Gift", "Award", "ThumbsUp", "Star", "Heart", "Package", "Zap", "CheckCircle", "ShoppingBag", "Percent", "MapPin"
- iconColor: string (hex)
- textColor: string (hex)
- layout: "horizontal" | "vertical"

### content_columns
Image + Text side by side (split layout).
Props:
- title: string (section title)
- subtitle: string
- content: string (paragraph text)
- imageDesktop: string (image URL)
- imageMobile: string
- imagePosition: "left" | "right"
- features: array of { icon: string, text: string }
  - icon options: "Check", "CheckCircle", "Shield", "Zap", "Star", "Heart", "Award", "Truck", "Clock", "Gift", "Percent"
- iconColor: string (hex)
- showButton: boolean
- buttonText: string
- buttonUrl: string
- backgroundColor: string (hex)
- textColor: string (hex)

### feature_list
Vertical list of features with icons.
Props:
- title: string
- subtitle: string
- items: array of { icon: string, text: string }
  - icon options: same as content_columns
- iconColor: string (hex)
- textColor: string (hex)
- showButton: boolean
- buttonText: string
- buttonUrl: string
- backgroundColor: string (hex)

### testimonials
Customer testimonials/reviews.
Props:
- title: string (e.g. "O que dizem nossos clientes")
- items: array of { name: string, content: string, rating: number (1-5), role?: string, image?: string }
  - Use REAL review data when available
  - rating: integer 1-5
  - image: customer photo URL if available

### faq
Frequently Asked Questions accordion.
Props:
- title: string (e.g. "Perguntas Frequentes")
- items: array of { question: string, answer: string }

### pricing_table
Product pricing/offer cards.
Props:
- title: string (e.g. "Escolha seu Kit")
- subtitle: string
- layout: "cards" | "table" | "horizontal"
- plans: array of {
    name: string (product/kit name - EXACT name from data),
    description?: string,
    price: number (in BRL, e.g. 149.90),
    originalPrice?: number (compare_at_price for strikethrough),
    period?: string (e.g. "/un" or ""),
    features: array of { name: string, included: boolean | string },
    isPopular?: boolean (highlight this plan),
    buttonText?: string (e.g. "Comprar Agora"),
    buttonUrl?: string,
    icon?: "sparkles" | "zap" | "crown"
  }
  - CRITICAL: Use EXACT product names from the data provided
  - CRITICAL: Use EXACT prices from the data provided

### stats_numbers
Animated statistics/numbers.
Props:
- title: string
- subtitle: string
- items: array of { number: string, label: string, prefix?: string, suffix?: string }
  - e.g. { number: "10000", label: "Clientes Satisfeitos", suffix: "+" }
- layout: "horizontal" | "grid"
- animateNumbers: boolean (default true)
- backgroundColor: string (hex)
- accentColor: string (hex)
- textColor: string (hex)

### steps_timeline
Step-by-step process.
Props:
- title: string (e.g. "Como Funciona")
- subtitle: string
- steps: array of { title: string, description: string }
- layout: "horizontal" | "vertical"
- accentColor: string (hex)
- showNumbers: boolean (default true)
- backgroundColor: string (hex)

### image_gallery
Grid of images (social proof, results, etc.).
Props:
- title: string
- subtitle: string
- images: array of { src: string, alt?: string, caption?: string }
  - Use ONLY provided image URLs
- columns: 2 | 3 | 4
- gap: "sm" | "md" | "lg"
- enableLightbox: boolean
- aspectRatio: "square" | "4:3" | "16:9" | "auto"
- borderRadius: number (px)
- backgroundColor: string (hex)

### text_section
Rich text content section (wrapped in Section + Container).
Props:
- title: string (section heading)
- content: string (HTML allowed: <p>, <strong>, <em>, <ul>, <li>, <br>)
- align: "left" | "center" | "right"
- backgroundColor: string (hex)
- textColor: string (hex)

### button_cta
Standalone CTA button.
Props:
- text: string (button label)
- url: string (link URL)
- size: "sm" | "md" | "lg"
- alignment: "left" | "center" | "right"
- backgroundColor: string (hex - button bg)
- textColor: string (hex - button text)
- borderRadius: "none" | "sm" | "md" | "lg" | "full"

### spacer
Vertical spacing.
Props:
- height: "xs" | "sm" | "md" | "lg" | "xl"

### divider
Horizontal line separator.
Props:
- style: "solid" | "dashed" | "dotted"
- color: string (hex)
`;
}

// ========== BLOCK NODE ASSEMBLER ==========

let blockIdCounter = 0;
function generateBlockId(prefix: string): string {
  blockIdCounter++;
  return `${prefix}-${blockIdCounter}-${Date.now().toString(36)}`;
}

/**
 * Converts AI tool-calling output into a valid BlockNode tree
 * that can be rendered by PublicTemplateRenderer / BlockRenderer
 */
export function assembleBlockTree(
  toolOutput: {
    sections: Array<{ type: string; props: Record<string, unknown> }>;
    page_background_color?: string;
  }
): BlockNode {
  blockIdCounter = 0; // Reset for deterministic IDs

  const children: BlockNode[] = [];

  // Add Header block
  children.push({
    id: generateBlockId('header'),
    type: 'Header',
    props: {},
  });

  // Convert each section to BlockNode
  for (const section of toolOutput.sections) {
    const blockNode = sectionToBlockNode(section);
    if (blockNode) {
      children.push(blockNode);
    }
  }

  // Add Footer block
  children.push({
    id: generateBlockId('footer'),
    type: 'Footer',
    props: {},
  });

  // Root Page node
  return {
    id: 'root',
    type: 'Page',
    props: {
      backgroundColor: toolOutput.page_background_color || 'transparent',
    },
    children,
  };
}

/**
 * Maps a section from AI output to the corresponding BlockNode
 */
function sectionToBlockNode(section: { type: string; props: Record<string, unknown> }): BlockNode | null {
  const { type, props } = section;

  switch (type) {
    case 'hero_banner':
      return {
        id: generateBlockId('banner'),
        type: 'Banner',
        props: {
          mode: 'single',
          imageDesktop: props.imageDesktop || '',
          imageMobile: props.imageMobile || props.imageDesktop || '',
          title: props.title || '',
          subtitle: props.subtitle || '',
          buttonText: props.buttonText || '',
          buttonUrl: props.buttonUrl || '#',
          backgroundColor: props.backgroundColor || '#0a0a0a',
          textColor: props.textColor || '#ffffff',
          buttonColor: props.buttonColor,
          buttonTextColor: props.buttonTextColor,
          alignment: props.alignment || 'center',
          overlayOpacity: props.overlayOpacity ?? 40,
          height: props.height || 'lg',
          bannerWidth: 'full',
        },
      };

    case 'info_highlights':
      return wrapInSection({
        id: generateBlockId('highlights'),
        type: 'InfoHighlights',
        props: {
          items: props.items || [],
          iconColor: props.iconColor,
          textColor: props.textColor,
          layout: props.layout || 'horizontal',
        },
      }, props.backgroundColor as string);

    case 'content_columns':
      return wrapInSection({
        id: generateBlockId('columns'),
        type: 'ContentColumns',
        props: {
          title: props.title || '',
          subtitle: props.subtitle || '',
          content: props.content || '',
          imageDesktop: props.imageDesktop || '',
          imageMobile: props.imageMobile || '',
          imagePosition: props.imagePosition || 'right',
          features: props.features || [],
          iconColor: props.iconColor,
          showButton: props.showButton || false,
          buttonText: props.buttonText || '',
          buttonUrl: props.buttonUrl || '#',
          backgroundColor: props.backgroundColor || 'transparent',
          textColor: props.textColor,
        },
      }, props.backgroundColor as string);

    case 'feature_list':
      return wrapInSection({
        id: generateBlockId('features'),
        type: 'FeatureList',
        props: {
          title: props.title || '',
          subtitle: props.subtitle || '',
          items: props.items || [],
          iconColor: props.iconColor,
          textColor: props.textColor,
          showButton: props.showButton || false,
          buttonText: props.buttonText || '',
          buttonUrl: props.buttonUrl || '#',
          backgroundColor: props.backgroundColor || 'transparent',
        },
      }, props.backgroundColor as string);

    case 'testimonials':
      return wrapInSection({
        id: generateBlockId('testimonials'),
        type: 'Testimonials',
        props: {
          title: props.title || 'O que dizem nossos clientes',
          items: props.items || [],
        },
      }, props.backgroundColor as string);

    case 'faq':
      return wrapInSection({
        id: generateBlockId('faq'),
        type: 'FAQ',
        props: {
          title: props.title || 'Perguntas Frequentes',
          items: props.items || [],
        },
      }, props.backgroundColor as string);

    case 'pricing_table':
      return wrapInSection({
        id: generateBlockId('pricing'),
        type: 'PricingTable',
        props: {
          title: props.title || '',
          subtitle: props.subtitle || '',
          layout: props.layout || 'cards',
          plans: props.plans || [],
        },
      }, props.backgroundColor as string);

    case 'stats_numbers':
      return wrapInSection({
        id: generateBlockId('stats'),
        type: 'StatsNumbers',
        props: {
          title: props.title || '',
          subtitle: props.subtitle || '',
          items: props.items || [],
          layout: props.layout || 'horizontal',
          animateNumbers: props.animateNumbers ?? true,
          backgroundColor: props.backgroundColor || 'transparent',
          accentColor: props.accentColor,
          textColor: props.textColor,
        },
      }, props.backgroundColor as string);

    case 'steps_timeline':
      return wrapInSection({
        id: generateBlockId('steps'),
        type: 'StepsTimeline',
        props: {
          title: props.title || 'Como Funciona',
          subtitle: props.subtitle || '',
          steps: props.steps || [],
          layout: props.layout || 'horizontal',
          accentColor: props.accentColor,
          showNumbers: props.showNumbers ?? true,
          backgroundColor: props.backgroundColor || 'transparent',
        },
      }, props.backgroundColor as string);

    case 'image_gallery':
      return wrapInSection({
        id: generateBlockId('gallery'),
        type: 'ImageGallery',
        props: {
          title: props.title || '',
          subtitle: props.subtitle || '',
          images: props.images || [],
          columns: props.columns || 3,
          gap: props.gap || 'md',
          enableLightbox: props.enableLightbox ?? true,
          aspectRatio: props.aspectRatio || 'square',
          borderRadius: props.borderRadius ?? 8,
          backgroundColor: props.backgroundColor || 'transparent',
        },
      }, props.backgroundColor as string);

    case 'text_section': {
      const textContent = props.content
        ? `<h2>${props.title || ''}</h2>${props.content}`
        : `<h2>${props.title || ''}</h2><p>Conteúdo</p>`;
      return {
        id: generateBlockId('section'),
        type: 'Section',
        props: {
          backgroundColor: (props.backgroundColor as string) || 'transparent',
          paddingY: 48,
          paddingX: 16,
          fullWidth: false,
        },
        children: [
          {
            id: generateBlockId('container'),
            type: 'Container',
            props: { maxWidth: 'lg', padding: 16 },
            children: [
              {
                id: generateBlockId('text'),
                type: 'RichText',
                props: {
                  content: textContent,
                  align: props.align || 'left',
                  color: props.textColor,
                },
              },
            ],
          },
        ],
      };
    }

    case 'button_cta':
      return {
        id: generateBlockId('section'),
        type: 'Section',
        props: {
          backgroundColor: 'transparent',
          paddingY: 32,
          paddingX: 16,
          fullWidth: false,
        },
        children: [
          {
            id: generateBlockId('container'),
            type: 'Container',
            props: { maxWidth: 'lg', padding: 16 },
            children: [
              {
                id: generateBlockId('btn'),
                type: 'Button',
                props: {
                  text: props.text || 'Saiba Mais',
                  url: props.url || '#',
                  size: props.size || 'lg',
                  alignment: props.alignment || 'center',
                  backgroundColor: props.backgroundColor,
                  textColor: props.textColor,
                  borderRadius: props.borderRadius || 'md',
                },
              },
            ],
          },
        ],
      };

    case 'spacer':
      return {
        id: generateBlockId('spacer'),
        type: 'Spacer',
        props: {
          height: props.height || 'md',
        },
      };

    case 'divider':
      return {
        id: generateBlockId('divider'),
        type: 'Divider',
        props: {
          style: props.style || 'solid',
          color: props.color || '#e5e7eb',
        },
      };

    default:
      console.warn(`[BlockAssembler] Unknown section type: ${type}, skipping`);
      return null;
  }
}

/**
 * Wraps a block in a Section container for consistent spacing
 */
function wrapInSection(block: BlockNode, backgroundColor?: string): BlockNode {
  return {
    id: generateBlockId('section'),
    type: 'Section',
    props: {
      backgroundColor: backgroundColor || 'transparent',
      paddingY: 48,
      paddingX: 16,
      fullWidth: false,
    },
    children: [block],
  };
}
