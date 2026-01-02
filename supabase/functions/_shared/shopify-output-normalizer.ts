// =====================================================
// SHOPIFY OUTPUT NORMALIZER v2
// =====================================================
// Normaliza ordem e formatação dos elementos extraídos
// após seed-based extraction (V6)
// 
// REGRAS FIXAS (anti-regressão):
// 1. Ordem canônica: Heading → Video → Body text → CTA
// 2. Remover ruídos: "Share", títulos duplicados do YouTube
// 3. Converter formatação: headings em vez de texto plano
// 4. NUNCA colapsar tudo em 1 RichText - cada seção = bloco separado
// 5. YouTubeVideo DEVE ter url preenchida (não apenas videoId)
// =====================================================

interface NormalizedOutput {
  title: string | null;
  videoUrl: string | null; // CHANGED: URL completa, não apenas ID
  bodyHtml: string;
  ctaButton: { text: string; href: string } | null;
  logs: string[];
}

// Noise phrases that should be removed from text
const NOISE_PHRASES = [
  'share',
  'compartilhar',
  'compartilhe',
  'watch on youtube',
  'assistir no youtube',
  'assista no youtube',
  'skin care',
  'brinco',
  'pulseira',
  'mais pesquisados',
  'cnpj',
  'termos de uso',
  'política de privacidade',
  'política de troca',
  'política de reembolso',
  'fale conosco',
  'central de ajuda',
  'sobre nós',
  'quem somos',
];

// Footer/trending blacklist patterns
const BLACKLIST_PATTERNS = [
  /skin\s*care/i,
  /brinco/i,
  /pulseira/i,
  /acessório/i,
  /colares?/i,
  /anéis?/i,
  /mais\s+pesquisados?/i,
  /mais\s+vendidos?/i,
  /cnpj/i,
  /termos?\s+de\s+uso/i,
  /polític/i,
  /fale\s+conosco/i,
  /central\s+de\s+ajuda/i,
  /sobre\s+nós/i,
  /quem\s+somos/i,
  /todos\s+os\s+direitos/i,
  /copyright/i,
];

/**
 * Normaliza o HTML extraído para formato estruturado
 * V2: NÃO colapsa conteúdo, preserva estrutura
 */
