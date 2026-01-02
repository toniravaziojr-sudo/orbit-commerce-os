// =====================================================
// SHOPIFY OUTPUT NORMALIZER v1
// =====================================================
// Normaliza ordem e formatação dos elementos extraídos
// após seed-based extraction (V6)
// 
// REGRAS FIXAS (anti-regressão):
// 1. Ordem canônica: Heading → Video → Body text → CTA
// 2. Remover ruídos: "Share", títulos duplicados do YouTube
// 3. Converter formatação: headings em vez de texto plano
// =====================================================

interface NormalizedOutput {
  title: string | null;
  videoId: string | null;
  bodyHtml: string;
  ctaButton: { text: string; href: string } | null;
  logs: string[];
}

// Patterns for noise removal
const NOISE_PATTERNS = [
  /^Share$/im,
  /^Compartilhar$/im,
  /^Compartilhe$/im,
  /- YouTube$/im,
  /^Watch on YouTube$/im,
  /^Assistir no YouTube$/im,
  /^Assista no YouTube$/im,
];

// Noise phrases that should be removed from text
const NOISE_PHRASES = [
  'Share',
  'Compartilhar',
  'Compartilhe',
  '- YouTube',
  'Watch on YouTube',
  'Assistir no YouTube',
  'Assista no YouTube',
];

/**
 * Normaliza o HTML extraído para formato estruturado
 * Aplica ordem canônica e remove ruídos
 */
