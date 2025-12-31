// =====================================================
// CONTENT-TO-BLOCK MAPPER
// =====================================================
// 
// This module analyzes imported HTML content and intelligently maps it 
// to existing block types in our Builder registry.
//
// IMPORTANT: Block types used here MUST match exactly with:
// 1. src/lib/builder/registry.ts - Block definitions
// 2. src/components/builder/BlockPalette.tsx - Visible blocks in editor
//
// CURRENTLY SUPPORTED MAPPINGS:
// - FAQ content → 'FAQ' block (minimum 2 items required)
// - Testimonials → 'Testimonials' block (minimum 2 items required)
// - Contact Info → 'InfoHighlights' block (when contact patterns detected)
// - Remaining text → 'RichText' block (fallback)
//
// TO ADD NEW BLOCK MAPPING:
// 1. Create extraction function (e.g., extractContactInfo)
// 2. Add detection logic in analyzeAndMapContent
// 3. Ensure block type exists in registry.ts
// 4. Ensure block is in BlockPalette.tsx visibleBlockTypes
// =====================================================

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

interface ContentAnalysis {
  hasFAQ: boolean;
  faqItems: FAQItem[];
  faqTitle: string;
  hasTestimonials: boolean;
  testimonialItems: TestimonialItem[];
  testimonialTitle: string;
  hasInfoHighlights: boolean;
  infoHighlightItems: InfoHighlightItem[];
  remainingHtml: string;
}

// Generate unique block ID
function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =====================================================
// FAQ EXTRACTION
// Block type: 'FAQ' (from registry.ts)
// =====================================================
function extractFAQItems(html: string): { items: FAQItem[]; title: string; remainingHtml: string } {
  const items: FAQItem[] = [];
  let title = 'Perguntas Frequentes';
  let remainingHtml = html;

  // First, try to find the FAQ title
  const faqTitlePatterns = [
    /<h[1-6][^>]*>([^<]*(?:perguntas?\s*frequentes?|faq|dúvidas?\s*comuns?)[^<]*)<\/h[1-6]>/gi,
    /<strong>([^<]*(?:perguntas?\s*frequentes?|faq)[^<]*)<\/strong>/gi,
  ];

  for (const pattern of faqTitlePatterns) {
    const match = pattern.exec(html);
    if (match) {
      title = match[1].trim().replace(/\s*\(FAQ\)\s*/gi, '').trim() || title;
      break;
    }
  }

  // Pattern 1: Numbered question/answer pairs
  // Example: "1. O site é seguro? Sim! Nosso site é oficial..."
  const numberedQAPattern = /(\d+)\.\s*([^?]+\?)\s*([^1-9]+?)(?=\d+\.\s*[^?]+\?|$)/g;
  let match;
  
  const tempHtml = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  
  while ((match = numberedQAPattern.exec(tempHtml)) !== null) {
    const question = match[2].trim();
    const answer = match[3].trim();
    
    if (question.length > 10 && answer.length > 10) {
      items.push({
        question: cleanText(question),
        answer: cleanText(answer),
      });
    }
  }

  // Pattern 2: <details>/<summary> patterns (accordion-like)
  const detailsPattern = /<details[^>]*>\s*<summary[^>]*>([^<]+)<\/summary>\s*([\s\S]*?)<\/details>/gi;
  let tempHtml2 = html;
  
  while ((match = detailsPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = stripHtml(match[2]).trim();
    
    if (question.length > 5 && answer.length > 5) {
      items.push({
        question: cleanText(question),
        answer: cleanText(answer),
      });
      tempHtml2 = tempHtml2.replace(match[0], '');
    }
  }

  // Pattern 3: Bold questions followed by regular text
  // Example: <strong>Pergunta?</strong> Resposta aqui...
  const boldQAPattern = /<(?:strong|b)>([^<]*\?)<\/(?:strong|b)>\s*([^<]+)/gi;
  
  while ((match = boldQAPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    
    if (question.length > 10 && answer.length > 20) {
      if (!items.some(i => i.question.includes(question.substring(0, 20)))) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
      }
    }
  }

  // Pattern 4: H3/H4 with question mark followed by paragraph
  const headingQAPattern = /<h[3-6][^>]*>([^<]*\?)<\/h[3-6]>\s*<p[^>]*>([^<]+)<\/p>/gi;
  
  while ((match = headingQAPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    
    if (question.length > 10 && answer.length > 20) {
      if (!items.some(i => i.question.includes(question.substring(0, 20)))) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
      }
    }
  }

  // Pattern 5: Div-based FAQ structures (common in e-commerce)
  const divFAQPattern = /<div[^>]*class="[^"]*(?:faq-item|accordion-item|pergunta)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  
  while ((match = divFAQPattern.exec(html)) !== null) {
    const content = match[1];
    const questionMatch = /<(?:h[3-6]|strong|b|span[^>]*class="[^"]*question)[^>]*>([^<]+)</i.exec(content);
    const answerMatch = /<(?:p|div[^>]*class="[^"]*answer)[^>]*>([\s\S]+?)<\/(?:p|div)>/i.exec(content);
    
    if (questionMatch && answerMatch) {
      const question = questionMatch[1].trim();
      const answer = stripHtml(answerMatch[1]).trim();
      
      if (question.length > 5 && answer.length > 10) {
        if (!items.some(i => i.question.includes(question.substring(0, Math.min(20, question.length))))) {
          items.push({
            question: cleanText(question),
            answer: cleanText(answer),
          });
        }
      }
    }
  }

  // If we found FAQ items, remove the FAQ section from remaining HTML
  if (items.length >= 2) {
    const faqSectionPatterns = [
      /<(?:section|div)[^>]*>[\s\S]*?(?:perguntas?\s*frequentes?|faq)[\s\S]*?<\/(?:section|div)>/gi,
      /<h[1-6][^>]*>[^<]*(?:perguntas?\s*frequentes?|faq)[^<]*<\/h[1-6]>[\s\S]*?(?=<h[1-3]|<footer|<\/main|$)/gi,
    ];
    
    for (const pattern of faqSectionPatterns) {
      remainingHtml = remainingHtml.replace(pattern, '');
    }
    
    remainingHtml = remainingHtml.replace(/\d+\.\s*[^?]+\?\s*[^1-9]+?(?=\d+\.\s*[^?]+\?|<\/|$)/g, '');
  }

  return { items, title, remainingHtml };
}