export function normalizeShopifyOutput(
  extractedHtml: string,
  pageTitle: string,
  logs: string[]
): NormalizedOutput {
  logs.push(`[NORMALIZER V2] Starting normalization for: "${pageTitle.substring(0, 50)}..."`);
  logs.push(`[NORMALIZER V2] Input HTML: ${extractedHtml.length} chars`);
  
  const result: NormalizedOutput = {
    title: null,
    videoUrl: null,
    bodyHtml: '',
    ctaButton: null,
    logs,
  };
  
  // Step 1: Extract video URL (full URL, not just ID)
  const videoMatch = extractedHtml.match(/<iframe[^>]+src=["']([^"']*(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*)["'][^>]*>/i);
  if (videoMatch) {
    const videoId = videoMatch[2];
    result.videoUrl = `https://www.youtube.com/embed/${videoId}`;
    logs.push(`[NORMALIZER V2] Extracted video URL: ${result.videoUrl}`);
  }
  
  // Step 2: Extract CTA button
  const ctaPatterns = [
    /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([^<]+)<\/a>/gi,
    /<a[^>]+class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi,
  ];
  
  for (const pattern of ctaPatterns) {
    const match = pattern.exec(extractedHtml);
    if (match && match.length === 3) {
      const ctaText = cleanText(match[2]);
      const ctaHref = cleanText(match[1]);
      
      // Validate CTA is not noise
      if (ctaText.length > 2 && !isNoise(ctaText)) {
        result.ctaButton = { href: ctaHref, text: ctaText };
        logs.push(`[NORMALIZER V2] Extracted CTA: "${result.ctaButton.text}" -> ${result.ctaButton.href}`);
        break;
      }
    }
  }
  
  // Step 3: Extract structured content (not collapsed)
  // Remove scripts, styles, iframes, buttons/CTAs
  let contentHtml = extractedHtml;
  contentHtml = contentHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  contentHtml = contentHtml.replace(/<style[\s\S]*?<\/style>/gi, '');
  contentHtml = contentHtml.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  contentHtml = contentHtml.replace(/<a[^>]+class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
  
  // Step 4: Parse HTML structure to find meaningful sections
  // Look for H1/H2/H3 headings and paragraphs
  const titleH1 = extractFirstHeading(contentHtml, 'h1');
  const titleH2 = extractFirstHeading(contentHtml, 'h2');
  
  // Determine the main title (prefer page title match)
  const normalizedPageTitle = normalizeForComparison(pageTitle);
  
  if (titleH1) {
    const normalizedH1 = normalizeForComparison(titleH1);
    if (normalizedH1.includes(normalizedPageTitle.substring(0, 20)) || 
        normalizedPageTitle.includes(normalizedH1.substring(0, 20))) {
      result.title = titleH1;
      logs.push(`[NORMALIZER V2] Title from H1: "${result.title}"`);
    }
  }
  
  if (!result.title && titleH2) {
    const normalizedH2 = normalizeForComparison(titleH2);
    if (normalizedH2.includes(normalizedPageTitle.substring(0, 20)) || 
        normalizedPageTitle.includes(normalizedH2.substring(0, 20))) {
      result.title = titleH2;
      logs.push(`[NORMALIZER V2] Title from H2: "${result.title}"`);
    }
  }
  
  // If no heading matches, use page title
  if (!result.title) {
    // Clean up page title (remove " – Loja" suffix etc)
    let cleanTitle = pageTitle.replace(/\s*[–-]\s*.+$/, '').trim();
    if (cleanTitle.length > 3) {
      result.title = cleanTitle;
      logs.push(`[NORMALIZER V2] Title from page title: "${result.title}"`);
    }
  }
  
  // Step 5: Extract body sections - V2 FIX
  // Shopify uses divs, not semantic HTML - extract text content more aggressively
  const bodyParts: string[] = [];
  
  // Find all headings in content (h1, h2, h3, h4)
  const headingMatches = contentHtml.matchAll(/<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const match of headingMatches) {
    const headingText = cleanTextFromHtml(match[2]);
    if (headingText.length > 3 && !isNoise(headingText) && headingText !== result.title) {
      bodyParts.push(`<h3>${headingText}</h3>`);
      logs.push(`[NORMALIZER V2] Found body heading: "${headingText.substring(0, 40)}"`);
    }
  }
  
  // Find paragraphs with meaningful content
  const paragraphMatches = contentHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const match of paragraphMatches) {
    const paraText = cleanTextFromHtml(match[1]);
    if (paraText.length > 15 && !isNoise(paraText) && !isBlacklistedContent(paraText, logs)) {
      bodyParts.push(`<p>${paraText}</p>`);
      logs.push(`[NORMALIZER V2] Found body paragraph: "${paraText.substring(0, 40)}..."`);
    }
  }
  
  // V2 FIX: Shopify uses divs with text - extract text content from remaining HTML
  if (bodyParts.length === 0) {
    logs.push(`[NORMALIZER V2] No structured p/h tags found, extracting from divs/text`);
    
    // Remove already extracted content (title, iframes, scripts)
    let remainingHtml = contentHtml;
    if (result.title) {
      const escapedTitle = result.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      remainingHtml = remainingHtml.replace(new RegExp(`<h[1-6][^>]*>${escapedTitle}</h[1-6]>`, 'gi'), '');
    }
    
    // Extract text from divs that might contain body content
    // Look for specific known patterns first (GRAU DE CALVÍCIE, etc.)
    const grauMatch = remainingHtml.match(/grau\s+de\s+calv[íi]cie[^<]*/i);
    if (grauMatch) {
      const grauText = cleanTextFromHtml(grauMatch[0]);
      if (grauText.length > 5) {
        bodyParts.push(`<h3>${grauText.toUpperCase()}</h3>`);
        logs.push(`[NORMALIZER V2] Found GRAU pattern: "${grauText}"`);
      }
    }
    
    // Look for "Consulte aqui" pattern (common body text)
    const consulteMatch = remainingHtml.match(/consulte\s+aqui[^<.]*/i);
    if (consulteMatch) {
      const consulteText = cleanTextFromHtml(consulteMatch[0]);
      if (consulteText.length > 10) {
        // Try to get the full sentence
        const fullSentenceMatch = remainingHtml.match(/consulte\s+aqui[^<]*[^.]*\./i);
        const fullText = fullSentenceMatch ? cleanTextFromHtml(fullSentenceMatch[0]) : consulteText;
        bodyParts.push(`<p>${fullText}</p>`);
        logs.push(`[NORMALIZER V2] Found Consulte pattern: "${fullText.substring(0, 40)}..."`);
      }
    }
    
    // Generic text extraction from remaining HTML
    if (bodyParts.length === 0) {
      // Get plain text, preserving some structure
      let plainText = remainingHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Split into lines
      const lines = plainText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 10);
      
      let cleanedCount = 0;
      let noiseCount = 0;
      
      for (const line of lines) {
        if (isNoise(line)) {
          noiseCount++;
          continue;
        }
        
        if (isBlacklistedContent(line, logs)) {
          noiseCount++;
          continue;
        }
        
        // Skip if it's the title
        if (result.title && normalizeForComparison(line) === normalizeForComparison(result.title)) {
          continue;
        }
        
        // Check if it's a heading (ALL CAPS, short)
        if (isLikelyHeading(line)) {
          bodyParts.push(`<h3>${line}</h3>`);
          logs.push(`[NORMALIZER V2] Plain text heading: "${line}"`);
        } else if (line.length > 20) {
          bodyParts.push(`<p>${line}</p>`);
          logs.push(`[NORMALIZER V2] Plain text paragraph: "${line.substring(0, 40)}..."`);
        }
        cleanedCount++;
        
        // Limit to reasonable amount
        if (cleanedCount >= 10) break;
      }
      
      logs.push(`[NORMALIZER V2] Plain text extraction: ${cleanedCount} lines kept, ${noiseCount} noise removed`);
    }
  }
  
  // Deduplicate body parts
  const uniqueBodyParts: string[] = [];
  const seenContent = new Set<string>();
  
  for (const part of bodyParts) {
    const normalized = normalizeForComparison(part.replace(/<[^>]+>/g, ''));
    if (!seenContent.has(normalized) && normalized.length > 3) {
      seenContent.add(normalized);
      uniqueBodyParts.push(part);
    }
  }
  
  result.bodyHtml = uniqueBodyParts.join('\n');
  
  logs.push(`[NORMALIZER V2] Final body HTML: ${result.bodyHtml.length} chars, ${uniqueBodyParts.length} parts`);
  logs.push(`[NORMALIZER V2] Result: title=${!!result.title}, video=${!!result.videoUrl}, body=${result.bodyHtml.length}chars, cta=${!!result.ctaButton}`);
  
  return result;
}

