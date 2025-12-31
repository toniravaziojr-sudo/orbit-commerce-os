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
// CONTENT-TO-BLOCK MAPPER v2
// Enhanced FAQ extraction with nested accordion support
// =============================================

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  categoryTitle: string;
  items: FAQItem[];
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

// =============================================
// ENHANCED FAQ EXTRACTION
// Supports: 
// - Nested accordions (categories with questions)
// - Shopify collapsible sections
// - Numbered Q&A pairs
// - Bold questions with text answers
// =============================================
function extractFAQItems(html: string): { items: FAQItem[]; title: string; remainingHtml: string } {
  const items: FAQItem[] = [];
  let title = 'Perguntas Frequentes';
  let remainingHtml = html;

  console.log(`[FAQ EXTRACTOR] Starting extraction, HTML length: ${html.length}`);

  // First, try to find the FAQ title
  const faqTitlePatterns = [
    /<h[1-6][^>]*>([^<]*(?:perguntas?\s*frequentes?|faq|dúvidas?\s*comuns?)[^<]*)<\/h[1-6]>/gi,
    /<strong>([^<]*(?:perguntas?\s*frequentes?|faq)[^<]*)<\/strong>/gi,
  ];

  for (const pattern of faqTitlePatterns) {
    const match = pattern.exec(html);
    if (match) {
      title = match[1].trim().replace(/\s*\(FAQ\)\s*/gi, '').trim() || title;
      console.log(`[FAQ EXTRACTOR] Found title: ${title}`);
      break;
    }
  }

  // ===== STRATEGY 1: Detect Shopify-style nested accordions =====
  // Pattern: Category headers (like "COMPRA & ENTREGA") with questions inside
  // Look for collapsible sections with inner collapsibles
  
  // Pattern for category headers (uppercase titles, often in buttons or summary)
  const categoryPattern = /<(?:button|summary|div|h[2-4])[^>]*>[\s\S]*?([A-ZÀ-Ú][A-ZÀ-Ú\s&]+(?:&(?:amp;)?|E|\s)[A-ZÀ-Ú\s&]+)[\s\S]*?<\/(?:button|summary|div|h[2-4])>/g;
  
  // First, detect if this is a nested accordion structure
  const plainText = stripHtml(html);
  const hasCategories = /(?:COMPRA|USO|SEGURANÇA|GARANTIA|PAGAMENTO|ENTREGA|RESULTADOS|EFEITOS|SUPORTE|DÚVIDAS)\s*[&E]\s*/i.test(plainText);
  
  console.log(`[FAQ EXTRACTOR] Has category structure: ${hasCategories}`);

  // ===== STRATEGY 2: Parse numbered Q&A with category awareness =====
  // Pattern: "1. Question? Answer text..." grouped by categories
  
  // Look for numbered questions with their answers
  // This handles: "1. O site é seguro? Como tenho garantia de que não vou cair em golpe?"
  // Followed by: "Sim! Nosso site é oficial..."
  
  const lines = plainText.split(/(?=\d+\.\s)/);
  let currentCategory = '';
  
  for (const line of lines) {
    // Check if this line is a category header (all caps with &)
    const categoryMatch = /^([A-ZÀ-Ú][A-ZÀ-Ú\s&]+(?:&|E)[A-ZÀ-Ú\s&]+)\s*$/m.exec(line.trim());
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      console.log(`[FAQ EXTRACTOR] Found category: ${currentCategory}`);
      continue;
    }
    
    // Look for numbered Q&A: "1. Question? Answer..."
    const numberedMatch = /^(\d+)\.\s*([^?]+\?(?:[^?]+\?)?)\s*(.+)$/s.exec(line.trim());
    if (numberedMatch) {
      const num = numberedMatch[1];
      let question = numberedMatch[2].trim();
      let answer = numberedMatch[3].trim();
      
      // Sometimes the answer continues with more sentences
      // Clean up question - might have multiple questions, take the main one
      if (question.includes('?') && question.split('?').length > 2) {
        const parts = question.split('?');
        question = parts[0] + '?';
        // Rest becomes part of the answer
        answer = parts.slice(1).join('?').trim() + ' ' + answer;
      }
      
      // Cut answer at next question number or category
      const nextQMatch = answer.search(/\s+\d+\.\s+[A-ZÀ-Ú]/);
      if (nextQMatch > 50) {
        answer = answer.substring(0, nextQMatch).trim();
      }
      
      const nextCatMatch = answer.search(/\s+[A-ZÀ-Ú]{3,}\s*[&E]\s*[A-ZÀ-Ú]{3,}/);
      if (nextCatMatch > 50) {
        answer = answer.substring(0, nextCatMatch).trim();
      }
      
      // Validate
      if (question.length > 10 && answer.length > 20) {
        // Check for duplicates
        const isDuplicate = items.some(i => 
          i.question.toLowerCase().substring(0, 30) === question.toLowerCase().substring(0, 30)
        );
        
        if (!isDuplicate) {
          items.push({
            question: cleanText(question),
            answer: cleanText(answer),
          });
          console.log(`[FAQ EXTRACTOR] Found Q${num}: "${question.substring(0, 50)}..."`);
        }
      }
    }
  }

  // ===== STRATEGY 3: Parse HTML accordion structures =====
  // Look for <details>/<summary> or collapsible divs
  
  let match;
  const detailsPattern = /<details[^>]*>\s*<summary[^>]*>([^<]+)<\/summary>\s*([\s\S]*?)<\/details>/gi;
  
  while ((match = detailsPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = stripHtml(match[2]).trim();
    
    // Skip if it looks like a category header (all caps)
    if (/^[A-ZÀ-Ú\s&]+$/.test(question)) {
      console.log(`[FAQ EXTRACTOR] Skipping category: ${question}`);
      continue;
    }
    
    if (question.length > 5 && answer.length > 10) {
      const isDuplicate = items.some(i => 
        i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20))
      );
      
      if (!isDuplicate) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
        console.log(`[FAQ EXTRACTOR] Found accordion Q: "${question.substring(0, 50)}..."`);
      }
    }
  }

  // ===== STRATEGY 4: Parse Shopify collapsible-row patterns =====
  // Pattern: <div class="collapsible-row..."><button>Question</button><div>Answer</div></div>
  
  const collapsibleRowPattern = /<div[^>]*class="[^"]*collapsible[^"]*"[^>]*>[\s\S]*?<(?:button|summary)[^>]*>([^<]+)<\/(?:button|summary)>[\s\S]*?<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  
  while ((match = collapsibleRowPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = stripHtml(match[2]).trim();
    
    // Skip category headers
    if (/^[A-ZÀ-Ú\s&]+$/.test(question) && !question.includes('?')) {
      continue;
    }
    
    if (question.length > 10 && answer.length > 20) {
      const isDuplicate = items.some(i => 
        i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20))
      );
      
      if (!isDuplicate) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
        console.log(`[FAQ EXTRACTOR] Found collapsible Q: "${question.substring(0, 50)}..."`);
      }
    }
  }

  // ===== STRATEGY 5: Parse bold questions followed by text =====
  const boldQAPattern = /<(?:strong|b)>\s*\d*\.?\s*([^<]*\?)<\/(?:strong|b)>\s*(?:<br\s*\/?>|<\/p>\s*<p>)?\s*([^<]+)/gi;
  
  while ((match = boldQAPattern.exec(html)) !== null) {
    const question = match[1].trim();
    let answer = match[2].trim();
    
    // Clean up answer
    answer = answer.replace(/^\s*Sim[!.]?\s*/i, '').trim();
    if (!answer) answer = match[2].trim();
    
    if (question.length > 10 && answer.length > 20) {
      const isDuplicate = items.some(i => 
        i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20))
      );
      
      if (!isDuplicate) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
        console.log(`[FAQ EXTRACTOR] Found bold Q: "${question.substring(0, 50)}..."`);
      }
    }
  }

  // ===== STRATEGY 6: H3/H4 with question mark followed by paragraph =====
  const headingQAPattern = /<h[3-6][^>]*>([^<]*\?)<\/h[3-6]>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  
  while ((match = headingQAPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = stripHtml(match[2]).trim();
    
    if (question.length > 10 && answer.length > 20) {
      const isDuplicate = items.some(i => 
        i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20))
      );
      
      if (!isDuplicate) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
        console.log(`[FAQ EXTRACTOR] Found heading Q: "${question.substring(0, 50)}..."`);
      }
    }
  }

  console.log(`[FAQ EXTRACTOR] Total items found: ${items.length}`);

  // Clean up remaining HTML if we found items
  if (items.length >= 2) {
    const faqSectionPatterns = [
      /<(?:section|div)[^>]*>[\s\S]*?(?:perguntas?\s*frequentes?|faq)[\s\S]*?<\/(?:section|div)>/gi,
      /<h[1-6][^>]*>[^<]*(?:perguntas?\s*frequentes?|faq)[^<]*<\/h[1-6]>[\s\S]*?(?=<h[1-3]|<footer|<\/main|$)/gi,
    ];
    
    for (const pattern of faqSectionPatterns) {
      remainingHtml = remainingHtml.replace(pattern, '');
    }
  }

  return { items, title, remainingHtml };
}

