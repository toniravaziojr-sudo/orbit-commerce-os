// =====================================================
// CONTENT-TO-BLOCK MAPPER v3
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
// - Contact/Policy Info → 'InfoHighlights' block (minimum 3 items required)
// - Remaining text → 'RichText' block (fallback)
//
// EXTRACTION STRATEGIES (priority order):
// 1. Shopify-style nested accordions (categories with questions)
// 2. Numbered Q&A pairs (1. Question? Answer...)
// 3. <details>/<summary> HTML elements
// 4. Bold questions with text answers
// 5. Heading questions followed by paragraphs
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
// Block type: 'FAQ' (from registry.ts)
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
    
    // Validation
    if (question.length < 10 || answer.length < 15) return false;
    if (!question.includes('?')) return false;
    
    // Check for duplicates
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
  // Pattern: "1. Question here? Answer text..." 
  // Handles: "1. O site é seguro? Como tenho garantia...? Sim! Nosso site..."
  console.log(`[FAQ] Strategy 1: Numbered Q&A`);
  
  // Split by numbered items
  const numberedSections = plainText.split(/(?=\d+\.\s+[A-ZÀ-Ú])/);
  
  for (const section of numberedSections) {
    // Match: number. Question? Answer...
    const match = /^(\d+)\.\s*(.+?\?)\s*(.+)$/s.exec(section.trim());
    if (match) {
      let question = match[2].trim();
      let answer = match[3].trim();
      
      // If question has multiple ?, take first complete question
      const questionParts = question.match(/[^?]+\?/g);
      if (questionParts && questionParts.length > 1) {
        question = questionParts[0].trim();
        // Append remaining as part of answer
        answer = questionParts.slice(1).join(' ').trim() + ' ' + answer;
      }
      
      // Cut answer at next numbered question or category header
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
    
    // Skip category headers (all caps)
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
      
      // Skip category headers
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
      const question = match[1].trim();
      const answer = match[2].trim();
      addUniqueItem(question, answer, 'bold');
    }
  }

  // ===== STRATEGY 5: H3/H4/H5 with question followed by paragraph =====
  console.log(`[FAQ] Strategy 5: Heading Q&A`);
  
  const headingQAPattern = /<h[3-6][^>]*>([^<]*\?)<\/h[3-6]>\s*(?:<[^>]+>)*\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  
  while ((match = headingQAPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = stripHtml(match[2]).trim();
    addUniqueItem(question, answer, 'heading');
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

  // Remove FAQ section from remaining HTML if found items
  if (items.length >= 2) {
    const faqSectionPatterns = [
      /<(?:section|div)[^>]*>[\s\S]*?(?:perguntas?\s*frequentes?|faq)[\s\S]*?<\/(?:section|div)>/gi,
    ];
    
    for (const pattern of faqSectionPatterns) {
      remainingHtml = remainingHtml.replace(pattern, '');
    }
  }

  return { items, title, remainingHtml };
}

// =====================================================
// TESTIMONIALS EXTRACTION - Enhanced
// Block type: 'Testimonials' (from registry.ts)
// =====================================================
function extractTestimonials(html: string): { items: TestimonialItem[]; title: string; remainingHtml: string } {
  const items: TestimonialItem[] = [];
  let title = 'Depoimentos';
  let remainingHtml = html;
  let match;

  console.log(`[TESTIMONIALS] Starting extraction`);

  // Find testimonial section title
  const titlePatterns = [
    /<h[1-6][^>]*>([^<]*(?:depoimentos?|avalia[çc][õo]es?|feedback|o\s+que\s+dizem|testemunhos?)[^<]*)<\/h[1-6]>/gi,
  ];

  for (const pattern of titlePatterns) {
    match = pattern.exec(html);
    if (match) {
      title = cleanText(match[1]) || title;
      break;
    }
  }

  // Helper to add unique testimonial
  const addUniqueItem = (name: string, text: string, rating: number, source: string) => {
    name = cleanText(name);
    text = cleanText(text);
    
    if (text.length < 20) return false;
    if (items.some(i => i.text.substring(0, 30) === text.substring(0, 30))) return false;
    
    items.push({ name: name || 'Cliente', text, rating });
    console.log(`[TESTIMONIALS] Added (${source}): "${text.substring(0, 40)}..." - ${name}`);
    return true;
  };

  // Strategy 1: Blockquotes with attribution
  const blockquotePattern = /<blockquote[^>]*>\s*(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?\s*(?:<cite[^>]*>|<footer[^>]*>|—|-)?\s*([^<]*)?<\/(?:cite|footer|blockquote)>/gi;
  
  while ((match = blockquotePattern.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    const name = stripHtml(match[2] || '');
    addUniqueItem(name, text, 5, 'blockquote');
  }

  // Strategy 2: Testimonial divs with common classes
  const testimonialDivPatterns = [
    /<div[^>]*class="[^"]*(?:testimonial|depoimento|review|avaliacao|feedback)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*class="[^"]*(?:testimonial|depoimento|review)[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
  ];
  
  for (const pattern of testimonialDivPatterns) {
    while ((match = pattern.exec(html)) !== null) {
      const content = match[1];
      const textMatch = /<p[^>]*>([\s\S]+?)<\/p>/i.exec(content);
      const namePatterns = [
        /(?:—|-|by|por)\s*([^<]+)/i,
        /<(?:strong|b|cite|span[^>]*class="[^"]*name)[^>]*>([^<]+)<\/(?:strong|b|cite|span)>/i,
      ];
      
      let name = '';
      for (const np of namePatterns) {
        const nm = np.exec(content);
        if (nm) { name = nm[1]; break; }
      }
      
      if (textMatch) {
        addUniqueItem(name, stripHtml(textMatch[1]), 5, 'testimonialDiv');
      }
    }
  }

  // Strategy 3: Star ratings with quotes
  const ratingPattern = /(?:★{4,5}|⭐{4,5}|5\s*(?:estrelas?|stars?))\s*[—-]?\s*"?([^"<]+)"?\s*[—-]?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú]\.?)?)/gi;
  
  while ((match = ratingPattern.exec(html)) !== null) {
    addUniqueItem(match[2], match[1], 5, 'starRating');
  }

  // Strategy 4: Figure with figcaption (common pattern)
  const figurePattern = /<figure[^>]*>[\s\S]*?<blockquote>([\s\S]*?)<\/blockquote>[\s\S]*?<figcaption>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi;
  
  while ((match = figurePattern.exec(html)) !== null) {
    addUniqueItem(stripHtml(match[2]), stripHtml(match[1]), 5, 'figure');
  }

  console.log(`[TESTIMONIALS] Total: ${items.length}`);

  // Remove testimonial sections from remaining HTML
  if (items.length >= 2) {
    remainingHtml = remainingHtml.replace(/<(?:section|div)[^>]*class="[^"]*(?:testimonial|depoimento|review|feedback)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi, '');
  }

  return { items, title, remainingHtml };
}

