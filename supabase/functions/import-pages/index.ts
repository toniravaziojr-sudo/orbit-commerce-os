import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstitutionalPage {
  title: string;
  slug: string;
  url: string;
  source: 'footer' | 'header' | 'sitemap' | 'global';
}

interface ImportPagesRequest {
  tenantId: string;
  pages: InstitutionalPage[];
  platform?: string;
  storeUrl?: string;
  useAI?: boolean; // New: opt-in for AI analysis
}

// =============================================
// AI ANALYSIS INTEGRATION
// =============================================

interface AISection {
  order: number;
  blockType: string;
  props: Record<string, unknown>;
  htmlContent?: string;
  cssContent?: string;
  reasoning: string;
}

interface AIAnalysisResult {
  success: boolean;
  sections?: AISection[];
  pageComplexity?: string;
  summary?: string;
  error?: string;
  fallback?: boolean;
}

// Call ai-analyze-page edge function with timeout
async function analyzePageWithAI(
  html: string, 
  pageTitle: string, 
  pageUrl: string
): Promise<AIAnalysisResult> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[AI] Missing Supabase config');
      return { success: false, error: 'Missing config', fallback: true };
    }

    // Truncate HTML for faster AI processing (keep first 40k chars)
    const maxHtmlForAI = 40000;
    const truncatedHtml = html.length > maxHtmlForAI 
      ? html.substring(0, maxHtmlForAI)
      : html;
    
    console.log(`[AI] Calling ai-analyze-page for: ${pageTitle} (${truncatedHtml.length} chars)`);
    
    // Add 60 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-analyze-page`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html: truncatedHtml, pageTitle, pageUrl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI] API error: ${response.status}`, errorText);
        return { success: false, error: `API error ${response.status}`, fallback: true };
      }

      const data = await response.json();
      
      if (data.fallback || data.error) {
        console.warn(`[AI] Fallback needed: ${data.error}`);
        return { success: false, error: data.error, fallback: true };
      }

      console.log(`[AI] Success: ${data.sections?.length || 0} sections, complexity: ${data.pageComplexity}`);
      return {
        success: true,
        sections: data.sections,
        pageComplexity: data.pageComplexity,
        summary: data.summary,
      };
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[AI] Request timeout after 60s');
        return { success: false, error: 'Timeout after 60s', fallback: true };
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('[AI] Exception:', error);
    return { success: false, error: String(error), fallback: true };
  }
}

// Convert AI sections to BlockNode structure
function convertAISectionsToBlocks(sections: AISection[], supabase: any, tenantId: string): BlockNode[] {
  const blocks: BlockNode[] = [];

  // Sort by order
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  for (const section of sortedSections) {
    console.log(`[AI→BLOCK] Converting: ${section.blockType} - ${section.reasoning?.substring(0, 50)}`);

    switch (section.blockType) {
      case 'YouTubeVideo':
        blocks.push({
          id: generateBlockId('youtube'),
          type: 'YouTubeVideo',
          props: {
            title: section.props.title || '',
            youtubeUrl: section.props.youtubeUrl || section.props.url || '',
          },
          children: [],
        });
        break;

      case 'Image':
        blocks.push({
          id: generateBlockId('image'),
          type: 'Image',
          props: {
            imageDesktop: section.props.imageDesktop || section.props.src || '',
            imageMobile: section.props.imageMobile || '',
            alt: section.props.alt || 'Imagem',
            linkUrl: section.props.linkUrl || '',
            width: 'full',
            height: 'auto',
            objectFit: 'cover',
            objectPosition: 'center',
            aspectRatio: 'auto',
            rounded: 'none',
            shadow: 'none',
          },
          children: [],
        });
        break;

      case 'Button':
        blocks.push({
          id: generateBlockId('button'),
          type: 'Button',
          props: {
            text: section.props.text || 'Clique aqui',
            url: section.props.url || '#',
            variant: section.props.variant || 'primary',
            size: section.props.size || 'md',
          },
          children: [],
        });
        break;

      case 'Hero':
        blocks.push({
          id: generateBlockId('hero'),
          type: 'Hero',
          props: {
            title: section.props.title || '',
            subtitle: section.props.subtitle || '',
            buttonText: section.props.buttonText || '',
            buttonUrl: section.props.buttonUrl || '',
            backgroundImage: section.props.backgroundImage || '',
            backgroundColor: section.props.backgroundColor || '',
          },
          children: [],
        });
        break;

      case 'FAQ':
        blocks.push({
          id: generateBlockId('faq'),
          type: 'FAQ',
          props: {
            title: section.props.title || 'Perguntas Frequentes',
            titleAlign: 'left',
            items: Array.isArray(section.props.items) ? section.props.items : [],
            allowMultiple: false,
          },
          children: [],
        });
        break;

      case 'Testimonials':
        blocks.push({
          id: generateBlockId('testimonials'),
          type: 'Testimonials',
          props: {
            title: section.props.title || 'Depoimentos',
            items: Array.isArray(section.props.items) ? section.props.items : [],
          },
          children: [],
        });
        break;

      case 'RichText':
        blocks.push({
          id: generateBlockId('richtext'),
          type: 'RichText',
          props: {
            content: section.props.content || section.htmlContent || '<p>Conteúdo</p>',
            fontFamily: 'inherit',
            fontSize: 'base',
            fontWeight: 'normal',
          },
          children: [],
        });
        break;

      case 'CustomBlock':
        // For CustomBlock, we create a special block that CustomBlockRenderer can handle
        if (section.htmlContent) {
          blocks.push({
            id: generateBlockId('customblock'),
            type: 'CustomBlock',
            props: {
              htmlContent: section.htmlContent,
              cssContent: section.cssContent || '',
              blockName: section.props.blockName || 'Conteúdo Personalizado',
            },
            children: [],
          });
        } else {
          console.warn('[AI→BLOCK] CustomBlock without htmlContent, using RichText fallback');
          blocks.push({
            id: generateBlockId('richtext'),
            type: 'RichText',
            props: {
              content: '<p>Seção importada</p>',
              fontFamily: 'inherit',
              fontSize: 'base',
              fontWeight: 'normal',
            },
            children: [],
          });
        }
        break;

      case 'Section':
        // Section is a container, create with children if any
        blocks.push({
          id: generateBlockId('section'),
          type: 'Section',
          props: {
            backgroundColor: section.props.backgroundColor || 'transparent',
            paddingX: 16,
            paddingY: 32,
            marginTop: 0,
            marginBottom: 0,
            gap: 24,
            alignItems: 'stretch',
            fullWidth: false,
          },
          children: [],
        });
        break;

      default:
        // Unknown block type - fallback to RichText with content
        console.warn(`[AI→BLOCK] Unknown type: ${section.blockType}, using RichText`);
        if (section.htmlContent) {
          blocks.push({
            id: generateBlockId('richtext'),
            type: 'RichText',
            props: {
              content: section.htmlContent,
              fontFamily: 'inherit',
              fontSize: 'base',
              fontWeight: 'normal',
            },
            children: [],
          });
        }
        break;
    }
  }

  return blocks;
}

// Create page structure from AI analysis
function createPageFromAIAnalysis(sections: AISection[], pageTitle: string, supabase: any, tenantId: string): BlockNode {
  const contentBlocks = convertAISectionsToBlocks(sections, supabase, tenantId);
  
  return {
    id: generateBlockId('page'),
    type: 'Page',
    props: { backgroundColor: 'transparent', padding: 'none' },
    children: [{
      id: generateBlockId('section'),
      type: 'Section',
      props: { 
        backgroundColor: 'transparent', 
        paddingX: 16, 
        paddingY: 32, 
        marginTop: 0, 
        marginBottom: 0, 
        gap: 24, 
        alignItems: 'stretch', 
        fullWidth: false 
      },
      children: contentBlocks,
    }],
  };
}

// =============================================
// CONTENT-TO-BLOCK MAPPER v3 - Fallback (Regex-based)
// Enhanced extraction with 6 strategies for FAQ, 
// improved Testimonials and InfoHighlights detection
// =============================================

interface FAQItem {
  question: string;
  answer: string;
}

interface TestimonialItem {
  name: string;
  text: string;
  rating?: number;
}

interface InfoHighlightItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: BlockNode[];
}