// =====================================================
// TESTIMONIALS EXTRACTION
// Block type: 'Testimonials' (from registry.ts)
// =====================================================
function extractTestimonials(html: string): { items: TestimonialItem[]; title: string; remainingHtml: string } {
  const items: TestimonialItem[] = [];
  let title = 'Depoimentos';
  let remainingHtml = html;

  // Look for testimonial title
  const testimonialTitlePatterns = [
    /<h[1-6][^>]*>([^<]*(?:depoimentos?|avalia[çc][õo]es?|feedback|o\s+que\s+dizem)[^<]*)<\/h[1-6]>/gi,
  ];

  for (const pattern of testimonialTitlePatterns) {
    const match = pattern.exec(html);
    if (match) {
      title = match[1].trim() || title;
      break;
    }
  }

  let match;

  // Pattern 1: Blockquotes with attribution
  const blockquotePattern = /<blockquote[^>]*>\s*(?:<p[^>]*>)?([^<]+)(?:<\/p>)?\s*(?:<cite[^>]*>|<footer[^>]*>|—|-)?\s*([^<]+)?<\/(?:cite|footer|blockquote)>/gi;
  
  while ((match = blockquotePattern.exec(html)) !== null) {
    const text = match[1].trim();
    const name = match[2]?.trim() || 'Cliente';
    
    if (text.length > 20) {
      items.push({
        name: cleanText(name),
        text: cleanText(text),
        rating: 5,
      });
    }
  }

  // Pattern 2: Testimonial divs with common classes
  const testimonialDivPattern = /<div[^>]*class="[^"]*(?:testimonial|depoimento|review|avaliacao|feedback)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  
  while ((match = testimonialDivPattern.exec(html)) !== null) {
    const content = match[1];
    const textMatch = /<p[^>]*>([^<]+)<\/p>/i.exec(content);
    const nameMatch = /(?:—|-|by|por)\s*([^<]+)/i.exec(content) || /<(?:strong|b|cite)>([^<]+)<\/(?:strong|b|cite)>/i.exec(content);
    
    if (textMatch) {
      items.push({
        name: nameMatch?.[1]?.trim() || 'Cliente',
        text: cleanText(textMatch[1]),
        rating: 5,
      });
    }
  }

  // Pattern 3: Star rating with text (common in e-commerce)
  const ratingPattern = /(?:★{4,5}|⭐{4,5}|5\s*(?:estrelas?|stars?))\s*[—-]?\s*"?([^"<]+)"?\s*[—-]?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú]\.?)?)/gi;
  
  while ((match = ratingPattern.exec(html)) !== null) {
    const text = match[1].trim();
    const name = match[2].trim();
    
    if (text.length > 10 && !items.some(i => i.text.includes(text.substring(0, 20)))) {
      items.push({
        name: cleanText(name),
        text: cleanText(text),
        rating: 5,
      });
    }
  }

  // If found testimonials, try to remove from remaining HTML
  if (items.length >= 2) {
    remainingHtml = remainingHtml.replace(/<(?:section|div)[^>]*class="[^"]*(?:testimonial|depoimento|review|feedback)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi, '');
  }

  return { items, title, remainingHtml };
}

