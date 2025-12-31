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
// CONTENT-TO-BLOCK MAPPER
// Analyzes imported HTML content and maps it to appropriate block structures
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

// Extract FAQ items from HTML content
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

  // Convert HTML to plain text for pattern matching
  const plainText = stripHtml(html);

  // Pattern 1: Look for numbered question/answer pairs
  // Example: "1. O site é seguro? Sim! Nosso site é oficial..."
  const numberedQAPattern = /(\d+)\.\s*([^?]+\?)\s*([^1-9]+?)(?=\d+\.\s*[^?]+\?|$)/g;
  let match;
  
  while ((match = numberedQAPattern.exec(plainText)) !== null) {
    const question = match[2].trim();
    let answer = match[3].trim();
    
    // Stop answer at next question pattern or section heading
    const nextSection = answer.search(/^[A-Z]{2,}[^a-z]/m);
    if (nextSection > 50) {
      answer = answer.substring(0, nextSection).trim();
    }
    
    if (question.length > 10 && answer.length > 20) {
      items.push({
        question: cleanText(question),
        answer: cleanText(answer),
      });
    }
  }

  // Pattern 2: Look for <details>/<summary> patterns
  const detailsPattern = /<details[^>]*>\s*<summary[^>]*>([^<]+)<\/summary>\s*([\s\S]*?)<\/details>/gi;
  
  while ((match = detailsPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = stripHtml(match[2]).trim();
    
    if (question.length > 5 && answer.length > 5) {
      // Avoid duplicates
      if (!items.some(i => i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20)))) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
      }
    }
  }

  // Pattern 3: Look for bold questions followed by regular text
  const boldQAPattern = /<(?:strong|b)>([^<]*\?)<\/(?:strong|b)>\s*([^<]+)/gi;
  
  while ((match = boldQAPattern.exec(html)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    
    if (question.length > 10 && answer.length > 20) {
      if (!items.some(i => i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20)))) {
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
      if (!items.some(i => i.question.toLowerCase().includes(question.toLowerCase().substring(0, 20)))) {
        items.push({
          question: cleanText(question),
          answer: cleanText(answer),
        });
      }
    }
  }

  // If we found FAQ items, remove the FAQ section from remaining HTML
  if (items.length >= 2) {
    console.log(`[MAPPER] Found ${items.length} FAQ items`);
    
    // Try to remove the entire FAQ section
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

  // Check if page title suggests FAQ content
  const isFAQPage = /perguntas?\s*frequentes?|faq|dúvidas?/i.test(pageTitle);
  
  // 1. Extract FAQ content (prioritize if page title suggests FAQ)
  const faqResult = extractFAQItems(remainingContent);
  if (faqResult.items.length >= 2 || (isFAQPage && faqResult.items.length >= 1)) {
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
      mainContent = content;
      console.log('Found main content via MainContent ID');
      break;
    }
  }
  
  // Priority 2: <main> element
  if (!mainContent) {
    const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(cleaned);
    if (mainMatch && mainMatch[1].trim().length > 100) {
      mainContent = mainMatch[1];
      console.log('Found main content via <main> tag');
    }
  }
  
  // Priority 3: <article> element
  if (!mainContent) {
    const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(cleaned);
    if (articleMatch && articleMatch[1].trim().length > 100) {
      mainContent = articleMatch[1];
      console.log('Found main content via <article> tag');
    }
  }
  
  // Priority 4: Content/RTE class divs (Shopify rich text editor output)
  if (!mainContent) {
    const contentPatterns = [
      /<div[^>]*class="[^"]*(?:rte|entry-content|page-content|text-content|content-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*(?:page-width|container|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]*class="[^"]*(?:page|content|main-content)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    ];
    
    for (const pattern of contentPatterns) {
      const match = pattern.exec(cleaned);
      if (match && match[1].trim().length > 100) {
        mainContent = match[1];
        console.log('Found main content via content class pattern');
        break;
      }
    }
  }

  // Priority 5: Use body content if nothing else found
  if (!mainContent) {
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(cleaned);
    if (bodyMatch) {
      mainContent = bodyMatch[1];
      console.log('Using body content as fallback');
    } else {
      mainContent = cleaned;
    }
  }

  // ===== PHASE 4: Clean up the extracted content =====
  // Remove any remaining navigation/layout elements
  mainContent = mainContent
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');

  // Remove breadcrumb sections
  mainContent = mainContent.replace(/<(?:nav|div|ol|ul)[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>[\s\S]*?<\/(?:nav|div|ol|ul)>/gi, '');

  // Remove "Back to" navigation links
  mainContent = mainContent.replace(/<a[^>]*class="[^"]*(?:back-link|return-link)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');

  // ===== NEW: Remove elements with header-like content AFTER extraction =====
  // This catches content that slipped through (like the WhatsApp/horário text)
  const textBasedRemovePatterns = [
    // Remove divs containing WhatsApp/phone/hours patterns
    /<(?:div|p|span)[^>]*>[\s\S]*?Fale no WhatsApp[\s\S]*?<\/(?:div|p|span)>/gi,
    /<(?:div|p|span)[^>]*>[\s\S]*?HORÁRIO DE ATENDIMENTO[\s\S]*?<\/(?:div|p|span)>/gi,
    /<(?:div|p|span)[^>]*>[\s\S]*?Compre por telefone[\s\S]*?<\/(?:div|p|span)>/gi,
    // Remove empty anchors with WhatsApp links
    /<a[^>]*(?:wa\.me|whatsapp)[^>]*>[\s\S]*?<\/a>/gi,
  ];
  
  for (const pattern of textBasedRemovePatterns) {
    mainContent = mainContent.replace(pattern, '');
  }

  // ===== PHASE 5: Keep allowed tags for content =====
  const allowedTags = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
    'ul', 'ol', 'li',
    'a',
    'span', 'div',
    'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
    'figure', 'figcaption',
    'video', 'source',
    'iframe',
  ];

  // Process tags - keep allowed ones with safe attributes
  mainContent = mainContent.replace(/<(\w+)([^>]*)>/gi, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!allowedTags.includes(lowerTag)) {
      return '';
    }

    // Keep specific attributes based on tag type
    let safeAttrs = '';
    
    if (lowerTag === 'a') {
      const hrefMatch = /href="([^"]+)"/.exec(attrs);
      const targetMatch = /target="([^"]+)"/.exec(attrs);
      // Skip WhatsApp/phone links
      if (hrefMatch && /(wa\.me|whatsapp|tel:)/i.test(hrefMatch[1])) {
        return '';
      }
      if (hrefMatch) safeAttrs += ` href="${hrefMatch[1]}"`;
      if (targetMatch) safeAttrs += ` target="${targetMatch[1]}"`;
    } else if (lowerTag === 'img') {
      const srcMatch = /src="([^"]+)"/.exec(attrs);
      const altMatch = /alt="([^"]+)"/.exec(attrs);
      const widthMatch = /width="([^"]+)"/.exec(attrs);
      const heightMatch = /height="([^"]+)"/.exec(attrs);
      if (srcMatch) safeAttrs += ` src="${srcMatch[1]}"`;
      if (altMatch) safeAttrs += ` alt="${altMatch[1]}"`;
      if (widthMatch) safeAttrs += ` width="${widthMatch[1]}"`;
      if (heightMatch) safeAttrs += ` height="${heightMatch[1]}"`;
    } else if (lowerTag === 'iframe') {
      const srcMatch = /src="([^"]+)"/.exec(attrs);
      // Only allow YouTube/Vimeo iframes
      if (srcMatch && /(youtube|vimeo|youtu\.be)/i.test(srcMatch[1])) {
        safeAttrs += ` src="${srcMatch[1]}"`;
        const widthMatch = /width="([^"]+)"/.exec(attrs);
        const heightMatch = /height="([^"]+)"/.exec(attrs);
        if (widthMatch) safeAttrs += ` width="${widthMatch[1]}"`;
        if (heightMatch) safeAttrs += ` height="${heightMatch[1]}"`;
        safeAttrs += ' frameborder="0" allowfullscreen';
      } else {
        return ''; // Skip non-video iframes
      }
    } else if (lowerTag === 'video' || lowerTag === 'source') {
      const srcMatch = /src="([^"]+)"/.exec(attrs);
      const typeMatch = /type="([^"]+)"/.exec(attrs);
      if (srcMatch) safeAttrs += ` src="${srcMatch[1]}"`;
      if (typeMatch) safeAttrs += ` type="${typeMatch[1]}"`;
      if (lowerTag === 'video') safeAttrs += ' controls';
    }

    return `<${lowerTag}${safeAttrs}>`;
  });

  // Close unmatched tags
  mainContent = mainContent.replace(/<\/(\w+)>/gi, (match, tag) => {
    const lowerTag = tag.toLowerCase();
    return allowedTags.includes(lowerTag) ? `</${lowerTag}>` : '';
  });

  // ===== PHASE 6: Final cleanup =====
  // Remove empty divs and spans
  mainContent = mainContent
    .replace(/<div>\s*<\/div>/gi, '')
    .replace(/<span>\s*<\/span>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<a>\s*<\/a>/gi, '');

  // Clean up excessive whitespace but preserve structure
  mainContent = mainContent
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/>\s+</g, '> <')
    .trim();

  // If still too short or empty, try markdown fallback
  if (mainContent.length < 50 && markdown && markdown.length > 50) {
    console.log('Cleaned HTML too short, using markdown converted to HTML');
    return convertMarkdownToHtml(markdown);
  }

  return mainContent || '';
}