// Generate unique block ID
function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Clean text by removing extra whitespace and HTML entities
function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip all HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// =====================================================
// FAQ EXTRACTION - Enhanced with 6 strategies
// =====================================================
function extractFAQItems(html: string): { items: FAQItem[]; title: string; remainingHtml: string } {
  const items: FAQItem[] = [];
  let title = 'Perguntas Frequentes';
  let remainingHtml = html;
  const plainText = stripHtml(html);

  console.log(`[FAQ] Starting extraction, HTML: ${html.length} chars, Text: ${plainText.length} chars`);

  // Find FAQ title
  const faqTitlePatterns = [
    /<h[1-6][^>]*>([^<]*(?:perguntas?\s*frequentes?|faq|dúvidas?\s*comuns?)[^<]*)<\/h[1-6]>/gi,
    /<strong>([^<]*(?:perguntas?\s*frequentes?|faq)[^<]*)<\/strong>/gi,
  ];

  for (const pattern of faqTitlePatterns) {
    const match = pattern.exec(html);
    if (match) {
      title = cleanText(match[1].replace(/\s*\(FAQ\)\s*/gi, '')) || title;
      console.log(`[FAQ] Found title: ${title}`);
      break;
    }
  }

  // Helper to add unique item
  const addUniqueItem = (question: string, answer: string, source: string) => {
    question = cleanText(question);
    answer = cleanText(answer);
    
    if (question.length < 10 || answer.length < 15) return false;
    if (!question.includes('?')) return false;
    
    const isDuplicate = items.some(i => {
      const q1 = i.question.toLowerCase().substring(0, 30);
      const q2 = question.toLowerCase().substring(0, 30);
      return q1 === q2 || i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20));
    });
    
    if (isDuplicate) return false;
    
    items.push({ question, answer });
    console.log(`[FAQ] Added (${source}): "${question.substring(0, 50)}..."`);
    return true;
  };

  // ===== STRATEGY 1: Numbered Q&A pairs in plain text =====
  console.log(`[FAQ] Strategy 1: Numbered Q&A`);
  const numberedSections = plainText.split(/(?=\d+\.\s+[A-ZÀ-Ú])/);
  
  for (const section of numberedSections) {
    const match = /^(\d+)\.\s*(.+?\?)\s*(.+)$/s.exec(section.trim());
    if (match) {
      let question = match[2].trim();
      let answer = match[3].trim();
      
      const questionParts = question.match(/[^?]+\?/g);
      if (questionParts && questionParts.length > 1) {
        question = questionParts[0].trim();
        answer = questionParts.slice(1).join(' ').trim() + ' ' + answer;
      }
      
      const cutPoints = [
        answer.search(/\s+\d+\.\s+[A-ZÀ-Ú]/),
        answer.search(/\s+[A-ZÀ-Ú]{4,}\s+[&E]\s+[A-ZÀ-Ú]{4,}/),
      ].filter(p => p > 50);
      
      if (cutPoints.length > 0) {
        answer = answer.substring(0, Math.min(...cutPoints)).trim();
      }
      
      addUniqueItem(question, answer, 'numbered');
    }
  }

  // ===== STRATEGY 2: <details>/<summary> HTML accordions =====
  console.log(`[FAQ] Strategy 2: Details/Summary`);
  const detailsPattern = /<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;
  let match;
  
  while ((match = detailsPattern.exec(html)) !== null) {
    const question = stripHtml(match[1]).trim();
    const answer = stripHtml(match[2]).trim();
    if (/^[A-ZÀ-Ú\s&]+$/.test(question)) continue;
    addUniqueItem(question, answer, 'details');
  }

  // ===== STRATEGY 3: Shopify collapsible patterns =====
  console.log(`[FAQ] Strategy 3: Collapsible divs`);
  const collapsiblePatterns = [
    /<div[^>]*class="[^"]*collapsible[^"]*"[^>]*>[\s\S]*?<(?:button|summary)[^>]*>([^<]+)<\/(?:button|summary)>[\s\S]*?<div[^>]*class="[^"]*(?:content|body|panel)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*accordion[^"]*"[^>]*>[\s\S]*?<(?:button|h[3-6])[^>]*>([^<]+)<\/(?:button|h[3-6])>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/gi,
  ];
  
  for (const pattern of collapsiblePatterns) {
    while ((match = pattern.exec(html)) !== null) {
      const question = stripHtml(match[1]).trim();
      const answer = stripHtml(match[2]).trim();
      if (/^[A-ZÀ-Ú\s&]+$/.test(question) && !question.includes('?')) continue;
      addUniqueItem(question, answer, 'collapsible');
    }
  }

  // ===== STRATEGY 4: Bold questions with text answers =====
  console.log(`[FAQ] Strategy 4: Bold Q&A`);
  const boldPatterns = [
    /<(?:strong|b)>\s*\d*\.?\s*([^<]*\?)<\/(?:strong|b)>\s*(?:<br\s*\/?>|<\/p>\s*<p>)?\s*([^<]+)/gi,
    /<(?:strong|b)>([^<]*\?)<\/(?:strong|b)>(?:<\/p>)?\s*<p>([^<]+)/gi,
  ];
  
  for (const pattern of boldPatterns) {
    while ((match = pattern.exec(html)) !== null) {
      addUniqueItem(match[1].trim(), match[2].trim(), 'bold');
    }
  }

  // ===== STRATEGY 5: Headings with questions =====
  console.log(`[FAQ] Strategy 5: Heading Q&A`);
  const headingQAPattern = /<h[3-6][^>]*>([^<]*\?)<\/h[3-6]>\s*(?:<[^>]+>)*\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = headingQAPattern.exec(html)) !== null) {
    addUniqueItem(match[1].trim(), stripHtml(match[2]).trim(), 'heading');
  }

  // ===== STRATEGY 6: Div-based FAQ structures =====
  console.log(`[FAQ] Strategy 6: FAQ divs`);
  const divFAQPattern = /<div[^>]*class="[^"]*(?:faq-item|question-item|pergunta)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  while ((match = divFAQPattern.exec(html)) !== null) {
    const content = match[1];
    const questionMatch = /<(?:h[3-6]|strong|span[^>]*class="[^"]*question)[^>]*>([^<]+)</i.exec(content);
    const answerMatch = /<(?:p|div[^>]*class="[^"]*answer)[^>]*>([\s\S]+?)<\/(?:p|div)>/i.exec(content);
    if (questionMatch && answerMatch) {
      addUniqueItem(questionMatch[1], stripHtml(answerMatch[1]), 'divFAQ');
    }
  }

  console.log(`[FAQ] Total unique items: ${items.length}`);

  if (items.length >= 2) {
    remainingHtml = remainingHtml.replace(/<(?:section|div)[^>]*>[\s\S]*?(?:perguntas?\s*frequentes?|faq)[\s\S]*?<\/(?:section|div)>/gi, '');
  }

  return { items, title, remainingHtml };
}

// =====================================================
// TESTIMONIALS EXTRACTION - Enhanced
// =====================================================
function extractTestimonials(html: string): { items: TestimonialItem[]; title: string; remainingHtml: string } {
  const items: TestimonialItem[] = [];
  let title = 'Depoimentos';
  let remainingHtml = html;
  let match;

  console.log(`[TESTIMONIALS] Starting extraction`);

  const titlePatterns = [
    /<h[1-6][^>]*>([^<]*(?:depoimentos?|avalia[çc][õo]es?|feedback|o\s+que\s+dizem)[^<]*)<\/h[1-6]>/gi,
  ];

  for (const pattern of titlePatterns) {
    match = pattern.exec(html);
    if (match) { title = cleanText(match[1]) || title; break; }
  }

  const addUniqueItem = (name: string, text: string, rating: number, source: string) => {
    name = cleanText(name);
    text = cleanText(text);
    if (text.length < 20) return false;
    if (items.some(i => i.text.substring(0, 30) === text.substring(0, 30))) return false;
    items.push({ name: name || 'Cliente', text, rating });
    console.log(`[TESTIMONIALS] Added (${source}): "${text.substring(0, 40)}..." - ${name}`);
    return true;
  };

  // Strategy 1: Blockquotes
  const blockquotePattern = /<blockquote[^>]*>\s*(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?\s*(?:<cite[^>]*>|<footer[^>]*>|—|-)?\s*([^<]*)?<\/(?:cite|footer|blockquote)>/gi;
  while ((match = blockquotePattern.exec(html)) !== null) {
    addUniqueItem(stripHtml(match[2] || ''), stripHtml(match[1]), 5, 'blockquote');
  }

  // Strategy 2: Testimonial divs
  const testimonialDivPatterns = [
    /<div[^>]*class="[^"]*(?:testimonial|depoimento|review|avaliacao|feedback)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];
  for (const pattern of testimonialDivPatterns) {
    while ((match = pattern.exec(html)) !== null) {
      const content = match[1];
      const textMatch = /<p[^>]*>([\s\S]+?)<\/p>/i.exec(content);
      let name = '';
      const namePatterns = [/(?:—|-|by|por)\s*([^<]+)/i, /<(?:strong|b|cite)[^>]*>([^<]+)<\/(?:strong|b|cite)>/i];
      for (const np of namePatterns) { const nm = np.exec(content); if (nm) { name = nm[1]; break; } }
      if (textMatch) addUniqueItem(name, stripHtml(textMatch[1]), 5, 'testimonialDiv');
    }
  }

  console.log(`[TESTIMONIALS] Total: ${items.length}`);

  if (items.length >= 2) {
    remainingHtml = remainingHtml.replace(/<(?:section|div)[^>]*class="[^"]*(?:testimonial|depoimento|review|feedback)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi, '');
  }

  return { items, title, remainingHtml };
}