// =====================================================
// INFO HIGHLIGHTS EXTRACTION - Enhanced
// Block type: 'InfoHighlights' (from registry.ts)
// Detects: Shipping, payment, security, policies, contact info
// =====================================================
function extractInfoHighlights(html: string): { items: InfoHighlightItem[]; remainingHtml: string } {
  const items: InfoHighlightItem[] = [];
  let remainingHtml = html;
  const textContent = stripHtml(html).toLowerCase();

  console.log(`[INFO] Starting extraction`);

  // Info patterns with icons (matching registry.ts InfoHighlights icons)
  const infoPatterns = [
    // Shipping/delivery
    { 
      patterns: [/frete\s*gr[áa]tis/i, /entrega\s*r[áa]pida/i, /envio\s*(?:em\s*)?\d+/i, /entrega\s*(?:em\s*)?\d+/i],
      icon: 'Truck', 
      title: 'Entrega',
      defaultDesc: 'Entrega rápida e segura'
    },
    // Security
    { 
      patterns: [/site\s*seguro/i, /compra\s*segura/i, /pagamento\s*seguro/i, /cnpj\s*ativo/i, /ssl/i],
      icon: 'Shield', 
      title: 'Segurança',
      defaultDesc: 'Compra 100% segura'
    },
    // Payment
    { 
      patterns: [/parcel(?:amento|e)\s*(?:em\s*)?\d+x/i, /at[ée]\s*\d+x\s*sem\s*juros/i, /pix\s*(?:\d+%|desconto)/i, /boleto/i, /cart[ãa]o/i],
      icon: 'CreditCard', 
      title: 'Pagamento',
      defaultDesc: 'Diversas formas de pagamento'
    },
    // Support
    { 
      patterns: [/atendimento/i, /suporte\s*(?:\d+h|dedicado)/i, /whatsapp/i, /fale\s*conosco/i],
      icon: 'Headphones', 
      title: 'Atendimento',
      defaultDesc: 'Suporte ao cliente'
    },
    // Guarantee
    { 
      patterns: [/garantia\s*(?:de\s*)?\d+/i, /troca\s*gr[áa]tis/i, /devolu[çc][ãa]o/i, /satisfa[çc][ãa]o\s*garantida/i],
      icon: 'Award', 
      title: 'Garantia',
      defaultDesc: 'Garantia de satisfação'
    },
    // Quality
    { 
      patterns: [/produto\s*original/i, /qualidade\s*garantida/i, /100%\s*original/i],
      icon: 'CheckCircle', 
      title: 'Qualidade',
      defaultDesc: 'Produtos originais e de qualidade'
    },
  ];

  let idCounter = 1;
  
  for (const { patterns, icon, title, defaultDesc } of infoPatterns) {
    for (const pattern of patterns) {
      const match = pattern.exec(textContent);
      if (match) {
        // Try to extract context around the match
        const matchIndex = textContent.indexOf(match[0].toLowerCase());
        const start = Math.max(0, matchIndex);
        const end = Math.min(textContent.length, matchIndex + match[0].length + 60);
        
        // Find sentence boundary
        let context = textContent.substring(start, end);
        const periodIdx = context.indexOf('.');
        if (periodIdx > 10) {
          context = context.substring(0, periodIdx);
        }
        
        const description = cleanText(context.charAt(0).toUpperCase() + context.slice(1)) || defaultDesc;
        
        // Avoid duplicates
        if (!items.some(i => i.title === title)) {
          items.push({
            id: String(idCounter++),
            icon,
            title,
            description: description.length > 100 ? description.substring(0, 100) + '...' : description,
          });
          console.log(`[INFO] Added: ${title} - ${description.substring(0, 40)}...`);
        }
        break;
      }
    }
  }

  console.log(`[INFO] Total: ${items.length}`);

  // Only return if we found at least 3 items
  if (items.length < 3) {
    return { items: [], remainingHtml };
  }

  return { items, remainingHtml };
}