// Extract testimonials from HTML content
function extractTestimonials(html: string): { items: TestimonialItem[]; title: string; remainingHtml: string } {
  const items: TestimonialItem[] = [];
  let title = 'Depoimentos';
  let remainingHtml = html;
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
  const testimonialDivPattern = /<div[^>]*class="[^"]*(?:testimonial|depoimento|review|avaliacao)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  
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

  if (items.length >= 2) {
    console.log(`[MAPPER] Found ${items.length} testimonials`);
    remainingHtml = remainingHtml.replace(/<(?:section|div)[^>]*class="[^"]*(?:testimonial|depoimento|review)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi, '');
  }

  return { items, title, remainingHtml };
}

// Main function: Analyze content and return structured blocks
function analyzeAndMapContent(html: string, pageTitle: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let remainingContent = html;

  console.log(`[MAPPER] Starting analysis for: "${pageTitle}"`);

  // Check if page title suggests FAQ content
  const isFAQPage = /perguntas?\s*frequentes?|faq|dúvidas?/i.test(pageTitle);
  console.log(`[MAPPER] Is FAQ page: ${isFAQPage}`);
  
  // 1. Extract FAQ content (prioritize if page title suggests FAQ)
  const faqResult = extractFAQItems(remainingContent);
  console.log(`[MAPPER] FAQ extraction result: ${faqResult.items.length} items`);
  
  if (faqResult.items.length >= 2 || (isFAQPage && faqResult.items.length >= 1)) {
    console.log(`[MAPPER] Creating FAQ block with ${faqResult.items.length} items`);
    
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
    console.log(`[MAPPER] Creating Testimonials block with ${testimonialResult.items.length} items`);
    
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

  // 4. If no blocks were created, create a RichText with original content
  if (blocks.length === 0) {
    console.log(`[MAPPER] No structured content found, using RichText fallback`);
    
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

  console.log(`[MAPPER] Final result: ${blocks.length} blocks created`);
  return blocks;
}

// Create a complete page structure with mapped blocks
function createPageWithMappedBlocks(html: string, pageTitle: string): BlockNode {
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

// =============================================
// END CONTENT-TO-BLOCK MAPPER
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