/**
 * Extract first heading of given type
 */
function extractFirstHeading(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = html.match(regex);
  if (match) {
    return cleanTextFromHtml(match[1]);
  }
  return null;
}

/**
 * Check if text is noise
 */
function isNoise(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  
  // Check against noise phrases
  for (const phrase of NOISE_PHRASES) {
    if (normalized === phrase || normalized.includes(phrase)) {
      return true;
    }
  }
  
  // Check for YouTube title duplicates
  if (normalized.includes('- youtube') || normalized.endsWith('youtube')) {
    return true;
  }
  
  // Very short text is likely noise
  if (normalized.length < 3) return true;
  
  // Single word that looks like a menu item
  if (!normalized.includes(' ') && normalized.length < 15) {
    return true;
  }
  
  return false;
}

/**
 * Check if content matches blacklist patterns
 */
function isBlacklistedContent(text: string, logs: string[]): boolean {
  for (const pattern of BLACKLIST_PATTERNS) {
    if (pattern.test(text)) {
      logs.push(`[NORMALIZER V2] Blacklisted: "${text.substring(0, 30)}..."`);
      return true;
    }
  }
  return false;
}

/**
 * Verifica se uma linha parece ser um heading
 */
function isLikelyHeading(line: string): boolean {
  const isAllCaps = line === line.toUpperCase() && /[A-ZÀ-Ú]/.test(line);
  const isShort = line.length <= 60;
  const noEndPunctuation = !/[.!,]$/.test(line);
  const hasLetters = /[a-zA-ZÀ-ú]/.test(line);
  
  const headingPatterns = [
    /^grau\s+de/i,
    /^como\s+funciona/i,
    /^passo\s+\d/i,
    /^etapa\s+\d/i,
    /^benefícios?$/i,
    /^vantagens?$/i,
  ];
  
  const matchesPattern = headingPatterns.some(p => p.test(line));
  
  return (isAllCaps && isShort && noEndPunctuation && hasLetters) || matchesPattern;
}