// =====================================================
// INFO HIGHLIGHTS EXTRACTION - Enhanced
// =====================================================
function extractInfoHighlights(html: string): { items: InfoHighlightItem[]; remainingHtml: string } {
  const items: InfoHighlightItem[] = [];
  const remainingHtml = html;
  const textContent = stripHtml(html).toLowerCase();

  console.log(`[INFO] Starting extraction`);

  const infoPatterns = [
    { patterns: [/frete\s*gr[áa]tis/i, /entrega\s*r[áa]pida/i, /envio\s*(?:em\s*)?\d+/i], icon: 'Truck', title: 'Entrega', defaultDesc: 'Entrega rápida e segura' },
    { patterns: [/site\s*seguro/i, /compra\s*segura/i, /cnpj\s*ativo/i], icon: 'Shield', title: 'Segurança', defaultDesc: 'Compra 100% segura' },
    { patterns: [/parcel(?:amento|e)\s*(?:em\s*)?\d+x/i, /at[ée]\s*\d+x\s*sem\s*juros/i, /pix/i, /boleto/i], icon: 'CreditCard', title: 'Pagamento', defaultDesc: 'Diversas formas de pagamento' },
    { patterns: [/atendimento/i, /suporte/i, /whatsapp/i], icon: 'Headphones', title: 'Atendimento', defaultDesc: 'Suporte ao cliente' },
    { patterns: [/garantia\s*(?:de\s*)?\d+/i, /troca\s*gr[áa]tis/i, /devolu[çc][ãa]o/i], icon: 'Award', title: 'Garantia', defaultDesc: 'Garantia de satisfação' },
  ];

  let idCounter = 1;
  for (const { patterns, icon, title, defaultDesc } of infoPatterns) {
    for (const pattern of patterns) {
      const match = pattern.exec(textContent);
      if (match) {
        const matchIndex = textContent.indexOf(match[0].toLowerCase());
        let context = textContent.substring(matchIndex, Math.min(textContent.length, matchIndex + match[0].length + 60));
        const periodIdx = context.indexOf('.');
        if (periodIdx > 10) context = context.substring(0, periodIdx);
        const description = cleanText(context.charAt(0).toUpperCase() + context.slice(1)) || defaultDesc;
        
        if (!items.some(i => i.title === title)) {
          items.push({ id: String(idCounter++), icon, title, description: description.length > 100 ? description.substring(0, 100) + '...' : description });
          console.log(`[INFO] Added: ${title}`);
        }
        break;
      }
    }
  }

  console.log(`[INFO] Total: ${items.length}`);
  if (items.length < 3) return { items: [], remainingHtml };
  return { items, remainingHtml };
}

// =====================================================
// IMAGE EXTRACTION - Convert <img> to Image blocks
// =====================================================
interface ExtractedImage {
  src: string;
  alt: string;
  linkUrl?: string;
  width?: string;
  height?: string;
}