export function normalizeShopifyOutput(
  extractedHtml: string,
  pageTitle: string,
  logs: string[]
): NormalizedOutput {
  logs.push(`[NORMALIZER] Starting normalization for: "${pageTitle.substring(0, 50)}..."`);
  logs.push(`[NORMALIZER] Input HTML: ${extractedHtml.length} chars`);
  
  const result: NormalizedOutput = {
    title: null,
    videoId: null,
    bodyHtml: '',
    ctaButton: null,
    logs,
  };
  
  // Step 1: Extract video ID if present
  const videoMatch = extractedHtml.match(/<iframe[^>]+src=["'][^"']*(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>/i);
  if (videoMatch) {
    result.videoId = videoMatch[1];
    logs.push(`[NORMALIZER] Extracted video ID: ${result.videoId}`);
  }
  
  // Step 2: Extract CTA button
  const ctaPatterns = [
    /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([^<]+)<\/a>/gi,
    /<a[^>]+class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi,
    /<button[^>]*>([^<]+)<\/button>/gi,
  ];
  
  for (const pattern of ctaPatterns) {
    const match = pattern.exec(extractedHtml);
    if (match) {
      if (match.length === 3) {
        result.ctaButton = { href: match[1], text: cleanText(match[2]) };
      } else if (match.length === 2) {
        result.ctaButton = { href: '#', text: cleanText(match[1]) };
      }
      logs.push(`[NORMALIZER] Extracted CTA: "${result.ctaButton?.text}" -> ${result.ctaButton?.href}`);
      break;
    }
  }
  
  // Step 3: Extract text content and clean it
  let textContent = extractedHtml;
  
  // Remove iframes (videos) from text processing
  textContent = textContent.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  
  // Remove script/style
  textContent = textContent.replace(/<script[\s\S]*?<\/script>/gi, '');
  textContent = textContent.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Get plain text for analysis
  const plainText = textContent.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim();
  logs.push(`[NORMALIZER] Plain text: ${plainText.length} chars`);
  
  // Split into lines for processing
  const lines = plainText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  logs.push(`[NORMALIZER] Lines before cleaning: ${lines.length}`);
  
  // Step 4: Remove noise and duplicates
  const cleanedLines: string[] = [];
  const seenNormalized = new Set<string>();
  let removedNoise = 0;
  let removedDupes = 0;
  
  for (const line of lines) {
    // Check for noise patterns
    let isNoise = false;
    for (const phrase of NOISE_PHRASES) {
      if (line.toLowerCase() === phrase.toLowerCase() || 
          line.toLowerCase().trim() === phrase.toLowerCase().trim()) {
        isNoise = true;
        removedNoise++;
        logs.push(`[NORMALIZER] Removed noise: "${line.substring(0, 50)}"`);
        break;
      }
    }
    if (isNoise) continue;
    
    // Check for YouTube title duplicates (if we have a video)
    if (result.videoId) {
      // Remove lines that look like video titles (repeated or with "- YouTube")
      if (line.includes('- YouTube') || 
          line.toLowerCase().includes('youtube') ||
          line.toLowerCase().includes('entenda como funciona')) {
        // Check if this is a duplicate of the page title
        const normalizedLine = normalizeForComparison(line.replace(/- YouTube$/i, '').trim());
        const normalizedTitle = normalizeForComparison(pageTitle);
        
        if (normalizedLine === normalizedTitle || 
            levenshteinSimilarity(normalizedLine, normalizedTitle) > 0.8) {
          removedDupes++;
          logs.push(`[NORMALIZER] Removed video title dupe: "${line.substring(0, 50)}"`);
          continue;
        }
      }
    }
    
    // Check for exact duplicates (normalized)
    const normalizedLine = normalizeForComparison(line);
    if (seenNormalized.has(normalizedLine)) {
      removedDupes++;
      logs.push(`[NORMALIZER] Removed duplicate: "${line.substring(0, 40)}"`);
      continue;
    }
    
    seenNormalized.add(normalizedLine);
    cleanedLines.push(line);
  }
  
  logs.push(`[NORMALIZER] Cleaned lines: ${cleanedLines.length} (removed ${removedNoise} noise, ${removedDupes} dupes)`);
  
  // Step 5: Identify title (first significant heading or first line)
  if (cleanedLines.length > 0) {
    // Check if first line matches page title
    const firstLine = cleanedLines[0];
    const normalizedFirst = normalizeForComparison(firstLine);
    const normalizedPageTitle = normalizeForComparison(pageTitle);
    
    if (normalizedFirst === normalizedPageTitle || 
        levenshteinSimilarity(normalizedFirst, normalizedPageTitle) > 0.7) {
      result.title = firstLine;
      cleanedLines.shift(); // Remove from body
      logs.push(`[NORMALIZER] Title extracted: "${result.title}"`);
    }
  }
  
  // Step 6: Build structured body HTML
  if (cleanedLines.length > 0) {
    const bodyParts: string[] = [];
    let currentParagraph: string[] = [];
    
    for (const line of cleanedLines) {
      // Check if line looks like a heading (ALL CAPS, short, no punctuation)
      if (isLikelyHeading(line)) {
        // Flush current paragraph
        if (currentParagraph.length > 0) {
          bodyParts.push(`<p>${currentParagraph.join(' ')}</p>`);
          currentParagraph = [];
        }
        // Add as heading
        bodyParts.push(`<h3>${line}</h3>`);
        logs.push(`[NORMALIZER] Formatted as heading: "${line.substring(0, 30)}"`);
      } else {
        currentParagraph.push(line);
      }
    }
    
    // Flush remaining paragraph
    if (currentParagraph.length > 0) {
      bodyParts.push(`<p>${currentParagraph.join(' ')}</p>`);
    }
    
    result.bodyHtml = bodyParts.join('\n');
  }
  
  logs.push(`[NORMALIZER] Final body HTML: ${result.bodyHtml.length} chars`);
  logs.push(`[NORMALIZER] Result: title=${!!result.title}, video=${!!result.videoId}, body=${result.bodyHtml.length}chars, cta=${!!result.ctaButton}`);
  
  return result;
}

/**
 * Verifica se uma linha parece ser um heading
 * (ALL CAPS, curta, sem pontuação final)
 */
function isLikelyHeading(line: string): boolean {
  // All caps check
  const isAllCaps = line === line.toUpperCase() && /[A-ZÀ-Ú]/.test(line);
  
  // Length check (headings are typically short)
  const isShort = line.length <= 50;
  
  // No ending punctuation (except : or ?)
  const noEndPunctuation = !/[.!,]$/.test(line);
  
  // Has at least one letter
  const hasLetters = /[a-zA-ZÀ-ú]/.test(line);
  
  // Common heading patterns in Portuguese
  const headingPatterns = [
    /^grau\s+de/i,
    /^como\s+funciona/i,
    /^passo\s+\d/i,
    /^etapa\s+\d/i,
    /^benefícios?$/i,
    /^vantagens?$/i,
    /^perguntas?\s+frequentes?/i,
    /^faq$/i,
    /^sobre\s+/i,
    /^o\s+que\s+é/i,
  ];
  
  const matchesPattern = headingPatterns.some(p => p.test(line));
  
  return (isAllCaps && isShort && noEndPunctuation && hasLetters) || matchesPattern;
}

/**
 * Normaliza texto para comparação (remove acentos, lowercase, trim)
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula similaridade entre duas strings (0-1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[a.length][b.length];
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
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
 * Retorna blocos compatíveis com BlockNode do import-pages
 */
// deno-lint-ignore no-explicit-any
export function createBlocksFromNormalizedOutput(
  normalized: NormalizedOutput,
  generateBlockId: (prefix: string) => string
): any[] {
  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [];
  
  // 1. Title as RichText heading (if exists and different from page title in parent)
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
  }
  
  // 2. Video (if exists)
  if (normalized.videoId) {
    blocks.push({
      id: generateBlockId('video'),
      type: 'YouTubeVideo',
      props: {
        videoId: normalized.videoId,
        aspectRatio: '16:9',
        autoplay: false,
        muted: false,
        controls: true,
      },
      children: [],
    });
  }
  
  // 3. Body text (if exists)
  if (normalized.bodyHtml && normalized.bodyHtml.length > 0) {
    // Style the body HTML for centering
    const styledBody = `<div style="text-align: center; max-width: 600px; margin: 0 auto;">${normalized.bodyHtml}</div>`;
    
    blocks.push({
      id: generateBlockId('body'),
      type: 'RichText',
      props: {
        content: styledBody,
        fontFamily: 'inherit',
        fontSize: 'base',
        fontWeight: 'normal',
      },
      children: [],
    });
  }
  
  // 4. CTA Button (if exists)
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
      },
      children: [],
    });
  }
  
  return blocks;
}