// =====================================================
// INFO HIGHLIGHTS EXTRACTION
// Block type: 'InfoHighlights' (from registry.ts)
// Detects: Contact info, policies, shipping info, etc.
// =====================================================
function extractInfoHighlights(html: string): { items: InfoHighlightItem[]; remainingHtml: string } {
  const items: InfoHighlightItem[] = [];
  let remainingHtml = html;

  // Common patterns for info highlights
  const infoPatterns = [
    // Shipping/delivery
    { pattern: /(?:frete\s*gr[áa]tis|entrega\s*r[áa]pida|envio\s*em\s*\d+)/gi, icon: 'Truck', title: 'Entrega' },
    // Security
    { pattern: /(?:site\s*seguro|compra\s*segura|pagamento\s*seguro|ssl|https)/gi, icon: 'Shield', title: 'Segurança' },
    // Payment
    { pattern: /(?:parcelamento|pague\s*em\s*at[ée]\s*\d+x|cart[ãa]o|boleto|pix)/gi, icon: 'CreditCard', title: 'Pagamento' },
    // Support
    { pattern: /(?:atendimento|suporte|whatsapp|telefone|chat)/gi, icon: 'Headphones', title: 'Atendimento' },
    // Guarantee
    { pattern: /(?:garantia|troca\s*gr[áa]tis|devolu[çc][ãa]o)/gi, icon: 'Award', title: 'Garantia' },
  ];

  // Check text content for info patterns
  const textContent = stripHtml(html).toLowerCase();
  
  for (const { pattern, icon, title } of infoPatterns) {
    const match = pattern.exec(textContent);
    if (match) {
      // Extract surrounding context for description
      const matchIndex = textContent.indexOf(match[0].toLowerCase());
      const start = Math.max(0, matchIndex - 20);
      const end = Math.min(textContent.length, matchIndex + match[0].length + 50);
      const context = textContent.substring(start, end).trim();
      
      if (!items.some(i => i.title === title)) {
        items.push({
          icon,
          title,
          description: cleanText(context.charAt(0).toUpperCase() + context.slice(1)),
        });
      }
    }
  }

  // Only return if we found multiple info items (to warrant a block)
  if (items.length < 3) {
    return { items: [], remainingHtml };
  }

  return { items, remainingHtml };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

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
// MAIN MAPPING FUNCTION
// =====================================================
// 
// Priority order:
// 1. FAQ (structured Q&A content)
// 2. Testimonials (customer reviews/feedback)
// 3. InfoHighlights (shipping/payment/security info)
// 4. RichText (remaining content - fallback)
// =====================================================
export function analyzeAndMapContent(html: string, pageTitle: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let remainingContent = html;

  console.log(`[MAPPER] Analyzing content for page: ${pageTitle}`);

  // 1. Extract FAQ content → 'FAQ' block
  const faqResult = extractFAQItems(remainingContent);
  if (faqResult.items.length >= 2) {
    console.log(`[MAPPER] ✓ Found ${faqResult.items.length} FAQ items → Creating FAQ block`);
    
    blocks.push({
      id: generateBlockId('faq'),
      type: 'FAQ', // Must match registry.ts type exactly
      props: {
        title: faqResult.title || 'Perguntas Frequentes',
        titleAlign: 'left',
        items: faqResult.items,
        allowMultiple: false,
      },
      children: [],
    });
    
    remainingContent = faqResult.remainingHtml;
  }

  // 2. Extract Testimonials → 'Testimonials' block
  const testimonialResult = extractTestimonials(remainingContent);
  if (testimonialResult.items.length >= 2) {
    console.log(`[MAPPER] ✓ Found ${testimonialResult.items.length} testimonials → Creating Testimonials block`);
    
    blocks.push({
      id: generateBlockId('testimonials'),
      type: 'Testimonials', // Must match registry.ts type exactly
      props: {
        title: testimonialResult.title || 'O que dizem nossos clientes',
        items: testimonialResult.items,
      },
      children: [],
    });
    
    remainingContent = testimonialResult.remainingHtml;
  }

  // 3. Extract InfoHighlights → 'InfoHighlights' block
  const infoResult = extractInfoHighlights(remainingContent);
  if (infoResult.items.length >= 3) {
    console.log(`[MAPPER] ✓ Found ${infoResult.items.length} info items → Creating InfoHighlights block`);
    
    blocks.push({
      id: generateBlockId('info'),
      type: 'InfoHighlights', // Must match registry.ts type exactly
      props: {
        items: infoResult.items,
        columns: Math.min(infoResult.items.length, 4),
      },
      children: [],
    });
    
    remainingContent = infoResult.remainingHtml;
  }

  // 4. Remaining content → 'RichText' block (fallback)
  const cleanedRemaining = remainingContent.replace(/<[^>]*>/g, '').trim();
  if (cleanedRemaining.length > 50) {
    console.log(`[MAPPER] Adding remaining content as RichText (${cleanedRemaining.length} chars)`);
    
    blocks.push({
      id: generateBlockId('richtext'),
      type: 'RichText', // Must match registry.ts type exactly
      props: {
        content: remainingContent.trim() || '<p>Conteúdo da página...</p>',
        fontFamily: 'inherit',
        fontSize: 'base',
        fontWeight: 'normal',
      },
      children: [],
    });
  }

  // 5. If no blocks were created, create a RichText with original content
  if (blocks.length === 0) {
    console.log(`[MAPPER] No structured content found → Using original as RichText`);
    
    blocks.push({
      id: generateBlockId('richtext'),
      type: 'RichText',
      props: {
        content: html || '<p>Conteúdo da página...</p>',
        fontFamily: 'inherit',
        fontSize: 'base',
        fontWeight: 'normal',
      },
      children: [],
    });
  }

  console.log(`[MAPPER] Created ${blocks.length} block(s): ${blocks.map(b => b.type).join(', ')}`);
  return blocks;
}

// Create a complete page structure with mapped blocks
export function createPageWithMappedBlocks(html: string, pageTitle: string): BlockNode {
  const contentBlocks = analyzeAndMapContent(html, pageTitle);
  
  const pageBlockId = generateBlockId('page');
  const sectionBlockId = generateBlockId('section');
  
  return {
    id: pageBlockId,
    type: 'Page',
    props: {
      backgroundColor: 'transparent',
      padding: 'none',
    },
    children: [
      {
        id: sectionBlockId,
        type: 'Section',
        props: {
          backgroundColor: 'transparent',
          paddingX: 16,
          paddingY: 32,
          marginTop: 0,
          marginBottom: 0,
          gap: 24,
          alignItems: 'stretch',
          fullWidth: false,
        },
        children: contentBlocks,
      },
    ],
  };
}