// =====================================================
// POLICY CONTENT DETECTION
// Helps identify policy pages for appropriate RichText formatting
// =====================================================
function detectPolicyContent(html: string, pageTitle: string): boolean {
  const policyIndicators = [
    /pol[ií]tica\s*de\s*privacidade/i,
    /termos\s*(?:de\s*(?:uso|servi[çc]o)|e\s*condi[çc][õo]es)/i,
    /pol[ií]tica\s*de\s*(?:troca|devolu[çc][ãa]o|reembolso|entrega|frete|cookies?)/i,
    /aviso\s*legal/i,
    /lgpd/i,
  ];
  
  const text = stripHtml(html).toLowerCase() + ' ' + pageTitle.toLowerCase();
  
  return policyIndicators.some(p => p.test(text));
}

// =====================================================
// MAIN MAPPING FUNCTION
// Priority order:
// 1. FAQ → 'FAQ' block
// 2. Testimonials → 'Testimonials' block  
// 3. InfoHighlights → 'InfoHighlights' block
// 4. RichText (remaining/fallback)
// =====================================================
export function analyzeAndMapContent(html: string, pageTitle: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let remainingContent = html;

  console.log(`[MAPPER] ========================================`);
  console.log(`[MAPPER] Starting analysis for: "${pageTitle}"`);
  console.log(`[MAPPER] HTML length: ${html.length} chars`);

  const isFAQPage = /perguntas?\s*frequentes?|faq|dúvidas?/i.test(pageTitle);
  const isTestimonialPage = /depoimentos?|avalia[çc][õo]es?|feedback/i.test(pageTitle);
  const isPolicyPage = detectPolicyContent(html, pageTitle);

  console.log(`[MAPPER] Page type hints - FAQ: ${isFAQPage}, Testimonials: ${isTestimonialPage}, Policy: ${isPolicyPage}`);

  // 1. Extract FAQ content → 'FAQ' block
  const faqResult = extractFAQItems(remainingContent);
  console.log(`[MAPPER] FAQ result: ${faqResult.items.length} items`);
  
  if (faqResult.items.length >= 2 || (isFAQPage && faqResult.items.length >= 1)) {
    console.log(`[MAPPER] ✓ Creating FAQ block with ${faqResult.items.length} items`);
    
    blocks.push({
      id: generateBlockId('faq'),
      type: 'FAQ',
      props: {
        title: faqResult.title,
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
  console.log(`[MAPPER] Testimonials result: ${testimonialResult.items.length} items`);
  
  if (testimonialResult.items.length >= 2 || (isTestimonialPage && testimonialResult.items.length >= 1)) {
    console.log(`[MAPPER] ✓ Creating Testimonials block with ${testimonialResult.items.length} items`);
    
    blocks.push({
      id: generateBlockId('testimonials'),
      type: 'Testimonials',
      props: {
        title: testimonialResult.title,
        items: testimonialResult.items,
      },
      children: [],
    });
    
    remainingContent = testimonialResult.remainingHtml;
  }

  // 3. Extract InfoHighlights → 'InfoHighlights' block
  const infoResult = extractInfoHighlights(remainingContent);
  console.log(`[MAPPER] InfoHighlights result: ${infoResult.items.length} items`);
  
  if (infoResult.items.length >= 3) {
    console.log(`[MAPPER] ✓ Creating InfoHighlights block with ${infoResult.items.length} items`);
    
    blocks.push({
      id: generateBlockId('info'),
      type: 'InfoHighlights',
      props: {
        items: infoResult.items,
        layout: 'horizontal',
      },
      children: [],
    });
    
    remainingContent = infoResult.remainingHtml;
  }

  // 4. Remaining content → 'RichText' block (fallback)
  const cleanedRemaining = stripHtml(remainingContent);
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

  // 5. If no blocks created, use original content as RichText
  if (blocks.length === 0) {
    console.log(`[MAPPER] No structured content found → Creating RichText fallback`);
    
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

  console.log(`[MAPPER] Final result: ${blocks.length} block(s) - ${blocks.map(b => b.type).join(', ')}`);
  console.log(`[MAPPER] ========================================`);
  
  return blocks;
}

// Create a complete page structure with mapped blocks
export function createPageWithMappedBlocks(html: string, pageTitle: string): BlockNode {
  const contentBlocks = analyzeAndMapContent(html, pageTitle);
  
  return {
    id: generateBlockId('page'),
    type: 'Page',
    props: {
      backgroundColor: 'transparent',
      padding: 'none',
    },
    children: [
      {
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
          fullWidth: false,
        },
        children: contentBlocks,
      },
    ],
  };
}
