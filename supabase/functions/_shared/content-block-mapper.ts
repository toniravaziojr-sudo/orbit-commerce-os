// Content-to-Block Mapper
// Analyzes imported HTML/markdown content and maps it to appropriate block structures

interface FAQItem {
  question: string;
  answer: string;
}

interface TestimonialItem {
  name: string;
  text: string;
  rating?: number;
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
  remainingHtml: string;
}

// Generate unique block ID
function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Extract FAQ items from HTML content
function extractFAQItems(html: string): { items: FAQItem[]; title: string; remainingHtml: string } {
  const items: FAQItem[] = [];
  let title = 'Perguntas Frequentes';
  let remainingHtml = html;

  // Pattern 1: Accordion/collapsible FAQ patterns
  // Look for common FAQ structures like:
  // <h1>Perguntas frequentes (FAQ)</h1>
  // <details><summary>Question</summary>Answer</details>
  // or numbered lists like "1. Question? Answer..."

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

  // Pattern 2: Look for numbered question/answer pairs
  // Example: "1. O site é seguro? Como tenho garantia de que não vou cair em golpe? Sim! Nosso site é oficial..."
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

  // Pattern 3: Look for <details>/<summary> patterns
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
      // Remove this from remaining HTML
      tempHtml2 = tempHtml2.replace(match[0], '');
    }
  }

  // Pattern 4: Look for bold questions followed by regular text
  // Example: <strong>Pergunta?</strong> Resposta aqui...
  const boldQAPattern = /<(?:strong|b)>([^<]*\?)<\/(?:strong|b)>\s*([^<]+)/gi;
  
  while ((match = boldQAPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    
    if (question.length > 10 && answer.length > 20) {
      // Avoid duplicates
      if (!items.some(i => i.question.includes(question.substring(0, 20)))) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
      }
    }
  }

  // Pattern 5: H3/H4 with question mark followed by paragraph
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

  // If we found FAQ items, remove the FAQ section from remaining HTML
  if (items.length >= 2) {
    // Try to remove the entire FAQ section
    const faqSectionPatterns = [
      // Remove sections with FAQ in header
      /<(?:section|div)[^>]*>[\s\S]*?(?:perguntas?\s*frequentes?|faq)[\s\S]*?<\/(?:section|div)>/gi,
      // Remove h1-h6 with FAQ title and following content
      /<h[1-6][^>]*>[^<]*(?:perguntas?\s*frequentes?|faq)[^<]*<\/h[1-6]>[\s\S]*?(?=<h[1-3]|<footer|<\/main|$)/gi,
    ];
    
    for (const pattern of faqSectionPatterns) {
      remainingHtml = remainingHtml.replace(pattern, '');
    }
    
    // Also remove individual numbered Q&A
    remainingHtml = remainingHtml.replace(/\d+\.\s*[^?]+\?\s*[^1-9]+?(?=\d+\.\s*[^?]+\?|<\/|$)/g, '');
  }

  return { items, title, remainingHtml };
}

// Extract testimonials from HTML content
function extractTestimonials(html: string): { items: TestimonialItem[]; title: string; remainingHtml: string } {
  const items: TestimonialItem[] = [];
  let title = 'Depoimentos';
  let remainingHtml = html;

  // Look for testimonial patterns
  // Common patterns: quotes with author names, star ratings, etc.

  // Pattern 1: Blockquotes with attribution
  const blockquotePattern = /<blockquote[^>]*>\s*(?:<p[^>]*>)?([^<]+)(?:<\/p>)?\s*(?:<cite[^>]*>|<footer[^>]*>|—|-)?\s*([^<]+)?<\/(?:cite|footer|blockquote)>/gi;
  let match;
  
  while ((match = blockquotePattern.exec(html)) !== null) {
    const text = match[1].trim();
    const name = match[2]?.trim() || 'Cliente';
    
    if (text.length > 20) {
      items.push({
        name: cleanText(name),
        text: cleanText(text),
        rating: 5, // Default
      });
    }
  }

  // Pattern 2: Testimonial divs with common classes
  const testimonialDivPattern = /<div[^>]*class="[^"]*(?:testimonial|depoimento|review|avaliacao)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  
  while ((match = testimonialDivPattern.exec(html)) !== null) {
    const content = match[1];
    // Try to extract name and text from within
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

  // If found testimonials, try to remove from remaining HTML
  if (items.length >= 2) {
    remainingHtml = remainingHtml.replace(/<(?:section|div)[^>]*class="[^"]*(?:testimonial|depoimento|review)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi, '');
  }

  return { items, title, remainingHtml };
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

// Main function: Analyze content and return structured blocks
export function analyzeAndMapContent(html: string, pageTitle: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let remainingContent = html;

  // 1. Extract FAQ content
  const faqResult = extractFAQItems(remainingContent);
  if (faqResult.items.length >= 2) {
    console.log(`[MAPPER] Found ${faqResult.items.length} FAQ items`);
    
    blocks.push({
      id: generateBlockId('faq'),
      type: 'FAQ',
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

  // 2. Extract Testimonials
  const testimonialResult = extractTestimonials(remainingContent);
  if (testimonialResult.items.length >= 2) {
    console.log(`[MAPPER] Found ${testimonialResult.items.length} testimonials`);
    
    blocks.push({
      id: generateBlockId('testimonials'),
      type: 'Testimonials',
      props: {
        title: testimonialResult.title || 'Depoimentos',
        items: testimonialResult.items,
      },
      children: [],
    });
    
    remainingContent = testimonialResult.remainingHtml;
  }

  // 3. If remaining content has substantial text, add as RichText block
  const cleanedRemaining = remainingContent.replace(/<[^>]*>/g, '').trim();
  if (cleanedRemaining.length > 50) {
    console.log(`[MAPPER] Adding remaining content as RichText (${cleanedRemaining.length} chars)`);
    
    blocks.push({
      id: generateBlockId('richtext'),
      type: 'RichText',
      props: {
        content: remainingContent.trim() || '<p>Conteúdo da página...</p>',
        fontFamily: 'inherit',
        fontSize: 'base',
        fontWeight: 'normal',
      },
      children: [],
    });
  }

  // 4. If no blocks were created, create a RichText with original content
  if (blocks.length === 0) {
    console.log(`[MAPPER] No structured content found, using original as RichText`);
    
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