function extractImages(html: string): { images: ExtractedImage[]; remainingHtml: string } {
  const images: ExtractedImage[] = [];
  let remainingHtml = html;
  const addedSrcs = new Set<string>();

  console.log(`[IMAGES] Starting extraction`);

  // Skip patterns - icons, very small images, tracking pixels
  const skipPatterns = [
    /icon/i, /logo/i, /favicon/i, /sprite/i, /badge/i, /payment/i, /flag/i,
    /1x1\.gif/i, /pixel/i, /tracking/i, /spacer/i, /blank\./i,
    /data:image\/svg/i, /\.svg$/i,
  ];

  const isValidImage = (src: string, width?: string, height?: string): boolean => {
    if (!src || src.length < 10) return false;
    if (skipPatterns.some(p => p.test(src))) return false;
    
    // Skip very small images (icons, spacers)
    const w = width ? parseInt(width) : 0;
    const h = height ? parseInt(height) : 0;
    if ((w > 0 && w < 50) || (h > 0 && h < 50)) return false;
    
    return true;
  };

  // Pattern 1: <img> tags
  const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = imgPattern.exec(html)) !== null) {
    const fullTag = match[0];
    const src = match[1];
    
    // Extract alt text
    const altMatch = /alt=["']([^"']*)["']/i.exec(fullTag);
    const alt = altMatch ? cleanText(altMatch[1]) : '';
    
    // Extract dimensions
    const widthMatch = /width=["']?(\d+)/i.exec(fullTag);
    const heightMatch = /height=["']?(\d+)/i.exec(fullTag);
    
    if (!isValidImage(src, widthMatch?.[1], heightMatch?.[1])) continue;
    if (addedSrcs.has(src)) continue;
    
    // Check if image is wrapped in a link
    const imgIndex = match.index;
    const contextStart = Math.max(0, imgIndex - 200);
    const contextBefore = html.substring(contextStart, imgIndex);
    const linkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>[^<]*$/i.exec(contextBefore);
    const linkUrl = linkMatch?.[1];
    
    images.push({
      src,
      alt,
      linkUrl: linkUrl && !linkUrl.startsWith('javascript:') && linkUrl !== '#' ? linkUrl : undefined,
      width: widthMatch?.[1],
      height: heightMatch?.[1],
    });
    addedSrcs.add(src);
    
    // Remove the image tag from remaining HTML
    remainingHtml = remainingHtml.replace(fullTag, '');
  }

  // Pattern 2: <picture> elements
  const picturePattern = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;
  while ((match = picturePattern.exec(html)) !== null) {
    const pictureHtml = match[1];
    
    // Get the main image
    const mainImgMatch = /<img[^>]*src=["']([^"']+)["'][^>]*>/i.exec(pictureHtml);
    if (!mainImgMatch) continue;
    
    const src = mainImgMatch[1];
    if (!isValidImage(src) || addedSrcs.has(src)) continue;
    
    const altMatch = /alt=["']([^"']*)["']/i.exec(pictureHtml);
    const alt = altMatch ? cleanText(altMatch[1]) : '';
    
    images.push({ src, alt });
    addedSrcs.add(src);
    
    // Remove the picture element from remaining HTML
    remainingHtml = remainingHtml.replace(match[0], '');
  }

  // Pattern 3: Background images in style attributes (for hero/banner sections)
  const bgPattern = /style=["'][^"']*background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)[^"']*["']/gi;
  while ((match = bgPattern.exec(html)) !== null) {
    const src = match[1];
    if (!isValidImage(src) || addedSrcs.has(src)) continue;
    
    images.push({ src, alt: '' });
    addedSrcs.add(src);
  }

  console.log(`[IMAGES] Total: ${images.length}`);
  return { images, remainingHtml };
}

// =====================================================
// VIDEO EXTRACTION - Convert videos to Video blocks
// =====================================================
interface ExtractedVideo {
  type: 'youtube' | 'vimeo' | 'upload';
  url: string;
  embedUrl?: string;
  videoId?: string;
  title?: string;
}

function extractVideos(html: string): { videos: ExtractedVideo[]; remainingHtml: string } {
  const videos: ExtractedVideo[] = [];
  let remainingHtml = html;
  const addedIds = new Set<string>();

  console.log(`[VIDEOS] Starting extraction`);

  // Pattern 1: YouTube iframes
  const youtubeIframePattern = /<iframe[^>]*src=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["'][^>]*>[\s\S]*?<\/iframe>/gi;
  let match;
  
  while ((match = youtubeIframePattern.exec(html)) !== null) {
    const embedUrl = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
    const videoIdMatch = /(?:embed\/|watch\?v=|youtu\.be\/)([^&?/]+)/.exec(embedUrl);
    
    if (videoIdMatch && !addedIds.has(videoIdMatch[1])) {
      videos.push({
        type: 'youtube',
        url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
        embedUrl: `https://www.youtube.com/embed/${videoIdMatch[1]}`,
        videoId: videoIdMatch[1],
      });
      addedIds.add(videoIdMatch[1]);
      remainingHtml = remainingHtml.replace(match[0], '');
    }
  }

  // Pattern 2: YouTube links (not in iframes)
  const youtubeLinkPattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;
  while ((match = youtubeLinkPattern.exec(html)) !== null) {
    const videoId = match[1];
    if (!addedIds.has(videoId)) {
      videos.push({
        type: 'youtube',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        videoId,
      });
      addedIds.add(videoId);
    }
  }

  // Pattern 3: Vimeo iframes
  const vimeoIframePattern = /<iframe[^>]*src=["']([^"']*vimeo\.com[^"']*)["'][^>]*>[\s\S]*?<\/iframe>/gi;
  while ((match = vimeoIframePattern.exec(html)) !== null) {
    const embedUrl = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
    const videoIdMatch = /vimeo\.com\/(?:video\/)?(\d+)/.exec(embedUrl);
    
    if (videoIdMatch && !addedIds.has(videoIdMatch[1])) {
      videos.push({
        type: 'vimeo',
        url: `https://vimeo.com/${videoIdMatch[1]}`,
        embedUrl: `https://player.vimeo.com/video/${videoIdMatch[1]}`,
        videoId: videoIdMatch[1],
      });
      addedIds.add(videoIdMatch[1]);
      remainingHtml = remainingHtml.replace(match[0], '');
    }
  }

  // Pattern 4: Direct video files (<video> or <source> tags)
  const videoFilePattern = /<video[^>]*(?:src=["']([^"']+\.(?:mp4|webm|mov))["'])?[^>]*>([\s\S]*?)<\/video>/gi;
  while ((match = videoFilePattern.exec(html)) !== null) {
    let videoUrl = match[1];
    
    // If no src on video tag, look for source element
    if (!videoUrl && match[2]) {
      const sourceMatch = /<source[^>]*src=["']([^"']+\.(?:mp4|webm|mov))["'][^>]*>/i.exec(match[2]);
      if (sourceMatch) videoUrl = sourceMatch[1];
    }
    
    if (videoUrl && !addedIds.has(videoUrl)) {
      videos.push({
        type: 'upload',
        url: videoUrl,
      });
      addedIds.add(videoUrl);
      remainingHtml = remainingHtml.replace(match[0], '');
    }
  }

  console.log(`[VIDEOS] Total: ${videos.length}`);
  return { videos, remainingHtml };
}

// =====================================================
// MAIN MAPPING FUNCTION - Enhanced with Images & Videos
// =====================================================
function analyzeAndMapContent(html: string, pageTitle: string): BlockNode[] {
  const blocks: BlockNode[] = [];

  console.log(`[MAPPER] ========================================`);
  console.log(`[MAPPER] Analyzing: "${pageTitle}", HTML: ${html.length} chars`);

  // =====================================================
  // NEW STRATEGY: Detect complex patterns FIRST
  // If the page has complex visual structure, preserve it as CustomBlock
  // instead of fragmenting into individual elements
  // =====================================================

  const patternInfo = detectComplexPattern(html);
  const hasMultipleVideos = (html.match(/youtube\.com|youtu\.be|vimeo\.com/gi) || []).length >= 2;
  const hasMultipleImages = (html.match(/<img/gi) || []).length >= 4;
  const hasSliderOrCarousel = /swiper|slider|carousel|glide|slick|splide|owl|flickity/i.test(html);

  // If the page has complex interactive elements OR multiple media in structured layout,
  // create a single CustomBlock to preserve the visual structure
  if (patternInfo.isComplex && patternInfo.confidence >= 0.7) {
    console.log(`[MAPPER] ⚡ Complex pattern detected: ${patternInfo.patternName} (${Math.round(patternInfo.confidence * 100)}% confidence)`);
    console.log(`[MAPPER] → Creating CustomBlock to preserve visual structure`);
    
    blocks.push({
      id: generateBlockId('customblock-pending'),
      type: '__CustomBlockPending__',
      props: { 
        htmlContent: html.trim(),
        patternType: patternInfo.patternType,
        patternName: patternInfo.patternName,
        confidence: patternInfo.confidence,
      },
      children: [],
    });

    console.log(`[MAPPER] Result: 1 CustomBlock (${patternInfo.patternName})`);
    console.log(`[MAPPER] ========================================`);
    return blocks;
  }

  // If multiple media elements detected in a complex layout, treat as custom block
  if ((hasMultipleVideos || hasMultipleImages) && hasSliderOrCarousel) {
    console.log(`[MAPPER] ⚡ Multiple media + slider detected - preserving as CustomBlock`);
    
    const blockName = hasMultipleVideos ? 'Galeria de Vídeos' : 'Galeria de Mídia';
    blocks.push({
      id: generateBlockId('customblock-pending'),
      type: '__CustomBlockPending__',
      props: { 
        htmlContent: html.trim(),
        patternType: hasMultipleVideos ? 'video_gallery' : 'media_gallery',
        patternName: blockName,
        confidence: 0.85,
      },
      children: [],
    });

    console.log(`[MAPPER] Result: 1 CustomBlock (${blockName})`);
    console.log(`[MAPPER] ========================================`);
    return blocks;
  }

  // =====================================================
  // SIMPLE CONTENT PATH: Only for truly simple pages
  // Extract individual elements only when page is not complex
  // =====================================================

  console.log(`[MAPPER] Simple content path - extracting individual elements`);

  const isFAQPage = /perguntas?\s*frequentes?|faq|dúvidas?/i.test(pageTitle);
  const isTestimonialPage = /depoimentos?|avalia[çc][õo]es?/i.test(pageTitle);
  let remainingContent = html;

  // 1. FAQ - high priority for FAQ pages
  const faqResult = extractFAQItems(remainingContent);
  if (faqResult.items.length >= 2 || (isFAQPage && faqResult.items.length >= 1)) {
    console.log(`[MAPPER] ✓ Creating FAQ block: ${faqResult.items.length} items`);
    blocks.push({
      id: generateBlockId('faq'),
      type: 'FAQ',
      props: { title: faqResult.title, titleAlign: 'left', items: faqResult.items, allowMultiple: false },
      children: [],
    });
    remainingContent = faqResult.remainingHtml;
  }

  // 2. Testimonials - high priority for testimonial pages
  const testimonialResult = extractTestimonials(remainingContent);
  if (testimonialResult.items.length >= 2 || (isTestimonialPage && testimonialResult.items.length >= 1)) {
    console.log(`[MAPPER] ✓ Creating Testimonials block: ${testimonialResult.items.length} items`);
    blocks.push({
      id: generateBlockId('testimonials'),
      type: 'Testimonials',
      props: { title: testimonialResult.title, items: testimonialResult.items },
      children: [],
    });
    remainingContent = testimonialResult.remainingHtml;
  }

  // 3. InfoHighlights
  const infoResult = extractInfoHighlights(remainingContent);
  if (infoResult.items.length >= 3) {
    console.log(`[MAPPER] ✓ Creating InfoHighlights block: ${infoResult.items.length} items`);
    blocks.push({
      id: generateBlockId('info'),
      type: 'InfoHighlights',
      props: { items: infoResult.items, layout: 'horizontal' },
      children: [],
    });
    remainingContent = infoResult.remainingHtml;
  }

  // 4. For simple pages with single video, create YouTube block
  const videoResult = extractVideos(remainingContent);
  if (videoResult.videos.length === 1) {
    const video = videoResult.videos[0];
    if (video.type === 'youtube') {
      console.log(`[MAPPER] ✓ Creating single YouTubeVideo block`);
      blocks.push({
        id: generateBlockId('youtube'),
        type: 'YouTubeVideo',
        props: { title: '', youtubeUrl: video.url },
        children: [],
      });
      remainingContent = videoResult.remainingHtml;
    }
  } else if (videoResult.videos.length > 1) {
    // Multiple videos - better as CustomBlock
    console.log(`[MAPPER] Multiple videos (${videoResult.videos.length}) - creating CustomBlock`);
    blocks.push({
      id: generateBlockId('customblock-pending'),
      type: '__CustomBlockPending__',
      props: { 
        htmlContent: html.trim(), // Keep original HTML with all videos
        patternType: 'video_gallery',
        patternName: 'Galeria de Vídeos',
        confidence: 0.8,
      },
      children: [],
    });
    console.log(`[MAPPER] Result: ${blocks.length} blocks`);
    console.log(`[MAPPER] ========================================`);
    return blocks; // Return early, don't fragment further
  }

  // 5. For simple pages with few images, create Image blocks
  const imageResult = extractImages(remainingContent);
  if (imageResult.images.length === 1) {
    const image = imageResult.images[0];
    console.log(`[MAPPER] ✓ Creating single Image block`);
    blocks.push({
      id: generateBlockId('image'),
      type: 'Image',
      props: { 
        imageDesktop: image.src,
        imageMobile: '',
        alt: image.alt || 'Imagem',
        linkUrl: image.linkUrl || '',
        width: 'full',
        height: 'auto',
        objectFit: 'cover',
        objectPosition: 'center',
        aspectRatio: 'auto',
        rounded: 'none',
        shadow: 'none',
      },
      children: [],
    });
    remainingContent = imageResult.remainingHtml;
  } else if (imageResult.images.length > 3) {
    // Many images - better as CustomBlock
    console.log(`[MAPPER] Multiple images (${imageResult.images.length}) - creating CustomBlock`);
    blocks.push({
      id: generateBlockId('customblock-pending'),
      type: '__CustomBlockPending__',
      props: { 
        htmlContent: html.trim(),
        patternType: 'image_gallery',
        patternName: 'Galeria de Imagens',
        confidence: 0.75,
      },
      children: [],
    });
    console.log(`[MAPPER] Result: ${blocks.length} blocks`);
    console.log(`[MAPPER] ========================================`);
    return blocks;
  }

  // 6. Remaining text content as RichText
  const cleanedRemaining = stripHtml(remainingContent);
  if (cleanedRemaining.length > 50) {
    console.log(`[MAPPER] Adding RichText: ${cleanedRemaining.length} chars`);
    blocks.push({
      id: generateBlockId('richtext'),
      type: 'RichText',
      props: { content: remainingContent.trim() || '<p>Conteúdo da página...</p>', fontFamily: 'inherit', fontSize: 'base', fontWeight: 'normal' },
      children: [],
    });
  }

  // If no blocks at all, add a RichText with original content
  if (blocks.length === 0) {
    blocks.push({
      id: generateBlockId('richtext'),
      type: 'RichText',
      props: { content: html || '<p>Conteúdo da página...</p>', fontFamily: 'inherit', fontSize: 'base', fontWeight: 'normal' },
      children: [],
    });
  }

  console.log(`[MAPPER] Result: ${blocks.length} blocks - ${blocks.map(b => b.type).join(', ')}`);
  console.log(`[MAPPER] ========================================`);
  return blocks;
}

function createPageWithMappedBlocks(html: string, pageTitle: string): BlockNode {
  const contentBlocks = analyzeAndMapContent(html, pageTitle);
  return {
    id: generateBlockId('page'),
    type: 'Page',
    props: { backgroundColor: 'transparent', padding: 'none' },
    children: [{
      id: generateBlockId('section'),
      type: 'Section',
      props: { backgroundColor: 'transparent', paddingX: 16, paddingY: 32, marginTop: 0, marginBottom: 0, gap: 24, alignItems: 'stretch', fullWidth: false },
      children: contentBlocks,
    }],
  };
}

// =============================================
// CUSTOM BLOCK FALLBACK - For complex HTML patterns
// =============================================

// Detect if remaining HTML has complex visual structure worth preserving
function detectComplexPattern(html: string): { 
  isComplex: boolean; 
  patternType: string; 
  confidence: number;
  patternName: string;
} {
  const trimmedHtml = html.trim();
  if (!trimmedHtml || trimmedHtml.length < 100) {
    return { isComplex: false, patternType: 'simple', confidence: 0, patternName: '' };
  }

  // Count structural indicators
  const divCount = (trimmedHtml.match(/<div/gi) || []).length;
  const classCount = (trimmedHtml.match(/class="/gi) || []).length;
  const styleCount = (trimmedHtml.match(/style="/gi) || []).length;
  const gridFlexCount = (trimmedHtml.match(/grid|flex|display:/gi) || []).length;
  const imgCount = (trimmedHtml.match(/<img/gi) || []).length;
  const nestedDivs = (trimmedHtml.match(/<div[^>]*>.*?<div/gi) || []).length;
  const iframeCount = (trimmedHtml.match(/<iframe/gi) || []).length;
  const youtubeCount = (trimmedHtml.match(/youtube\.com|youtu\.be/gi) || []).length;
  const vimeoCount = (trimmedHtml.match(/vimeo\.com/gi) || []).length;

  // Pattern detection
  const patterns: { type: string; name: string; score: number }[] = [];

  // ===== VIDEO PATTERNS (high priority) =====
  // Video carousel/slider: multiple videos with slider indicators
  const hasSliderIndicators = /swiper|slider|carousel|glide|slick|splide|owl|flickity/i.test(trimmedHtml);
  const multipleVideos = (youtubeCount + vimeoCount + iframeCount) >= 2;
  
  if (multipleVideos && hasSliderIndicators) {
    patterns.push({ type: 'video_carousel', name: 'Carrossel de Vídeos', score: 0.95 });
  } else if (multipleVideos && divCount >= 3) {
    // Multiple videos in grid/list layout
    patterns.push({ type: 'video_gallery', name: 'Galeria de Vídeos', score: 0.9 });
  }

  // Testimonial videos: depoimentos em vídeo
  if ((youtubeCount >= 1 || vimeoCount >= 1) && /depoimento|testemunho|cliente|feedback|review/i.test(trimmedHtml)) {
    patterns.push({ type: 'video_testimonials', name: 'Depoimentos em Vídeo', score: 0.92 });
  }

  // ===== SLIDER/CAROUSEL PATTERNS =====
  if (hasSliderIndicators && imgCount >= 2) {
    patterns.push({ type: 'image_carousel', name: 'Carrossel de Imagens', score: 0.85 });
  }
  if (hasSliderIndicators && divCount >= 3) {
    patterns.push({ type: 'content_slider', name: 'Slider de Conteúdo', score: 0.8 });
  }

  // ===== TABS PATTERN =====
  if (/tab-?content|tab-?panel|tabs|tabbed/i.test(trimmedHtml) || 
      (/role="tablist"|role="tabpanel"|aria-selected/i.test(trimmedHtml))) {
    patterns.push({ type: 'tabs', name: 'Conteúdo em Abas', score: 0.85 });
  }

  // ===== ACCORDION PATTERN (different from FAQ - visual accordion) =====
  if (/accordion|collapse|expandable/i.test(trimmedHtml) && !/faq|pergunta|d[úu]vida/i.test(trimmedHtml)) {
    patterns.push({ type: 'accordion', name: 'Accordion Visual', score: 0.8 });
  }

  // ===== BEFORE/AFTER PATTERN =====
  if (/antes.*depois|before.*after|compare|comparison/i.test(trimmedHtml)) {
    patterns.push({ type: 'before_after', name: 'Antes e Depois', score: 0.9 });
  }

  // ===== COUNTDOWN/TIMER PATTERN =====
  if (/countdown|timer|count-?down|tempo|restante|expire/i.test(trimmedHtml) && divCount >= 3) {
    patterns.push({ type: 'countdown', name: 'Contagem Regressiva', score: 0.85 });
  }

  // ===== CTA SECTION PATTERN =====
  if (/cta|call-to-action|comprar|assinar|cadastr/i.test(trimmedHtml) && 
      /<button|<a[^>]*class="[^"]*btn/i.test(trimmedHtml) && divCount >= 2) {
    patterns.push({ type: 'cta_section', name: 'Seção de CTA', score: 0.75 });
  }

  // Hero/Banner pattern: large container with background/image
  if (/hero|banner|jumbotron|cover/i.test(trimmedHtml) || 
      (imgCount >= 1 && divCount >= 3 && /background/i.test(trimmedHtml))) {
    patterns.push({ type: 'hero', name: 'Hero/Banner Section', score: 0.8 });
  }

  // Grid/Card layout: multiple similar items
  if (gridFlexCount >= 1 && divCount >= 4) {
    patterns.push({ type: 'grid', name: 'Grid/Card Layout', score: 0.7 });
  }

  // Feature section: icons + text blocks
  if (divCount >= 4 && (trimmedHtml.includes('svg') || trimmedHtml.includes('icon'))) {
    patterns.push({ type: 'features', name: 'Features Section', score: 0.7 });
  }

  // Gallery: multiple images
  if (imgCount >= 3 && !hasSliderIndicators) {
    patterns.push({ type: 'gallery', name: 'Image Gallery', score: 0.8 });
  }

  // Timeline/Steps: numbered or sequential content
  if (/step|timeline|processo|etapa|passo/i.test(trimmedHtml)) {
    patterns.push({ type: 'timeline', name: 'Timeline/Steps', score: 0.75 });
  }

  // Pricing table
  if (/pre[çc]o|price|plan|plano/i.test(trimmedHtml) && divCount >= 3) {
    patterns.push({ type: 'pricing', name: 'Pricing Table', score: 0.8 });
  }

  // Generic complex structure
  const complexityScore = (divCount * 0.1) + (classCount * 0.15) + (nestedDivs * 0.2) + (gridFlexCount * 0.3);
  if (complexityScore > 1.5) {
    patterns.push({ type: 'complex', name: 'Complex Layout', score: Math.min(complexityScore / 3, 0.9) });
  }

  // Return highest scoring pattern
  if (patterns.length > 0) {
    const best = patterns.sort((a, b) => b.score - a.score)[0];
    return { isComplex: true, patternType: best.type, confidence: best.score, patternName: best.name };
  }

  return { isComplex: false, patternType: 'simple', confidence: 0, patternName: '' };
}

// Generate a hash for pattern deduplication
function generatePatternHash(html: string): string {
  // Simple hash based on structure (tag sequence) rather than content
  const structureOnly = html
    .replace(/>[\s\S]*?</g, '><') // Remove text content
    .replace(/\s+/g, '') // Remove whitespace
    .replace(/id="[^"]*"/g, '') // Remove IDs
    .replace(/src="[^"]*"/g, 'src=""') // Normalize sources
    .slice(0, 500); // Take first 500 chars of structure

  // Simple hash
  let hash = 0;
  for (let i = 0; i < structureOnly.length; i++) {
    const char = structureOnly.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Create CustomBlock for complex pages - renders the actual imported HTML
// Uses CustomBlockRenderer which sanitizes and scopes CSS properly
async function createComplexPageBlocks(
  supabase: any,
  tenantId: string,
  html: string,
  sourceUrl: string,
  patternInfo: { patternType: string; patternName: string; confidence: number }
): Promise<BlockNode[]> {
  const blocks: BlockNode[] = [];
  
  try {
    console.log(`[IMPORT-BLOCK] Creating CustomBlock for: ${patternInfo.patternName}`);

    // Extract inline styles from the HTML for CSS isolation
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    let extractedCss = '';
    let cleanedHtml = html;
    
    for (const styleTag of styleMatches) {
      const cssMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(styleTag);
      if (cssMatch && cssMatch[1]) {
        extractedCss += cssMatch[1] + '\n';
      }
      cleanedHtml = cleanedHtml.replace(styleTag, '');
    }

    // Count detected elements for metadata
    const youtubeCount = (html.match(/youtube\.com|youtu\.be/gi) || []).length;
    const vimeoCount = (html.match(/vimeo\.com/gi) || []).length;
    const imageCount = (html.match(/<img/gi) || []).length;
    const hasSlider = /swiper|slider|carousel|glide|slick/i.test(html);

    const detectedElements: string[] = [];
    if (youtubeCount > 0) detectedElements.push(`${youtubeCount} vídeo(s) YouTube`);
    if (vimeoCount > 0) detectedElements.push(`${vimeoCount} vídeo(s) Vimeo`);
    if (imageCount > 0) detectedElements.push(`${imageCount} imagem(ns)`);
    if (hasSlider) detectedElements.push('Carrossel/Slider');

    // Create the CustomBlock with the actual content
    blocks.push({
      id: generateBlockId('customblock'),
      type: 'CustomBlock',
      props: {
        htmlContent: cleanedHtml.trim(),
        cssContent: extractedCss.trim(),
        blockName: patternInfo.patternName || 'Conteúdo Importado',
        // Metadata for editor display
        metadata: {
          sourceUrl: sourceUrl,
          patternType: patternInfo.patternType,
          confidence: patternInfo.confidence,
          detectedElements: detectedElements,
          importedAt: new Date().toISOString(),
        },
      },
      children: [],
    });

    console.log(`[IMPORT-BLOCK] Created CustomBlock with ${cleanedHtml.length} chars HTML, ${extractedCss.length} chars CSS`);

    // Log admin notification for future block implementation tracking
    try {
      const { data: existingRequest } = await supabase
        .from('block_implementation_requests')
        .select('id, occurrences_count')
        .eq('tenant_id', tenantId)
        .eq('pattern_name', patternInfo.patternName)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequest) {
        await supabase
          .from('block_implementation_requests')
          .update({ 
            occurrences_count: (existingRequest.occurrences_count || 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRequest.id);
        console.log(`[IMPORT-BLOCK] Updated implementation request count`);
      } else {
        const htmlSample = html.substring(0, 2000) + (html.length > 2000 ? '...[truncado]' : '');
        
        await supabase
          .from('block_implementation_requests')
          .insert({
            tenant_id: tenantId,
            pattern_name: patternInfo.patternName,
            pattern_description: `Padrão: ${patternInfo.patternType} (${Math.round(patternInfo.confidence * 100)}% confiança). Elementos: ${detectedElements.join(', ') || 'Layout complexo'}`,
            html_sample: htmlSample,
            source_url: sourceUrl,
            source_platform: 'import',
            suggested_props: {
              patternType: patternInfo.patternType,
              confidence: patternInfo.confidence,
              detectedElements: detectedElements,
            },
            occurrences_count: 1,
            status: 'pending',
          });
        console.log(`[IMPORT-BLOCK] Created implementation request`);
      }
    } catch (reqError) {
      console.warn('[IMPORT-BLOCK] Failed to log implementation request:', reqError);
    }

    return blocks;
    
  } catch (error) {
    console.error('[IMPORT-BLOCK] Exception:', error);
    
    // Fallback: return the HTML content as CustomBlock anyway
    return [{
      id: generateBlockId('customblock-fallback'),
      type: 'CustomBlock',
      props: {
        htmlContent: html,
        cssContent: '',
        blockName: 'Conteúdo Importado',
        metadata: { sourceUrl, error: String(error) },
      },
      children: [],
    }];
  }
}

// =============================================
// END CUSTOM BLOCK FALLBACK
// =============================================

// =============================================
// END CONTENT-TO-BLOCK MAPPER v3
// =============================================

// Scrape page content using Firecrawl with retry logic
async function scrapePageContent(url: string, retryCount = 0): Promise<{ html: string; markdown: string; title: string; description: string } | null> {
  const MAX_RETRIES = 2;
  
  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured - check connector settings');
      return null;
    }

    // Validate and normalize URL
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    console.log(`[SCRAPE] Starting scrape for: ${normalizedUrl} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: normalizedUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: true,
        waitFor: 3000, // Wait for dynamic content
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      console.error(`[SCRAPE] HTTP error ${response.status} for ${normalizedUrl}:`, JSON.stringify(data));
      
      // Retry on 5xx errors or rate limiting
      if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
        console.log(`[SCRAPE] Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        return scrapePageContent(url, retryCount + 1);
      }
      return null;
    }
    
    if (!data.success) {
      console.error(`[SCRAPE] API error for ${normalizedUrl}:`, data.error || JSON.stringify(data));
      return null;
    }

    // Firecrawl v1 response structure: data.data.html, data.data.markdown, etc.
    const rawHtml = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    const title = data.data?.metadata?.title || data.metadata?.title || '';
    const description = data.data?.metadata?.description || data.metadata?.description || '';

    console.log(`[SCRAPE] Success for ${normalizedUrl}: html=${rawHtml.length}chars, md=${markdown.length}chars`);

    // Clean the HTML content while preserving important elements
    const cleanedHtml = cleanHtmlContent(rawHtml, markdown);
    console.log(`[SCRAPE] Cleaned HTML: ${cleanedHtml.length}chars`);

    return { html: cleanedHtml, markdown, title, description };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[SCRAPE] Exception for ${url}: ${errorMsg}`);
    
    // Retry on timeout
    if (errorMsg.includes('abort') && retryCount < MAX_RETRIES) {
      console.log(`[SCRAPE] Timeout, retrying in 1s...`);
      await new Promise(r => setTimeout(r, 1000));
      return scrapePageContent(url, retryCount + 1);
    }
    return null;
  }
}

// Clean HTML content for safe display - extract ONLY main page content
function cleanHtmlContent(html: string, markdown?: string): string {
  if (!html && !markdown) return '';

  // If HTML is too short or looks like an error, try to convert markdown to HTML
  if (html.length < 100 && markdown && markdown.length > 50) {
    console.log('HTML too short, using markdown converted to HTML');
    return convertMarkdownToHtml(markdown);
  }

  let cleaned = html;

  // ===== PHASE 1: Remove dangerous elements first =====
  cleaned = cleaned
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Remove event handlers
  cleaned = cleaned.replace(/\s*on\w+="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*on\w+='[^']*'/gi, '');

  // ===== PHASE 2: Remove navigation/header/footer elements COMPLETELY =====
  const removePatterns = [
    // Remove nav elements
    /<nav[\s\S]*?<\/nav>/gi,
    // Remove header elements 
    /<header[\s\S]*?<\/header>/gi,
    // Remove footer elements
    /<footer[\s\S]*?<\/footer>/gi,
    // Remove aside elements
    /<aside[\s\S]*?<\/aside>/gi,
    // Remove Shopify announcement/topbar (common patterns)
    /<div[^>]*class="[^"]*(?:announcement|topbar|top-bar|utility-bar|header-bar|ticker|marquee|promo-bar)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove mobile menu overlays
    /<div[^>]*class="[^"]*(?:mobile-menu|drawer|side-menu|nav-overlay)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove search overlays
    /<div[^>]*class="[^"]*(?:search-modal|search-drawer|predictive-search)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove sticky headers
    /<div[^>]*class="[^"]*(?:sticky-header|fixed-header)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove Shopify section headers specifically
    /<section[^>]*class="[^"]*(?:shopify-section-header|shopify-section-announcement)[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
    // Remove common Shopify elements by ID
    /<div[^>]*id="[^"]*(?:shopify-section-header|shopify-section-announcement|announcement-bar)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // ===== NEW: Remove contact/support dropdowns (WhatsApp, phone, hours) =====
    /<div[^>]*class="[^"]*(?:dropdown|popover|tooltip|support-menu|contact-menu|atendimento)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove WhatsApp/phone links that are clearly from header
    /<a[^>]*href="[^"]*(?:wa\.me|whatsapp|tel:)[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
    // Remove elements containing specific header-like text patterns
    /<div[^>]*>[\s\S]*?(?:Fale no WhatsApp|HORÁRIO DE ATENDIMENTO|Compre por telefone)[\s\S]*?<\/div>/gi,
  ];

  for (const pattern of removePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // ===== PHASE 3: Try to extract ONLY main content area =====
  let mainContent = '';
  
  // Priority 1: Shopify MainContent div (most reliable for pages)
  const mainContentPatterns = [
    /<div[^>]*id="?MainContent"?[^>]*>([\s\S]*)/i,
    /<main[^>]*id="?MainContent"?[^>]*>([\s\S]*)/i,
  ];
  
  for (const pattern of mainContentPatterns) {
    const match = pattern.exec(cleaned);
    if (match && match[1].trim().length > 100) {
      // Extract until footer
      let content = match[1];
      const footerIdx = content.search(/<footer|<div[^>]*class="[^"]*footer/i);
      if (footerIdx > 0) {
        content = content.substring(0, footerIdx);
      }
      mainContent = content.trim();
      console.log('[CLEAN] Extracted MainContent div');
      break;
    }
  }

  // Priority 2: Look for main element (greedy match)
  if (!mainContent) {
    // Use greedy match to get full main content
    const mainMatch = /<main[^>]*>([\s\S]*)<\/main>/i.exec(cleaned);
    if (mainMatch && mainMatch[1].trim().length > 100) {
      mainContent = mainMatch[1].trim();
      console.log('[CLEAN] Extracted <main> element');
    }
  }

  // Priority 3: Look for article element
  if (!mainContent) {
    const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(cleaned);
    if (articleMatch && articleMatch[1].trim().length > 100) {
      mainContent = articleMatch[1].trim();
      console.log('[CLEAN] Extracted <article> element');
    }
  }

  // Priority 4: Look for content container
  if (!mainContent) {
    const contentPatterns = [
      /<div[^>]*class="[^"]*(?:page-content|main-content|content-wrapper|rte|shopify-policy)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*(?:page|content|wrapper)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];
    
    for (const pattern of contentPatterns) {
      const match = pattern.exec(cleaned);
      if (match && match[1].trim().length > 100) {
        mainContent = match[1].trim();
        console.log('[CLEAN] Extracted content container');
        break;
      }
    }
  }

  // Use main content if found, otherwise use cleaned HTML
  if (mainContent && mainContent.length > 50) {
    cleaned = mainContent;
  }

  // ===== PHASE 4: AGGRESSIVE CLEANUP AFTER EXTRACTION =====
  // Remove header/nav/search elements that might still be inside main
  const postExtractRemovePatterns = [
    // Remove any remaining nav elements
    /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
    // Remove any remaining header elements
    /<header\b[^>]*>[\s\S]*?<\/header>/gi,
    // Remove any remaining footer elements  
    /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
    // Remove search forms and inputs
    /<form[^>]*(?:search|pesquisa|busca)[^>]*>[\s\S]*?<\/form>/gi,
    /<input[^>]*(?:search|pesquisa|busca)[^>]*\/?>/gi,
    // Remove search results/suggestions containers
    /<div[^>]*class="[^"]*(?:search-results|search-suggestions|predictive-search|search-modal|search-overlay|search-dropdown|search-popover)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<ul[^>]*class="[^"]*(?:search-results|suggestions|predictive)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
    // Remove modal/popup containers
    /<div[^>]*class="[^"]*(?:modal|popup|overlay|drawer|dropdown-menu|popover)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove announcement bars/tickers
    /<div[^>]*class="[^"]*(?:announcement|ticker|marquee|promo-bar|top-bar)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove cart/mini-cart elements
    /<div[^>]*class="[^"]*(?:mini-cart|cart-drawer|cart-popup|cart-modal)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove Shopify section wrappers for header/announcement
    /<div[^>]*id="[^"]*(?:shopify-section-header|shopify-section-announcement|header-section)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove elements with data-section-type header
    /<[^>]*data-section-type="[^"]*header[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi,
    // Remove sticky/fixed elements (usually headers)
    /<div[^>]*class="[^"]*(?:sticky|fixed|is-sticky)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Remove menu elements
    /<ul[^>]*class="[^"]*(?:menu|nav-menu|main-menu|site-nav)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
    // Remove login/account links
    /<a[^>]*href="[^"]*(?:\/account|\/login|\/cart)[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
    // Remove logo links (usually in header)
    /<a[^>]*class="[^"]*(?:logo|brand|site-header)[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
  ];

  for (const pattern of postExtractRemovePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // ===== PHASE 5: Content-specific cleanup =====
  // Remove elements containing typical header text
  const headerTextPatterns = [
    /Mais pesquisados?:/gi,
    /Buscar pedidos?, produtos?, clientes/gi,
    /Minha Conta/gi,
    /OFERTAS DE FIM DE ANO/gi,
    /Frete Grátis/gi,
  ];
  
  // Don't remove entire containers, just mark for later review
  // (removing based on text is risky for false positives)

  // ===== PHASE 6: Final cleanup =====
  // Remove empty elements
  cleaned = cleaned
    .replace(/<(div|span|p|section)[^>]*>\s*<\/\1>/gi, '')
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br>')
    .replace(/\n\s*\n\s*\n/g, '\n\n');

  // Remove any remaining onclick/onload handlers that might have survived
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  console.log(`[CLEAN] Final cleaned HTML: ${cleaned.length} chars`);
  return cleaned.trim();
}

// Convert markdown to basic HTML
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Lists
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
  
  // Paragraphs (lines separated by blank lines)
  html = html.replace(/^(?!<[houl])(.*$)/gim, '<p>$1</p>');
  html = html.replace(/<p><\/p>/g, '');
  
  return html;
}

// Parse title from a URL slug
function getTitleFromSlug(slug: string): string {
  return slug
    .split('/').pop()! // Get last part
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .replace(/_/g, ' ') // Replace underscores with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Check if URL is a core page that should not be imported
function isCorePageUrl(url: string, slug: string): boolean {
  const corePatterns = [
    /^\/?$/,                          // Homepage
    /^\/?(products?|produto)s?\/?$/i, // Products listing
    /^\/?(products?|produto)\/[^/]+/i, // Individual product pages
    /^\/?(collections?|colec[aã]o|colec[oõ]es?)($|\/)/i, // Collections
    /^\/?(cart|carrinho)\/?$/i,       // Cart
    /^\/?(checkout|finalizar)\/?$/i,  // Checkout
    /^\/?(account|conta|minha-conta)\/?$/i, // Account
    /^\/?(login|entrar|signin)\/?$/i, // Login
    /^\/?(register|cadastro|signup)\/?$/i, // Register
    /^\/?(search|busca|pesquisa)\/?$/i, // Search
    /^\/?(orders?|pedidos?)\/?$/i,    // Orders
    /^\/?(wishlist|favoritos)\/?$/i,  // Wishlist
  ];
  
  const fullPath = slug.startsWith('/') ? slug : `/${slug}`;
  
  return corePatterns.some(pattern => pattern.test(fullPath));
}

// Process a single page import - NOW WITH AI SUPPORT
async function importPage(
  supabase: any,
  tenantId: string,
  page: InstitutionalPage,
  storeUrl?: string,
  useAI: boolean = true // AI is ON by default
): Promise<{ success: boolean; error?: string; pageId?: string }> {
  try {
    console.log(`[IMPORT] Processing page: ${page.title} (${page.url}) - AI: ${useAI ? 'ON' : 'OFF'}`);
    
    // Check if this is a core page
    if (isCorePageUrl(page.url, page.slug)) {
      console.log(`[IMPORT] Skipping core page: ${page.slug}`);
      return { success: false, error: 'Core page - not imported' };
    }
    
    // Check if page with same slug already exists
    const { data: existingPage, error: checkError } = await supabase
      .from('store_pages')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('slug', page.slug)
      .single();
    
    if (existingPage) {
      console.log(`[IMPORT] Page already exists: ${page.slug}`);
      return { success: false, error: 'Page already exists' };
    }
    
    // Scrape the page content
    const scraped = await scrapePageContent(page.url);
    
    if (!scraped || (!scraped.html && !scraped.markdown)) {
      console.log(`[IMPORT] Failed to scrape: ${page.url}`);
      return { success: false, error: 'Failed to scrape content' };
    }
    
    // Use scraped title if available, otherwise use provided title
    const finalTitle = scraped.title || page.title || getTitleFromSlug(page.slug);
    
    let pageContent: BlockNode;
    
    // =============================================
    // NEW: Try AI analysis first, fallback to regex
    // =============================================
    if (useAI) {
      console.log(`[IMPORT] Using AI analysis for: ${finalTitle}`);
      
      const aiResult = await analyzePageWithAI(scraped.html, finalTitle, page.url);
      
      if (aiResult.success && aiResult.sections && aiResult.sections.length > 0) {
        console.log(`[IMPORT] AI SUCCESS: ${aiResult.sections.length} sections, complexity: ${aiResult.pageComplexity}`);
        console.log(`[IMPORT] AI Summary: ${aiResult.summary}`);
        
        // Create page from AI analysis
        pageContent = createPageFromAIAnalysis(aiResult.sections, finalTitle, supabase, tenantId);
        
        console.log(`[IMPORT] AI Page blocks: ${pageContent.children[0]?.children?.map((b: BlockNode) => b.type).join(', ')}`);
      } else {
        // AI failed or returned no sections - fallback to regex
        console.warn(`[IMPORT] AI fallback: ${aiResult.error || 'no sections'}`);
        console.log(`[IMPORT] Using regex analysis for: ${finalTitle}`);
        pageContent = createPageWithMappedBlocks(scraped.html, finalTitle);
      }
    } else {
      // AI disabled - use original regex analysis
      console.log(`[IMPORT] Creating page structure (regex) for: ${finalTitle}`);
      pageContent = createPageWithMappedBlocks(scraped.html, finalTitle);
    }
    
    // Process any pending complex page placeholders (from regex path)
    const section = pageContent.children[0];
    if (section && section.children) {
      const newChildren: BlockNode[] = [];
      
      for (const block of section.children) {
        if (block.type === '__CustomBlockPending__') {
          console.log(`[IMPORT] Processing complex page block...`);
          
          // Create actual CustomBlock with the imported content
          const customBlocks = await createComplexPageBlocks(
            supabase,
            tenantId,
            block.props.htmlContent as string,
            page.url,
            {
              patternType: block.props.patternType as string,
              patternName: block.props.patternName as string,
              confidence: block.props.confidence as number,
            }
          );
          
          // Add all created blocks
          newChildren.push(...customBlocks);
          console.log(`[IMPORT] Created ${customBlocks.length} CustomBlock(s)`);
        } else {
          newChildren.push(block);
        }
      }
      
      section.children = newChildren;
    }
    
    const blockTypes = section?.children?.map((b: BlockNode) => b.type).join(', ') || 'empty';
    console.log(`[IMPORT] Final page blocks: ${blockTypes}`);
    
    // Prepare SEO metadata
    const seoTitle = scraped.title || finalTitle;
    const seoDescription = scraped.description || `${finalTitle} - Informações importantes`;
    
    // Insert the page
    const { data: newPage, error: insertError } = await supabase
      .from('store_pages')
      .insert({
        tenant_id: tenantId,
        title: finalTitle,
        slug: page.slug.replace(/^\/+/, ''), // Remove leading slashes
        type: 'institutional',
        content: pageContent,
        seo_title: seoTitle.substring(0, 60),
        seo_description: seoDescription.substring(0, 160),
        is_published: false, // Start as draft
        status: 'draft',
        is_system: false,
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error(`[IMPORT] Insert error for ${page.slug}:`, insertError);
      return { success: false, error: insertError.message };
    }
    
    console.log(`[IMPORT] Successfully imported: ${finalTitle} (${newPage.id})`);
    return { success: true, pageId: newPage.id };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[IMPORT] Exception for ${page.url}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body: ImportPagesRequest = await req.json();
    const { tenantId, pages, storeUrl, useAI = true } = body; // AI is ON by default
    
    if (!tenantId || !Array.isArray(pages)) {
      return new Response(
        JSON.stringify({ error: 'tenantId and pages array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[IMPORT-PAGES] Starting import of ${pages.length} pages for tenant ${tenantId} (AI: ${useAI ? 'ON' : 'OFF'})`);
    
    // Process pages
    const results: { page: string; status: 'imported' | 'skipped' | 'failed'; reason?: string }[] = [];
    
    for (const page of pages) {
      const result = await importPage(supabase, tenantId, page, storeUrl, useAI);
      
      if (result.success) {
        results.push({ page: page.slug, status: 'imported' });
      } else if (result.error === 'Page already exists' || result.error === 'Core page - not imported') {
        results.push({ page: page.slug, status: 'skipped', reason: result.error });
      } else {
        results.push({ page: page.slug, status: 'failed', reason: result.error });
      }
    }
    
    const imported = results.filter(r => r.status === 'imported').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`[IMPORT-PAGES] Complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        results: { 
          imported, 
          skipped, 
          failed,
          pages: results.map(r => ({
            slug: r.page,
            title: r.page.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            hasContent: r.status === 'imported',
            status: r.status,
          })),
          errors: results.filter(r => r.status === 'failed').map(r => r.reason),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[IMPORT-PAGES] Error:', errorMsg);
    
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
