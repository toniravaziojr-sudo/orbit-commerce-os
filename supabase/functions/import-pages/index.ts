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
  storeUrl?: string; // Base URL of the store for relative URL resolution
}

// =============================================
// CONTENT-TO-BLOCK MAPPER v3 - Inline Copy
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
// MAIN MAPPING FUNCTION
// =====================================================
function analyzeAndMapContent(html: string, pageTitle: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let remainingContent = html;

  console.log(`[MAPPER] ========================================`);
  console.log(`[MAPPER] Analyzing: "${pageTitle}", HTML: ${html.length} chars`);

  const isFAQPage = /perguntas?\s*frequentes?|faq|dúvidas?/i.test(pageTitle);
  const isTestimonialPage = /depoimentos?|avalia[çc][õo]es?/i.test(pageTitle);

  // 1. FAQ
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

  // 2. Testimonials
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

  // 4. RichText fallback
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

  // Priority 2: Look for main element
  if (!mainContent) {
    const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(cleaned);
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

  // ===== PHASE 4: Final cleanup =====
  // Remove empty elements
  cleaned = cleaned
    .replace(/<(div|span|p|section)[^>]*>\s*<\/\1>/gi, '')
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br>')
    .replace(/\n\s*\n\s*\n/g, '\n\n');

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

// Process a single page import
async function importPage(
  supabase: any,
  tenantId: string,
  page: InstitutionalPage,
  storeUrl?: string
): Promise<{ success: boolean; error?: string; pageId?: string }> {
  try {
    console.log(`[IMPORT] Processing page: ${page.title} (${page.url})`);
    
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
    
    // Create page content using intelligent block mapping
    console.log(`[IMPORT] Creating page structure for: ${finalTitle}`);
    const pageContent = createPageWithMappedBlocks(scraped.html, finalTitle);
    
    // Log the blocks being created
    const section = pageContent.children[0];
    if (section && section.children) {
      console.log(`[IMPORT] Page blocks: ${section.children.map((b: BlockNode) => `${b.type}(${b.type === 'FAQ' ? (b.props.items as FAQItem[])?.length + ' items' : ''})`).join(', ')}`);
    }
    
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
        page_type: 'custom',
        content: pageContent,
        seo_title: seoTitle.substring(0, 60),
        seo_description: seoDescription.substring(0, 160),
        is_active: true,
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
    const { tenantId, pages, storeUrl } = body;
    
    if (!tenantId || !Array.isArray(pages)) {
      return new Response(
        JSON.stringify({ error: 'tenantId and pages array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[IMPORT-PAGES] Starting import of ${pages.length} pages for tenant ${tenantId}`);
    
    // Process pages
    const results: { page: string; status: 'imported' | 'skipped' | 'failed'; reason?: string }[] = [];
    
    for (const page of pages) {
      const result = await importPage(supabase, tenantId, page, storeUrl);
      
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
        summary: { imported, skipped, failed },
        results,
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