// Convert markdown to basic HTML
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^\*\*\*+$/gm, '<hr>');

  // Lists
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive li elements in ul/ol
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs - wrap remaining text blocks
  const lines = html.split('\n');
  const processed: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processed.push('');
    } else if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<img') ||
      trimmed.startsWith('<blockquote')
    ) {
      processed.push(trimmed);
    } else {
      processed.push(`<p>${trimmed}</p>`);
    }
  }

  return processed.join('\n').replace(/<p><\/p>/g, '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tenantId, pages, storeUrl } = await req.json() as ImportPagesRequest;

    if (!tenantId || !pages || !Array.isArray(pages)) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId e pages são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract base URL from storeUrl if provided
    let baseUrl = '';
    if (storeUrl) {
      try {
        const urlObj = new URL(storeUrl.startsWith('http') ? storeUrl : `https://${storeUrl}`);
        baseUrl = urlObj.origin;
      } catch (e) {
        console.warn(`[IMPORT] Could not parse storeUrl: ${storeUrl}`);
      }
    }

    console.log(`[IMPORT] Starting import of ${pages.length} institutional pages for tenant ${tenantId}`);
    console.log(`[IMPORT] Base URL for relative URLs: ${baseUrl || 'none'}`);
    console.log(`[IMPORT] Pages to import:`, pages.map(p => `${p.title} (${p.url})`).join(', '));

    // ===== Fetch default page template (Shopify-like model) =====
    let defaultTemplateId: string | null = null;
    const { data: defaultTemplate } = await supabase
      .from('page_templates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .maybeSingle();
    
    if (defaultTemplate) {
      defaultTemplateId = defaultTemplate.id;
      console.log(`[IMPORT] Using default template: ${defaultTemplateId}`);
    } else {
      console.log('[IMPORT] No default template found, pages will be created without template');
    }

    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
      pages: [] as { slug: string; title: string; hasContent: boolean }[],
    };

    let pageIndex = 0;
    for (const page of pages) {
      pageIndex++;
      
      try {
        // Add delay between scrapes to avoid rate limiting (except first one)
        if (pageIndex > 1) {
          console.log(`[IMPORT] Waiting 1s before next scrape (page ${pageIndex}/${pages.length})...`);
          await new Promise(r => setTimeout(r, 1000));
        }
        
        // Normalize slug - remove leading slash
        const normalizedSlug = page.slug.replace(/^\/+/, '').toLowerCase();
        console.log(`[IMPORT] Processing page ${pageIndex}/${pages.length}: ${page.title} -> ${normalizedSlug}`);
        
        // Validate and normalize URL
        if (!page.url) {
          console.error(`[IMPORT] No URL for page ${normalizedSlug}, skipping`);
          results.failed++;
          results.errors.push(`${page.title}: URL não fornecida`);
          continue;
        }
        
        // Resolve relative URLs using baseUrl
        let fullUrl = page.url;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
          if (baseUrl) {
            fullUrl = `${baseUrl}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
            console.log(`[IMPORT] Resolved relative URL: ${page.url} -> ${fullUrl}`);
          } else {
            console.error(`[IMPORT] Page ${normalizedSlug} has relative URL but no baseUrl available: ${page.url}`);
            results.failed++;
            results.errors.push(`${page.title}: URL relativa sem domínio base`);
            continue;
          }
        }
        
        // Check if page already exists
        const { data: existing } = await supabase
          .from('store_pages')
          .select('id, slug')
          .eq('tenant_id', tenantId)
          .eq('slug', normalizedSlug)
          .maybeSingle();

        if (existing) {
          console.log(`[IMPORT] Page ${normalizedSlug} already exists, skipping`);
          results.skipped++;
          continue;
        }

        // Scrape page content with logging
        console.log(`[IMPORT] Scraping content from: ${fullUrl}`);
        const scraped = await scrapePageContent(fullUrl);

        let individualContent = '';
        let seoTitle = page.title;
        let seoDescription = '';
        let hasRealContent = false;

        if (scraped && (scraped.html.length > 50 || scraped.markdown.length > 50)) {
          // Use cleaned HTML as individual_content (Shopify-like model)
          individualContent = scraped.html;
          seoTitle = scraped.title || page.title;
          seoDescription = scraped.description || '';
          hasRealContent = individualContent.length > 50;
          console.log(`Page ${normalizedSlug} has real content: ${individualContent.length} chars`);
        } else {
          // Create as DRAFT if no content was extracted (don't publish empty pages)
          console.warn(`Page ${normalizedSlug} has no content, creating as draft`);
          individualContent = '';
        }

        // Generate intelligent block structure based on content analysis
        // Uses content-to-block mapper to create FAQ, Testimonials, etc. blocks
        console.log(`[IMPORT] Analyzing content for intelligent block mapping: ${page.title}`);
        const pageContent = createPageWithMappedBlocks(individualContent, page.title);

        // Insert page with block-based content (editable in builder)
        const { error: insertError } = await supabase
          .from('store_pages')
          .insert({
            tenant_id: tenantId,
            title: page.title,
            slug: normalizedSlug,
            type: 'institutional',
            status: hasRealContent ? 'published' : 'draft',
            content: pageContent, // Block structure for builder editing
            individual_content: null, // Not using template model
            template_id: null, // Not using template for imported pages
            is_published: hasRealContent,
            is_system: false,
            seo_title: seoTitle,
            seo_description: seoDescription,
          });

        if (insertError) {
          console.error(`Error inserting page ${normalizedSlug}:`, insertError);
          results.failed++;
          results.errors.push(`${page.title} (${normalizedSlug}): ${insertError.message}`);
        } else {
          console.log(`Imported page: ${normalizedSlug} (hasContent: ${hasRealContent})`);
          results.imported++;
          results.pages.push({ 
            slug: normalizedSlug, 
            title: page.title,
            hasContent: hasRealContent,
          });
        }
      } catch (error) {
        console.error(`Error processing page ${page.slug}:`, error);
        results.failed++;
        results.errors.push(`${page.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`Import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import pages error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