/**
 * Normaliza texto para comparação
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean text from HTML tags
 */
function cleanTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpa texto removendo espaços extras e HTML entities
 */
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

/**
 * Converte output normalizado em blocos do Builder
 * V2: Usa url em vez de videoId, garante blocos separados
 */
// deno-lint-ignore no-explicit-any
export function createBlocksFromNormalizedOutput(
  normalized: NormalizedOutput,
  generateBlockId: (prefix: string) => string
): any[] {
  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [];
  
  // 1. Title as RichText heading
  if (normalized.title) {
    blocks.push({
      id: generateBlockId('heading'),
      type: 'RichText',
      props: {
        content: `<h1 style="text-align: center; margin-bottom: 24px;">${normalized.title}</h1>`,
        fontFamily: 'inherit',
        fontSize: 'xl',
        fontWeight: 'bold',
      },
      children: [],
    });
    console.log(`[NORMALIZER V2] Created Title block: "${normalized.title.substring(0, 40)}..."`);
  }
  
  // 2. Video (MUST have youtubeUrl - prop name used by YouTubeVideoBlock component)
  if (normalized.videoUrl) {
    blocks.push({
      id: generateBlockId('video'),
      type: 'YouTubeVideo',
      props: {
        youtubeUrl: normalized.videoUrl, // FIX: prop name is youtubeUrl, not url
        aspectRatio: '16:9',
        autoplay: false,
        muted: false,
        controls: true,
      },
      children: [],
    });
    console.log(`[NORMALIZER V2] Created Video block with youtubeUrl: ${normalized.videoUrl}`);
  }
  
  // 3. Body text - estruturado com h3 para heading e p para parágrafo
  if (normalized.bodyHtml && normalized.bodyHtml.length > 0) {
    // Garante que h3 tenha estilo de heading visual (negrito, maior, espaçamento)
    const styledBody = normalized.bodyHtml
      .replace(/<h3>/g, '<h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 24px; margin-bottom: 8px; text-transform: uppercase;">')
      .replace(/<p>/g, '<p style="margin-bottom: 16px;">');
    
    const wrappedBody = `<div style="text-align: center; max-width: 600px; margin: 24px auto;">${styledBody}</div>`;
    
    blocks.push({
      id: generateBlockId('body'),
      type: 'RichText',
      props: {
        content: wrappedBody,
        fontFamily: 'inherit',
        fontSize: 'base',
        fontWeight: 'normal',
      },
      children: [],
    });
    console.log(`[NORMALIZER V2] Created Body block (structured): ${normalized.bodyHtml.length} chars`);
  }
  
  // 4. CTA Button - usando cor primária do tenant (preto)
  if (normalized.ctaButton) {
    blocks.push({
      id: generateBlockId('cta'),
      type: 'Button',
      props: {
        text: normalized.ctaButton.text,
        url: normalized.ctaButton.href,
        variant: 'primary',
        size: 'lg',
        fullWidth: false,
        alignment: 'center',
        // Força cor preta (cor primária padrão do tenant) - não altera tema global
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
      children: [],
    });
    console.log(`[NORMALIZER V2] Created CTA block (black): "${normalized.ctaButton.text}" -> ${normalized.ctaButton.href}`);
  }
  
  console.log(`[NORMALIZER V2] Total blocks created: ${blocks.length}`);
  
  return blocks;
}
