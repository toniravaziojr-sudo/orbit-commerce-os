import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { segmentPageBySections, hasExplicitSectionMarkers } from './section-segmenter.ts';
import { materializeVideos, hasVideoContent, extractVideoUrls, isVideoCarouselSection } from './video-materializer.ts';
import { extractAllElementsInOrder } from '../_shared/element-extractor.ts';
import { classifyAllElements } from '../_shared/element-classifier.ts';
import { buildPageFromElements, processElementsWithAutoBlockCreation, mergeConsecutiveElements } from '../_shared/block-builder.ts';
import { analyzePageVisually, filterElementsByVisualAnalysis } from '../_shared/visual-content-analyzer.ts';
import { extractMainContentByPlatform } from '../_shared/platform-content-extractor.ts';
import { detectPlatformFromHtml } from '../_shared/platform-detector.ts';
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
// AI CLASSIFICATION INTEGRATION (NEW)
// =============================================
// The AI now CLASSIFIES, not CONVERTS
// It decides modes per section, identifies editables
// =============================================

interface SectionClassification {
  id: string;
  name: string;
  startMarker: string;
  endMarker?: string;
  mode: 'native-blocks' | 'pixel-perfect' | 'hybrid';
  confidence: number;
  reasoning: string;
  suggestedBlockTypes?: string[];
  editableElements?: EditableElementClassification[];
}

interface EditableElementClassification {
  type: 'button' | 'link' | 'cta';
  text: string;
  selector: string;
  reasoning: string;
}

interface PageClassification {
  pageType: 'landing-custom' | 'institutional' | 'hybrid' | 'simple';
  complexity: 'low' | 'medium' | 'high';
  hasDesktopMobileVariants: boolean;
  dependsOnExternalCss: boolean;
  sections: SectionClassification[];
  globalEditables: EditableElementClassification[];
  summary: string;
  recommendedStrategy: string;
}

interface AIClassificationResult {
  success: boolean;
  classification?: PageClassification;
  error?: string;
  fallback?: boolean;
}

// Legacy interface for backwards compatibility
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

// Global CSS extracted from the page (used by CustomBlocks)
let globalExtractedCss = '';

// Extract external CSS URLs from HTML
function extractExternalCssUrls(html: string): string[] {
  const urls: string[] = [];
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const hrefFirstRegex = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    // Filter: only get relevant CSS files (landing-pages, theme, etc.), skip checkout/polyfills
    if (url && !url.includes('checkout-web') && !url.includes('polyfill')) {
      urls.push(url);
    }
  }
  while ((match = hrefFirstRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && !urls.includes(url) && !url.includes('checkout-web') && !url.includes('polyfill')) {
      urls.push(url);
    }
  }
  
  console.log(`[CSS] Found ${urls.length} external CSS URLs`);
  return urls;
}

// =============================================
// CRITICAL: Rewrite relative URLs in CSS to absolute
// This fixes url(../fonts/...), url(../images/...), etc.
// Without this, backgrounds/fonts break when CSS is inlined
// =============================================
function rewriteCssUrls(cssText: string, cssFileUrl: string): string {
  if (!cssText || !cssFileUrl) return cssText;
  
  try {
    const cssBaseUrl = new URL(cssFileUrl);
    let rewriteCount = 0;
    
    // Match url() with various quote styles
    const urlPattern = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi;
    
    const rewritten = cssText.replace(urlPattern, (match, quote, urlValue) => {
      // Skip data URIs, absolute URLs, and blob URLs
      if (
        urlValue.startsWith('data:') || 
        urlValue.startsWith('http://') || 
        urlValue.startsWith('https://') || 
        urlValue.startsWith('blob:') ||
        urlValue.startsWith('//')
      ) {
        return match;
      }
      
      try {
        // Resolve relative URL against CSS file URL
        const absoluteUrl = new URL(urlValue, cssFileUrl).href;
        rewriteCount++;
        return `url(${quote}${absoluteUrl}${quote})`;
      } catch {
        // If URL resolution fails, keep original
        return match;
      }
    });
    
    if (rewriteCount > 0) {
      console.log(`[CSS] Rewrote ${rewriteCount} relative URLs in ${cssFileUrl.split('/').pop()}`);
    }
    
    return rewritten;
  } catch (err) {
    console.warn(`[CSS] Failed to rewrite URLs for ${cssFileUrl}: ${err}`);
    return cssText;
  }
}

// Fetch external CSS with timeout - INCREASED LIMITS for pixel-perfect
async function fetchExternalCss(urls: string[], maxTotal: number = 500000): Promise<string> {
  const cssChunks: string[] = [];
  let totalSize = 0;
  
  // Prioritize landing-pages.css and similar custom CSS over vendor/theme
  const prioritized = urls.sort((a, b) => {
    // Highest priority: landing-pages, custom CSS
    if (a.includes('landing-page')) return -1;
    if (b.includes('landing-page')) return 1;
    if (a.includes('custom')) return -1;
    if (b.includes('custom')) return 1;
    // Second priority: theme CSS
    if (a.includes('theme')) return -1;
    if (b.includes('theme')) return 1;
    // Lowest priority: vendor/bootstrap
    if (a.includes('vendor') || a.includes('bootstrap')) return 1;
    if (b.includes('vendor') || b.includes('bootstrap')) return -1;
    return 0;
  });
  
  for (const url of prioritized) {
    if (totalSize >= maxTotal) {
      console.warn(`[CSS] Reached max total size (${maxTotal}), skipping remaining files`);
      break;
    }
    
    try {
      console.log(`[CSS] Fetching: ${url.substring(0, 100)}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout per CSS
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'Accept': 'text/css' }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        let css = await response.text();
        
        // INCREASED limit per file for pixel-perfect (150KB)
        const maxPerFile = 150000;
        if (css.length > maxPerFile) {
          console.warn(`[CSS] File truncated: ${url.split('/').pop()} (${css.length} -> ${maxPerFile})`);
          css = css.substring(0, maxPerFile);
          const lastBrace = css.lastIndexOf('}');
          if (lastBrace > maxPerFile * 0.8) css = css.substring(0, lastBrace + 1);
        }
        
        // CRITICAL: Rewrite relative URLs to absolute BEFORE any other processing
        css = rewriteCssUrls(css, url);
        
        // Resolve @import rules (1 level deep)
        const importMatches = css.match(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?[^;]*;/gi) || [];
        for (const importMatch of importMatches.slice(0, 3)) { // Max 3 imports
          const urlMatch = importMatch.match(/["']([^"']+)["']/);
          if (urlMatch) {
            let importUrl = urlMatch[1];
            // Resolve relative URLs
            if (!importUrl.startsWith('http')) {
              try {
                const baseUrl = new URL(url);
                importUrl = new URL(importUrl, baseUrl.origin).href;
              } catch { continue; }
            }
            
            try {
              console.log(`[CSS] Fetching @import: ${importUrl.substring(0, 80)}...`);
              const importResponse = await fetch(importUrl, { 
                signal: AbortSignal.timeout(8000),
                headers: { 'Accept': 'text/css' }
              });
              if (importResponse.ok) {
                let importCss = await importResponse.text();
                if (importCss.length < 100000) {
                  // Rewrite URLs in imported CSS too!
                  importCss = rewriteCssUrls(importCss, importUrl);
                  css = css.replace(importMatch, `/* @import resolved from ${importUrl} */\n${importCss}`);
                  console.log(`[CSS] Resolved @import: ${importCss.length} chars`);
                }
              }
            } catch (importErr) {
              console.warn(`[CSS] Failed to resolve @import: ${importUrl}`);
            }
          }
        }
        
        cssChunks.push(`/* From: ${url} (${css.length} chars) */\n${css}`);
        totalSize += css.length;
        console.log(`[CSS] Fetched ${css.length} chars from ${url.split('/').pop()}`);
      }
    } catch (err) {
      console.warn(`[CSS] Failed to fetch ${url}: ${err}`);
    }
  }
  
  console.log(`[CSS] Total external CSS: ${totalSize} chars from ${cssChunks.length} files`);
  return cssChunks.join('\n\n');
}

// Extract ESSENTIAL CSS from HTML - OPTIMIZED for speed
// Uses simple string parsing instead of heavy regex to avoid CPU timeout
function extractCssFromHtml(html: string): string {
  if (!html) return '';
  
  const cssChunks: string[] = [];
  const maxCssSize = 50000; // 50KB max from inline (increased)
  let totalSize = 0;
  
  // Simple string-based extraction of <style> tags (much faster than regex on large HTML)
  let pos = 0;
  const htmlLower = html.toLowerCase();
  
  while (pos < html.length && totalSize < maxCssSize) {
    const styleStart = htmlLower.indexOf('<style', pos);
    if (styleStart === -1) break;
    
    const contentStart = html.indexOf('>', styleStart);
    if (contentStart === -1) break;
    
    const styleEnd = htmlLower.indexOf('</style>', contentStart);
    if (styleEnd === -1) break;
    
    // Extract the CSS content
    const cssContent = html.substring(contentStart + 1, styleEnd).trim();
    
    // Skip empty or very small
    if (cssContent.length > 20 && cssContent.length < 50000) {
      // Limit individual chunk size
      const chunk = cssContent.length > 20000 ? cssContent.substring(0, 20000) : cssContent;
      cssChunks.push(chunk);
      totalSize += chunk.length;
    }
    
    pos = styleEnd + 8;
  }
  
  // Combine chunks with size limit
  let combined = cssChunks.join('\n');
  
  if (combined.length > maxCssSize) {
    combined = combined.substring(0, maxCssSize);
    const lastBrace = combined.lastIndexOf('}');
    if (lastBrace > maxCssSize * 0.8) {
      combined = combined.substring(0, lastBrace + 1);
    }
  }
  
  console.log(`[CSS] Fast extracted ${cssChunks.length} inline chunks, ${combined.length} chars total`);
  return combined;
}

// COMBINED: Extract inline + fetch external CSS
async function extractAllCssFromHtml(html: string): Promise<string> {
  // 1. Extract inline <style> tags
  const inlineCss = extractCssFromHtml(html);
  
  // 2. Extract external CSS URLs and fetch them
  const externalUrls = extractExternalCssUrls(html);
  const externalCss = await fetchExternalCss(externalUrls);
  
  // Combine: external CSS first (has base styles), then inline (has overrides)
  const combined = `${externalCss}\n\n/* INLINE STYLES */\n${inlineCss}`;
  
  console.log(`[CSS] Combined: ${inlineCss.length} inline + ${externalCss.length} external = ${combined.length} total`);
  return combined;
}

// Call ai-analyze-page edge function for CLASSIFICATION (not conversion)
async function classifyPageWithAI(
  html: string, 
  pageTitle: string, 
  pageUrl: string
): Promise<AIClassificationResult> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[AI-CLASSIFY] Missing Supabase config');
      return { success: false, error: 'Missing config', fallback: true };
    }

    // Truncate HTML for faster AI processing (keep first 40k chars)
    const maxHtmlForAI = 40000;
    const truncatedHtml = html.length > maxHtmlForAI 
      ? html.substring(0, maxHtmlForAI)
      : html;
    
    console.log(`[AI-CLASSIFY] Calling ai-analyze-page for: ${pageTitle} (${truncatedHtml.length} chars)`);
    
    // Add 120 second timeout (AI analysis can take time for complex pages)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
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
        console.error(`[AI-CLASSIFY] API error: ${response.status}`, errorText);
        return { success: false, error: `API error ${response.status}`, fallback: true };
      }

      const data = await response.json();
      
      if (data.fallback || data.error) {
        console.warn(`[AI-CLASSIFY] Fallback needed: ${data.error}`);
        return { success: false, error: data.error, fallback: true };
      }

      console.log(`[AI-CLASSIFY] Success:`);
      console.log(`  - Type: ${data.classification?.pageType}`);
      console.log(`  - Complexity: ${data.classification?.complexity}`);
      console.log(`  - Sections: ${data.classification?.sections?.length || 0}`);
      console.log(`  - Strategy: ${data.classification?.recommendedStrategy?.substring(0, 80)}...`);
      
      return {
        success: true,
        classification: data.classification,
      };
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[AI-CLASSIFY] Request timeout after 120s');
        return { success: false, error: 'Timeout after 120s', fallback: true };
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('[AI-CLASSIFY] Exception:', error);
    return { success: false, error: String(error), fallback: true };
  }
}

// =============================================
// REGRA CRÍTICA: PIXEL-PERFECT É O FALLBACK DOMINANTE
// =============================================
// O objetivo principal é ficar 100% igual visualmente.
// Editabilidade é secundária.
// Só use blocos nativos com confidence >= 85%
// =============================================
const HIGH_CONFIDENCE_THRESHOLD = 85;

// Apply classification to build page content
function buildPageFromClassification(
  classification: PageClassification,
  rawHtml: string,
  extractedCss: string,
  pageTitle: string,
  sourceUrl: string // Add source URL for <base href> in iframe
): BlockNode {
  console.log(`[BUILD] Building page from classification: ${classification.pageType}, ${classification.sections.length} sections`);
  
  const blocks: BlockNode[] = [];
  
  // Count modes with high confidence
  const modeStats = {
    'native-blocks-high-conf': 0,
    'native-blocks-low-conf': 0,
    'pixel-perfect': 0,
    'hybrid': 0
  };
  
  for (const section of classification.sections) {
    if (section.mode === 'native-blocks') {
      if (section.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
        modeStats['native-blocks-high-conf']++;
      } else {
        modeStats['native-blocks-low-conf']++;
      }
    } else {
      modeStats[section.mode]++;
    }
  }
  
  console.log(`[BUILD] Mode distribution: native-high=${modeStats['native-blocks-high-conf']}, native-low=${modeStats['native-blocks-low-conf']}, pixel-perfect=${modeStats['pixel-perfect']}, hybrid=${modeStats['hybrid']}`);
  
  // =============================================
  // REGRA: PIXEL-PERFECT É O PADRÃO
  // =============================================
  // Só usar blocos se:
  // 1. Maioria das seções são native-blocks com HIGH confidence
  // 2. Página é simples/institucional
  // 3. Não depende de CSS externo
  // =============================================
  
  const totalSections = classification.sections.length || 1;
  const highConfNativeRatio = modeStats['native-blocks-high-conf'] / totalSections;
  
  const shouldUsePixelPerfect = 
    classification.complexity === 'high' ||
    classification.pageType === 'landing-custom' ||
    classification.dependsOnExternalCss ||
    highConfNativeRatio < 0.5 || // Menos de 50% são blocos com alta confiança
    modeStats['pixel-perfect'] > modeStats['native-blocks-high-conf'];
  
  if (shouldUsePixelPerfect) {
    console.log(`[BUILD] Using PIXEL-PERFECT strategy (100% visual fidelity)`);
    console.log(`[BUILD] Reason: complexity=${classification.complexity}, type=${classification.pageType}, externalCss=${classification.dependsOnExternalCss}, highConfRatio=${(highConfNativeRatio * 100).toFixed(0)}%`);
    
    // Extract main content using platform-based extractor
    const platformDetection = detectPlatformFromHtml(rawHtml, sourceUrl);
    const extractionResult = extractMainContentByPlatform(rawHtml, platformDetection.platform);
    const mainContent = extractionResult.content;
    
    // IMPORTANTE: Para pixel-perfect, manter CSS mais completo (incluindo media queries)
    // Apenas remover regras perigosas, não filtrar agressivamente
    const safeCss = extractSafePixelPerfectCss(extractedCss, mainContent);
    
    // Create CustomBlock with safe CSS (preserving media queries for responsiveness)
    // CRITICAL: Include sourceUrl for <base href> in iframe to resolve relative paths
    blocks.push({
      id: generateBlockId('customblock'),
      type: 'CustomBlock',
      props: {
        htmlContent: mainContent,
        cssContent: safeCss,
        blockName: `Página: ${pageTitle}`,
        baseUrl: sourceUrl, // For resolving relative URLs (images, fonts, etc.)
        isPixelPerfect: true, // Flag para o renderer saber que é pixel-perfect
      },
      children: [],
    });
    
    // Extract editable buttons as native blocks (para CTAs serem editáveis)
    const allEditables = [
      ...(classification.globalEditables || []),
      ...(classification.sections.flatMap(s => s.editableElements || []))
    ];
    
    for (const editable of allEditables) {
      if (editable.type === 'button' || editable.type === 'cta') {
        console.log(`[BUILD] Creating editable Button: "${editable.text}"`);
        blocks.push({
          id: generateBlockId('button'),
          type: 'Button',
          props: {
            text: editable.text,
            url: '#',
            variant: 'primary',
            size: 'lg',
            fullWidth: false,
            alignment: 'center',
          },
          children: [],
        });
      }
    }
  } else {
    console.log(`[BUILD] Using BLOCKS strategy (high confidence native blocks)`);
    
    // Processar apenas seções com alta confiança como blocos
    for (const section of classification.sections) {
      const useNativeBlock = 
        section.mode === 'native-blocks' && 
        section.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
        section.suggestedBlockTypes?.length;
      
      if (useNativeBlock && section.suggestedBlockTypes) {
        for (const blockType of section.suggestedBlockTypes) {
          console.log(`[BUILD] Section "${section.name}" -> ${blockType} (confidence: ${section.confidence}%)`);
          
          switch (blockType) {
            case 'FAQ':
              blocks.push({
                id: generateBlockId('faq'),
                type: 'FAQ',
                props: {
                  title: section.name || 'Perguntas Frequentes',
                  titleAlign: 'left',
                  items: [], // Will be filled by regex extractor
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
                  title: section.name || 'Depoimentos',
                  items: [], // Will be filled by regex extractor
                },
                children: [],
              });
              break;
              
            case 'RichText':
              blocks.push({
                id: generateBlockId('richtext'),
                type: 'RichText',
                props: {
                  content: `<h2>${section.name}</h2><p>Conteúdo extraído</p>`,
                  fontFamily: 'inherit',
                  fontSize: 'base',
                  fontWeight: 'normal',
                },
                children: [],
              });
              break;
              
            default:
              blocks.push({
                id: generateBlockId('richtext'),
                type: 'RichText',
                props: {
                  content: `<h2>${section.name}</h2>`,
                  fontFamily: 'inherit',
                  fontSize: 'base',
                  fontWeight: 'normal',
                },
                children: [],
              });
          }
        }
      } else {
        // Baixa confiança ou pixel-perfect: use CustomBlock para esta seção
        console.log(`[BUILD] Section "${section.name}" -> CustomBlock (mode: ${section.mode}, confidence: ${section.confidence}%)`);
      }
    }
    
    // Se nenhum bloco foi criado, fallback para pixel-perfect completo
    if (blocks.length === 0) {
      console.log(`[BUILD] No high-confidence blocks, falling back to PIXEL-PERFECT`);
      const fallbackDetection = detectPlatformFromHtml(rawHtml, sourceUrl);
      const fallbackExtraction = extractMainContentByPlatform(rawHtml, fallbackDetection.platform);
      const mainContent = fallbackExtraction.content;
      const safeCss = extractSafePixelPerfectCss(extractedCss, mainContent);
      
      blocks.push({
        id: generateBlockId('customblock'),
        type: 'CustomBlock',
        props: {
          htmlContent: mainContent,
          cssContent: safeCss,
          blockName: `Página: ${pageTitle}`,
          isPixelPerfect: true,
        },
        children: [],
      });
    }
  }
  
  console.log(`[BUILD] Created ${blocks.length} blocks`);
  
  return {
    id: generateBlockId('page'),
    type: 'Page',
    props: { backgroundColor: 'transparent', padding: 'none' },
    children: [{
      id: generateBlockId('section'),
      type: 'Section',
      props: { 
        backgroundColor: 'transparent', 
        paddingX: 0, 
        paddingY: 0, 
        marginTop: 0, 
        marginBottom: 0, 
        gap: 16, 
        alignItems: 'stretch', 
        fullWidth: true 
      },
      children: blocks,
    }],
  };
}

// =============================================
// CSS para PIXEL-PERFECT: MANTER QUASE TUDO
// =============================================
// O objetivo é 100% fidelidade visual. Só removemos:
// 1. @import (recursos externos incontroláveis)
// 2. Seletores html/body/* (conflito com iframe)
// 3. :root (variáveis podem conflitar)
// 
// MANTEMOS:
// - Todas as @media queries
// - Todas as regras display:none (essenciais para responsividade)
// - @font-face (fontes carregam dentro do iframe)
// - @keyframes (animações)
// =============================================
function extractSafePixelPerfectCss(css: string, html: string): string {
  if (!css) return '';
  
  // Remover APENAS regras que podem vazar/conflitar com o iframe host
  let safeCss = css
    // Remover @import (pode puxar CSS externo incontrolável)
    .replace(/@import[^;]*;/gi, '')
    // Remover :root que não está dentro de :host/:scope
    .replace(/^\s*:root\s*\{[^}]*\}/gm, '')
    // Remover html/body/* rules standalone (mas não compostos)
    .replace(/^\s*html\s*\{[^}]*\}/gm, '')
    .replace(/^\s*body\s*\{[^}]*\}/gm, '')
    .replace(/^\s*\*\s*\{[^}]*\}/gm, '');
  
  // NÃO remover display:none - é essencial para responsividade!
  // NÃO remover @font-face - fontes funcionam dentro do iframe
  // NÃO remover @keyframes - animações funcionam dentro do iframe
  // NÃO remover @media - essencial para responsividade
  
  // Limitar tamanho final (generoso para pixel-perfect)
  const maxSize = 250000; // 250KB para pixel-perfect (era 100KB)
  const finalCss = safeCss.length > maxSize ? safeCss.substring(0, maxSize) : safeCss;
  
  console.log(`[CSS-PIXEL-PERFECT] ${css.length} -> ${finalCss.length} chars (kept ALL rules for visual fidelity)`);
  return finalCss;
}

// Prune CSS for specific content
function pruneCssForContent(css: string, html: string): string {
  if (!css || !html) return '';
  
  // Extract all class names and IDs from HTML
  const classMatches = html.match(/class="([^"]*)"/gi) || [];
  const idMatches = html.match(/id="([^"]*)"/gi) || [];
  
  const usedClasses = new Set<string>();
  const usedIds = new Set<string>();
  
  classMatches.forEach(match => {
    const classes = match.replace(/class="([^"]*)"/i, '$1').split(/\s+/);
    classes.forEach(c => c && usedClasses.add(c.toLowerCase()));
  });
  
  idMatches.forEach(match => {
    const id = match.replace(/id="([^"]*)"/i, '$1');
    if (id) usedIds.add(id.toLowerCase());
  });
  
  // Get all HTML tag names used
  const tagMatches = html.match(/<([a-z][a-z0-9]*)/gi) || [];
  const usedTags = new Set<string>();
  tagMatches.forEach(match => {
    const tag = match.replace('<', '').toLowerCase();
    if (tag) usedTags.add(tag);
  });
  
  // Remove dangerous global rules
  let cleanCss = css
    .replace(/@font-face\s*\{[^}]*\}/gi, '')
    .replace(/@import[^;]*;/gi, '')
    .replace(/:root\s*\{[^}]*\}/gi, '')
    .replace(/(?:^|\})\s*(?:html|body|\*)\s*\{[^}]*\}/gi, '}');
  
  const filteredRules: string[] = [];
  const rules = cleanCss.match(/[^{}]+\{[^{}]*\}/g) || [];
  
  rules.forEach(rule => {
    const braceIndex = rule.indexOf('{');
    if (braceIndex === -1) return;
    
    const selector = rule.substring(0, braceIndex).trim();
    const declarations = rule.substring(braceIndex);
    
    // Keep @keyframes
    if (selector.startsWith('@')) {
      filteredRules.push(rule);
      return;
    }
    
    // Skip global selectors
    if (selector === '*' || selector === 'html' || selector === 'body' || selector === ':root') {
      return;
    }
    
    // Skip display:none rules
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(declarations)) {
      return;
    }
    
    // Check if selector matches any used class, ID, or tag
    const selectorLower = selector.toLowerCase();
    let matches = false;
    
    usedClasses.forEach(cls => {
      if (selectorLower.includes('.' + cls)) matches = true;
    });
    usedIds.forEach(id => {
      if (selectorLower.includes('#' + id)) matches = true;
    });
    usedTags.forEach(tag => {
      const tagPattern = new RegExp(`\\b${tag}\\b`, 'i');
      if (tagPattern.test(selector)) matches = true;
    });
    
    if (matches) filteredRules.push(rule);
  });
  
  const result = filteredRules.join('\n');
  console.log(`[CSS-PRUNE] ${css.length} -> ${result.length} chars (${Math.round((1 - result.length/Math.max(1,css.length)) * 100)}% reduction)`);
  return result;
}

// Convert AI sections to BlockNode structure
// Uses globalExtractedCss for CustomBlocks that need styling
function convertAISectionsToBlocks(sections: AISection[], supabase: any, tenantId: string, pageExtractedCss: string = ''): BlockNode[] {
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
        // Use section-specific CSS if available, otherwise use the global page CSS
        if (section.htmlContent) {
          const cssToUse = section.cssContent?.trim() || pageExtractedCss || globalExtractedCss;
          console.log(`[AI→BLOCK] CustomBlock with ${section.htmlContent.length} chars HTML, ${cssToUse.length} chars CSS`);
          
          blocks.push({
            id: generateBlockId('customblock'),
            type: 'CustomBlock',
            props: {
              htmlContent: section.htmlContent,
              cssContent: cssToUse,
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
function createPageFromAIAnalysis(sections: AISection[], pageTitle: string, supabase: any, tenantId: string, extractedCss: string = ''): BlockNode {
  const contentBlocks = convertAISectionsToBlocks(sections, supabase, tenantId, extractedCss);
  
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
  // NEW STRATEGY: Always extract individual elements as native blocks
  // Raw HTML CustomBlocks don't work without original CSS
  // Native blocks are editable and render correctly
  // =====================================================

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

  // 4. Extract ALL YouTube videos as native blocks
  const videoResult = extractVideos(remainingContent);
  if (videoResult.videos.length > 0) {
    console.log(`[MAPPER] ✓ Found ${videoResult.videos.length} videos - creating native blocks`);
    
    for (const video of videoResult.videos) {
      if (video.type === 'youtube') {
        blocks.push({
          id: generateBlockId('youtube'),
          type: 'YouTubeVideo',
          props: { 
            title: '', 
            youtubeUrl: video.url,
            videoId: video.videoId,
          },
          children: [],
        });
        console.log(`[MAPPER] ✓ Created YouTubeVideo block: ${video.videoId}`);
      } else if (video.type === 'vimeo') {
        blocks.push({
          id: generateBlockId('vimeo'),
          type: 'YouTubeVideo', // Use same component, it handles Vimeo
          props: { 
            title: '', 
            youtubeUrl: video.url,
          },
          children: [],
        });
        console.log(`[MAPPER] ✓ Created Vimeo block`);
      }
    }
    remainingContent = videoResult.remainingHtml;
  }

  // 5. Extract significant images as native blocks (skip small/icon images)
  const imageResult = extractImages(remainingContent);
  const significantImages = imageResult.images.filter(img => {
    // Filter out likely icons, spacers, logos in header/footer
    const isLikelyIcon = /icon|logo|sprite|pixel|spacer|arrow|chevron|social/i.test(img.src || '');
    const isSmallDataUrl = img.src?.startsWith('data:') && (img.src?.length || 0) < 500;
    return !isLikelyIcon && !isSmallDataUrl;
  });

  if (significantImages.length > 0 && significantImages.length <= 10) {
    console.log(`[MAPPER] ✓ Found ${significantImages.length} significant images - creating native blocks`);
    
    for (const image of significantImages) {
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
    }
    remainingContent = imageResult.remainingHtml;
  } else if (significantImages.length > 10) {
    // Too many images - just add first 5 to avoid clutter
    console.log(`[MAPPER] ✓ Found ${significantImages.length} images - adding first 5`);
    for (const image of significantImages.slice(0, 5)) {
      blocks.push({
        id: generateBlockId('image'),
        type: 'Image',
        props: { 
          imageDesktop: image.src,
          imageMobile: '',
          alt: image.alt || 'Imagem',
          linkUrl: '',
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
    }
    remainingContent = imageResult.remainingHtml;
  }

  // 6. Remaining text content as RichText (cleaned)
  // Strip out remaining media elements and keep only text
  let textContent = remainingContent
    .replace(/<img[^>]*>/gi, '') // Remove any remaining images
    .replace(/<video[^>]*>[\s\S]*?<\/video>/gi, '') // Remove video tags
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '') // Remove iframes
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '') // Remove SVGs
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '') // Remove buttons
    .replace(/<input[^>]*>/gi, '') // Remove inputs
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, ''); // Remove forms
  
  const cleanedRemaining = stripHtml(textContent);
  if (cleanedRemaining.length > 100) { // Only add if there's substantial text
    console.log(`[MAPPER] Adding RichText: ${cleanedRemaining.length} chars of text`);
    
    // Further clean the HTML for RichText
    const safeHtml = textContent
      .replace(/<div[^>]*class="[^"]*"[^>]*>/gi, '<div>') // Remove classes
      .replace(/\s+style="[^"]*"/gi, '') // Remove inline styles
      .replace(/<(div|span)[^>]*>\s*<\/\1>/gi, '') // Remove empty elements
      .trim();
    
    if (safeHtml.length > 50) {
      blocks.push({
        id: generateBlockId('richtext'),
        type: 'RichText',
        props: { 
          content: safeHtml, 
          fontFamily: 'inherit', 
          fontSize: 'base', 
          fontWeight: 'normal' 
        },
        children: [],
      });
    }
  }

  // If no blocks at all, add a simple message
  if (blocks.length === 0) {
    blocks.push({
      id: generateBlockId('richtext'),
      type: 'RichText',
      props: { 
        content: '<p>Página importada. Use os blocos do editor para adicionar conteúdo.</p>', 
        fontFamily: 'inherit', 
        fontSize: 'base', 
        fontWeight: 'normal' 
      },
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
// Returns both cleaned HTML and raw HTML (with styles) for CustomBlocks
// NOW ALSO CAPTURES SCREENSHOT for visual AI analysis
async function scrapePageContent(url: string, retryCount = 0): Promise<{ 
  html: string; 
  rawHtml: string; 
  markdown: string; 
  title: string; 
  description: string; 
  extractedCss: string;
  screenshot?: string; // NEW: Base64 screenshot for visual analysis
} | null> {
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
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout (increased for screenshot)
    
    // Request rawHtml, html, markdown AND screenshot for visual analysis
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: normalizedUrl,
        formats: ['rawHtml', 'html', 'markdown', 'screenshot'], // Added screenshot
        onlyMainContent: false, // Get FULL page to extract styles
        waitFor: 4000, // Wait longer for dynamic content + screenshot
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

    // Firecrawl v1 response structure
    let fullRawHtml = data.data?.rawHtml || data.rawHtml || '';
    let mainHtml = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    const title = data.data?.metadata?.title || data.metadata?.title || '';
    const description = data.data?.metadata?.description || data.metadata?.description || '';
    
    // NEW: Extract screenshot (base64 or URL)
    const screenshot = data.data?.screenshot || data.screenshot || '';

    console.log(`[SCRAPE] Success for ${normalizedUrl}:`);
    console.log(`[SCRAPE]   rawHtml=${fullRawHtml.length}chars, html=${mainHtml.length}chars, md=${markdown.length}chars`);
    console.log(`[SCRAPE]   screenshot=${screenshot ? (screenshot.length > 100 ? `${screenshot.substring(0, 50)}... (${Math.round(screenshot.length/1024)}KB)` : 'present') : 'NONE'}`);

    // HTML size limits - increased now that CSS extraction is optimized
    const maxRawHtmlSize = 500000; // 500KB for CSS extraction (optimized algorithm handles this)
    const maxMainHtmlSize = 200000; // 200KB for content processing
    
    if (fullRawHtml.length > maxRawHtmlSize) {
      console.log(`[SCRAPE] rawHtml too large (${fullRawHtml.length}), truncating to ${maxRawHtmlSize}`);
      fullRawHtml = fullRawHtml.substring(0, maxRawHtmlSize);
    }
    
    if (mainHtml.length > maxMainHtmlSize) {
      console.log(`[SCRAPE] mainHtml too large (${mainHtml.length}), truncating to ${maxMainHtmlSize}`);
      mainHtml = mainHtml.substring(0, maxMainHtmlSize);
    }

    // Extract CSS from the raw HTML (inline styles) + fetch external CSS files
    // This is CRITICAL for pixel-perfect: external CSS like landing-pages.css contains all the styling
    const extractedCss = await extractAllCssFromHtml(fullRawHtml);
    console.log(`[SCRAPE] Extracted CSS (inline + external): ${extractedCss.length} chars`);

    // Use the main content HTML for processing - also limited now
    const cleanedHtml = cleanHtmlContent(mainHtml || fullRawHtml, markdown);
    console.log(`[SCRAPE] Cleaned HTML: ${cleanedHtml.length}chars`);

    return { 
      html: cleanedHtml, 
      rawHtml: fullRawHtml, 
      markdown, 
      title, 
      description, 
      extractedCss,
      screenshot // NEW: Include screenshot
    };
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

// Detect if page is a highly custom/landing page that should be preserved as-is
function isHighlyCustomPage(html: string): boolean {
  if (!html) return false;
  
  const customIndicators = [
    // Shopify custom liquid sections
    /shopify-section--custom-liquid/i,
    /custom_liquid/i,
    // Landing page builders
    /landing-page/i,
    /lp-section/i,
    // Heavy CSS-dependent layouts
    /section\d+\s/i, // section1, section2, etc.
    // Multiple inline style sections with CSS variables
    /--bg:|--accent:|--text:/i,
    // Complex grid/flex layouts
    /grid-template-/i,
    /display:\s*grid/i,
  ];
  
  let score = 0;
  for (const pattern of customIndicators) {
    if (pattern.test(html)) score++;
  }
  
  // Also check for multiple custom sections (strong indicator)
  const customSectionCount = (html.match(/shopify-section/gi) || []).length;
  if (customSectionCount > 5) score += 2;
  
  const isCustom = score >= 2;
  console.log(`[CUSTOM-DETECT] Score: ${score}, customSections: ${customSectionCount}, isCustom: ${isCustom}`);
  
  return isCustom;
}

// =============================================
// HYBRID ELEMENT ANALYSIS - Check if native blocks can handle the content
// Returns true if page has significant native-convertible elements
// =============================================
interface HybridAnalysisResult {
  hasNativeContent: boolean;
  videoCount: number;
  buttonCount: number;
  textLength: number;
  reason: string;
}

function analyzeForHybridImport(html: string): HybridAnalysisResult {
  if (!html) {
    return { hasNativeContent: false, videoCount: 0, buttonCount: 0, textLength: 0, reason: 'empty' };
  }
  
  // Extract video count using the improved extractVideoUrls
  const videos = extractVideoUrls(html);
  const videoCount = videos.length;
  
  // Count buttons/CTAs
  const buttonPatterns = [
    /<a[^>]*class="[^"]*(?:btn|button|cta|comprar|buy)[^"]*"[^>]*>/gi,
    /<button[^>]*>/gi,
    /<a[^>]*style="[^"]*(?:background|border-radius|padding)[^"]*"[^>]*>/gi,
  ];
  let buttonCount = 0;
  for (const pattern of buttonPatterns) {
    const matches = html.match(pattern) || [];
    buttonCount += matches.length;
  }
  
  // Get text content length (stripped of HTML)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const textLength = textContent.length;
  
  // Decision logic: use native blocks if we have clear, convertible content
  // Priority: videos are MOST important for native conversion
  let hasNativeContent = false;
  let reason = '';
  
  if (videoCount >= 1) {
    // ANY video should trigger native block extraction
    hasNativeContent = true;
    reason = `Found ${videoCount} video(s) - will use native YouTubeVideo block`;
  } else if (buttonCount >= 1 && textLength > 200) {
    // Button + text = likely a simple institutional page
    hasNativeContent = true;
    reason = `Found ${buttonCount} button(s) + ${textLength} chars text - simple page`;
  } else if (textLength > 500 && buttonCount === 0 && videoCount === 0) {
    // Pure text content (like policies, about pages)
    hasNativeContent = true;
    reason = `Pure text content (${textLength} chars) - using RichText`;
  }
  
  console.log(`[HYBRID-ANALYSIS] videos=${videoCount}, buttons=${buttonCount}, text=${textLength}, hasNative=${hasNativeContent}, reason=${reason}`);
  
  return { hasNativeContent, videoCount, buttonCount, textLength, reason };
}

// =============================================
// SMART DESKTOP/MOBILE IMAGE EXTRACTION
// Extracts images from both desktop and mobile versions
// Creates native Image blocks with imageDesktop + imageMobile
// =============================================

interface ResponsiveImagePair {
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  sectionId: string; // To help match desktop/mobile pairs
}

interface SectionImage {
  src: string;
  alt: string;
}

// Extract images from desktop and mobile sections separately
function extractDesktopMobileImages(html: string): ResponsiveImagePair[] {
  const images: ResponsiveImagePair[] = [];
  
  // Find all sections that have both desktop and mobile versions
  // Common patterns: class="section1" (desktop) vs class="section1 tablet" (mobile)
  
  // Pattern: sections with numbered classes (section1, section2, etc)
  const sectionPattern = /<section[^>]*class="([^"]*\bsection(\d+)\b[^"]*)"[^>]*>([\s\S]*?)<\/section>/gi;
  
  interface SectionContent {
    desktop?: string;
    mobile?: string;
  }
  
  const sectionsByNumber: Record<string, SectionContent> = {};
  
  let match;
  while ((match = sectionPattern.exec(html)) !== null) {
    const fullClass = match[1];
    const sectionNum = match[2];
    const content = match[3];
    
    // Check if this is mobile/tablet version
    const isMobile = /\b(tablet|mobile)\b/i.test(fullClass);
    
    if (!sectionsByNumber[sectionNum]) {
      sectionsByNumber[sectionNum] = {};
    }
    
    if (isMobile) {
      sectionsByNumber[sectionNum].mobile = content;
    } else {
      sectionsByNumber[sectionNum].desktop = content;
    }
  }
  
  // For each section that has BOTH versions, extract images
  for (const [sectionNum, contents] of Object.entries(sectionsByNumber)) {
    if (contents.desktop && contents.mobile) {
      // Extract images from desktop version
      const desktopImages = extractImagesFromSection(contents.desktop);
      const mobileImages = extractImagesFromSection(contents.mobile);
      
      console.log(`[EXTRACT-IMG] Section ${sectionNum}: ${desktopImages.length} desktop, ${mobileImages.length} mobile images`);
      
      // Match desktop and mobile images by position (assume same order)
      const maxLen = Math.max(desktopImages.length, mobileImages.length);
      for (let i = 0; i < maxLen; i++) {
        const desktopImg = desktopImages[i];
        const mobileImg = mobileImages[i];
        
        if (desktopImg || mobileImg) {
          images.push({
            desktopSrc: desktopImg?.src || mobileImg?.src || '',
            mobileSrc: mobileImg?.src || desktopImg?.src || '',
            alt: desktopImg?.alt || mobileImg?.alt || `Imagem ${sectionNum}-${i + 1}`,
            sectionId: `section${sectionNum}`,
          });
        }
      }
    }
  }
  
  console.log(`[EXTRACT-IMG] Total paired images found: ${images.length}`);
  return images;
}

// Extract image src and alt from HTML section
function extractImagesFromSection(html: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = [];
  
  // Match img tags
  const imgPattern = /<img[^>]*src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
  let match;
  
  while ((match = imgPattern.exec(html)) !== null) {
    const src = match[1];
    const alt = match[2] || '';
    
    // Skip tiny images, icons, tracking pixels
    if (src && !src.includes('tracking') && !src.includes('pixel') && !src.includes('1x1')) {
      images.push({ src, alt });
    }
  }
  
  // Also match background-image in style
  const bgPattern = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  while ((match = bgPattern.exec(html)) !== null) {
    images.push({ src: match[1], alt: '' });
  }
  
  return images;
}

// Remove a single HTML element (with proper nesting support) given its opening tag position
function removeNestedElement(html: string, tagName: string, startPos: number): string {
  // Find the end of the opening tag
  const openTagEnd = html.indexOf('>', startPos);
  if (openTagEnd === -1) return html;
  
  // Check if it's a self-closing tag
  if (html.charAt(openTagEnd - 1) === '/') {
    return html.substring(0, startPos) + html.substring(openTagEnd + 1);
  }
  
  // Find matching closing tag with nesting support
  let depth = 1;
  let pos = openTagEnd + 1;
  const openPattern = new RegExp(`<${tagName}[\\s>]`, 'gi');
  const closePattern = new RegExp(`</${tagName}>`, 'gi');
  
  while (depth > 0 && pos < html.length) {
    // Find next opening or closing tag
    openPattern.lastIndex = pos;
    closePattern.lastIndex = pos;
    
    const openMatch = openPattern.exec(html);
    const closeMatch = closePattern.exec(html);
    
    if (!closeMatch) break; // No closing tag found
    
    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      pos = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      if (depth === 0) {
        // Found matching closing tag
        return html.substring(0, startPos) + html.substring(closeMatch.index + closeMatch[0].length);
      }
      pos = closeMatch.index + closeMatch[0].length;
    }
  }
  
  return html; // Could not find matching closing tag
}

// =============================================
// CRITICAL FIX: DO NOT REMOVE MOBILE/TABLET ELEMENTS
// =============================================
// Many landing pages use CSS classes like "section1 tablet" and "section1" 
// where BOTH elements are needed - CSS media queries show/hide them.
// Removing these elements breaks responsiveness completely!
// =============================================

// We now KEEP all content and rely on the original CSS to handle responsiveness
function removeDuplicateMobileElements(html: string): string {
  // DO NOT REMOVE ANY ELEMENTS - the original CSS handles show/hide via media queries
  // This was causing massive bugs by removing essential responsive content
  console.log(`[DEDUPE] Keeping ALL elements (CSS handles responsiveness)`);
  return html;
}

// =============================================
// CSS PROCESSING FOR PIXEL-PERFECT - MINIMAL CHANGES
// =============================================
// For pixel-perfect mode, we must keep almost ALL CSS including:
// - Media queries (for responsiveness)
// - display:none rules (CSS uses them for mobile/desktop switching)
// - All selectors (we can't know which are used without full DOM parsing)
// Only remove truly dangerous rules that could affect parent page
// =============================================
function pruneCssForHtml(css: string, html: string): string {
  if (!css) return '';
  
  // For pixel-perfect: ONLY remove dangerous rules, keep everything else
  let safeCss = css
    // Remove @import (external resources we can't control)
    .replace(/@import[^;]*;/gi, '')
    // Remove :root definitions that could conflict
    .replace(/^\s*:root\s*\{[^}]*\}/gm, '')
    // Remove body/html global rules that could conflict
    .replace(/(?:^|\s)(?:html|body)\s*\{[^}]*\}/gi, '')
    // Keep @font-face, @keyframes, @media - all essential
    ;
  
  console.log(`[CSS-SAFE] Kept ${safeCss.length} chars (only removed dangerous rules)`);
  return safeCss;
}

// Create Image blocks from extracted desktop/mobile image pairs
function createImageBlocksFromPairs(images: ResponsiveImagePair[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  for (const img of images) {
    blocks.push({
      id: generateBlockId('image'),
      type: 'Image',
      props: {
        imageDesktop: img.desktopSrc,
        imageMobile: img.mobileSrc,
        alt: img.alt,
        aspectRatio: 'auto',
        objectFit: 'cover',
        fullWidth: true,
      },
      children: [],
    });
    
    console.log(`[CREATE-IMG] Image block: desktop=${img.desktopSrc.substring(0, 50)}... mobile=${img.mobileSrc.substring(0, 50)}...`);
  }
  
  return blocks;
}
// =====================================================
// YOUTUBE MATERIALIZATION - Convert placeholders to real iframes
// =====================================================
// Shopify/Dooca pages often have YouTube as placeholders with data-attributes
// or lazy-load wrappers that require JS to work. We need to materialize
// these into real <iframe> elements for pixel-perfect rendering.
// =====================================================
function materializeYouTubeVideos(html: string): string {
  if (!html) return html;
  
  let content = html;
  let materialized = 0;
  
  // Pattern 1: data-youtube or data-video-id attributes
  // <div data-youtube="VIDEO_ID" ...> or <div data-video-id="VIDEO_ID">
  const dataYoutubePattern = /<([a-z]+)[^>]*(?:data-youtube|data-video-id|data-youtube-id)=["']([a-zA-Z0-9_-]{11})["'][^>]*>[\s\S]*?<\/\1>/gi;
  content = content.replace(dataYoutubePattern, (match, tag, videoId) => {
    materialized++;
    console.log(`[YOUTUBE] Materialized from data-attr: ${videoId}`);
    return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
      <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0" 
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen></iframe>
    </div>`;
  });
  
  // Pattern 2: data-src with YouTube URL (lazy loading)
  // <iframe data-src="https://www.youtube.com/embed/VIDEO_ID" ...>
  const dataSrcPattern = /<iframe[^>]*data-src=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["'][^>]*>/gi;
  content = content.replace(dataSrcPattern, (match, dataSrc) => {
    // Convert data-src to src
    const withSrc = match.replace(/data-src=/gi, 'src=');
    materialized++;
    console.log(`[YOUTUBE] Materialized from data-src`);
    return withSrc;
  });
  
  // Pattern 3: YouTube links in href with play button overlay
  // <a href="https://www.youtube.com/watch?v=VIDEO_ID" class="video-play">
  const youtubeLinkPattern = /<a[^>]*href=["'](?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*class=["'][^"']*(?:video|play|youtube)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
  content = content.replace(youtubeLinkPattern, (match, videoId) => {
    materialized++;
    console.log(`[YOUTUBE] Materialized from link: ${videoId}`);
    return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
      <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0" 
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen></iframe>
    </div>`;
  });
  
  // Pattern 4: YouTube thumbnail images with video class
  // <img src="...ytimg.com/vi/VIDEO_ID/..." class="video-thumbnail">
  const ytThumbnailPattern = /<img[^>]*src=["'][^"']*(?:ytimg\.com|youtube\.com)\/vi\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>/gi;
  content = content.replace(ytThumbnailPattern, (match, videoId) => {
    materialized++;
    console.log(`[YOUTUBE] Materialized from thumbnail: ${videoId}`);
    return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
      <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0" 
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen></iframe>
    </div>`;
  });
  
  // Pattern 5: Divs with YouTube URL in any attribute
  // <div data-url="https://youtube.com/embed/VIDEO_ID">
  const anyAttrYoutubePattern = /<([a-z]+)[^>]*(?:data-url|data-video|data-embed)=["']([^"']*(?:youtube\.com|youtu\.be)\/(?:embed\/|watch\?v=)?([a-zA-Z0-9_-]{11})[^"']*)["'][^>]*>/gi;
  content = content.replace(anyAttrYoutubePattern, (match, tag, fullUrl, videoId) => {
    if (!videoId) return match;
    materialized++;
    console.log(`[YOUTUBE] Materialized from data-url: ${videoId}`);
    return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;">
      <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0" 
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen></iframe>
    </div>`;
  });
  
  // Pattern 6: Protocol-relative YouTube iframes (//www.youtube.com)
  content = content.replace(/src=["']\/\/(?:www\.)?youtube\.com/gi, 'src="https://www.youtube.com');
  content = content.replace(/src=["']\/\/(?:www\.)?youtu\.be/gi, 'src="https://youtu.be');
  
  // Pattern 7: Vimeo lazy-load
  const vimeoDataSrcPattern = /<iframe[^>]*data-src=["']([^"']*vimeo\.com[^"']*)["'][^>]*>/gi;
  content = content.replace(vimeoDataSrcPattern, (match, dataSrc) => {
    const withSrc = match.replace(/data-src=/gi, 'src=');
    materialized++;
    console.log(`[VIMEO] Materialized from data-src`);
    return withSrc;
  });
  
  if (materialized > 0) {
    console.log(`[VIDEOS] Materialized ${materialized} video(s) from placeholders/lazy-load`);
  }
  
  return content;
}

// Extract main content from Shopify pages - IMPROVED with desktop/mobile image handling
function extractMainContent(html: string): string {
  if (!html) return '';
  
  let content = html;
  
  // STEP 0: MATERIALIZE YouTube videos before any processing
  // This ensures lazy-load videos become real iframes
  content = materializeYouTubeVideos(content);
  
  // STEP 0b: Remove duplicate mobile elements (keeping only desktop for HTML)
  // Note: Images are extracted separately before this
  content = removeDuplicateMobileElements(content);
  
  // STEP 1: Remove Shopify section groups (these contain header/footer from the theme)
  content = content.replace(/<!-- BEGIN sections: header-group -->[\s\S]*?<!-- END sections: header-group -->/gi, '');
  content = content.replace(/<!-- BEGIN sections: footer-group -->[\s\S]*?<!-- END sections: footer-group -->/gi, '');
  
  // STEP 2: Remove announcement bar sections
  content = content.replace(/<section[^>]*id="[^"]*announcement[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*announcement[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // STEP 3: Remove header elements
  content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<section[^>]*class="[^"]*header[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '');
  content = content.replace(/<nav[^>]*class="[^"]*header[^"]*"[^>]*>[\s\S]*?<\/nav>/gi, '');
  content = content.replace(/<div[^>]*id="[^"]*shopify-section[^"]*header[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // STEP 4: Remove footer elements
  content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  content = content.replace(/<section[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '');
  content = content.replace(/<div[^>]*id="[^"]*shopify-section[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // STEP 5: Remove scripts, noscript, style, links
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<link[^>]*>/gi, '');
  
  // STEP 6: Remove event handlers
  content = content.replace(/\s*on\w+="[^"]*"/gi, '');
  
  // STEP 7: Try to find main content area
  const mainMatch = /<main[^>]*>([\s\S]*)<\/main>/i.exec(content);
  if (mainMatch && mainMatch[1].length > 500) {
    content = mainMatch[1];
  }
  
  // STEP 8: Try to find page-specific content section
  const pageContentMatch = /<section[^>]*class="[^"]*(?:page-content|main-content|landing-page)[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(content);
  if (pageContentMatch && pageContentMatch[1].length > 500) {
    content = pageContentMatch[1];
  }
  
  // STEP 9: Clean up empty elements and excessive whitespace
  content = content.replace(/<(div|span|section)[^>]*>\s*<\/\1>/gi, '');
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  console.log(`[EXTRACT] Main content extracted: ${content.length} chars`);
  return content.trim();
}

// Clean HTML content for safe display - IMPROVED STRATEGY
// For custom pages: preserve HTML for CustomBlock
// For simple pages: use markdown for cleaner extraction
function cleanHtmlContent(html: string, markdown?: string): string {
  if (!html && !markdown) return '';

  // STEP 1: Check if this is a highly custom page
  if (isHighlyCustomPage(html)) {
    console.log(`[CLEAN] CUSTOM PAGE detected - preserving HTML structure for CustomBlock`);
    
    // Extract just the main content area (without header/footer)
    const mainContent = extractMainContent(html);
    
    if (mainContent.length > 1000) {
      console.log(`[CLEAN] Extracted main content: ${mainContent.length} chars`);
      return mainContent;
    }
  }

  // STEP 2: For non-custom pages, try markdown (cleaner for simple content)
  if (markdown && markdown.length > 500) {
    console.log(`[CLEAN] Using MARKDOWN as source (${markdown.length} chars)`);
    
    // Clean header/footer content from markdown
    let cleanedMarkdown = markdown;
    
    const headerPatterns = [
      /^Frete grátis.*$/gim,
      /^Parcele em até.*$/gim,
      /^Desconto de.*no pix$/gim,
      /^Atendimento$/gim,
      /^HORÁRIO DE ATENDIMENTO.*$/gim,
      /^De segunda a.*$/gim,
      /^\*\*Compre por telefone\*\*.*$/gim,
      /^\*\*Fale no WhatsApp\*\*.*$/gim,
      /^\[Frete grátis.*\].*$/gim,
      /^\[Parcele em até.*\].*$/gim,
    ];
    
    for (const pattern of headerPatterns) {
      cleanedMarkdown = cleanedMarkdown.replace(pattern, '');
    }
    
    // Remove footer content
    const footerMarkers = [
      /\n(?:Newsletter|Inscreva-se|Termos de uso|Política de|Trocas e devoluções)[\s\S]*$/i,
      /\n(?:© |Copyright |Todos os direitos)[\s\S]*$/i,
    ];
    
    for (const pattern of footerMarkers) {
      cleanedMarkdown = cleanedMarkdown.replace(pattern, '');
    }
    
    cleanedMarkdown = cleanedMarkdown.replace(/\n{3,}/g, '\n\n').trim();
    
    const convertedHtml = convertMarkdownToHtml(cleanedMarkdown);
    console.log(`[CLEAN] Markdown converted: ${convertedHtml.length} chars`);
    
    if (convertedHtml.length > 500) {
      return convertedHtml;
    }
  }

  // STEP 3: Fallback - basic HTML cleanup
  console.log(`[CLEAN] Fallback to basic HTML cleaning`);
  
  let cleaned = html;
  
  cleaned = cleaned
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s*on\w+="[^"]*"/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Try to find main content
  const mainPatterns = [
    /<main[^>]*>([\s\S]*)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*id="?MainContent"?[^>]*>([\s\S]*)/i,
  ];
  
  for (const pattern of mainPatterns) {
    const match = pattern.exec(cleaned);
    if (match && match[1].trim().length > 1000) {
      cleaned = match[1].trim();
      break;
    }
  }

  cleaned = cleaned
    .replace(/<(div|span|p|section)[^>]*>\s*<\/\1>/gi, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n');

  console.log(`[CLEAN] Final cleaned HTML: ${cleaned.length} chars`);
  return cleaned.trim();
}

// Convert markdown to HTML - preserve images, videos, and formatting
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Images - convert markdown images to HTML img tags
  // ![alt](url) -> <img src="url" alt="alt">
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;">');
  
  // YouTube/Vimeo embeds - detect video URLs in links and convert to embeds
  // [text](youtube.com/watch?v=XXX) -> iframe
  html = html.replace(
    /\[([^\]]*)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)[^)]*)\)/gi,
    '<div class="video-container"><iframe width="560" height="315" src="https://www.youtube.com/embed/$3" frameborder="0" allowfullscreen></iframe></div>'
  );
  
  html = html.replace(
    /\[([^\]]*)\]\((https?:\/\/(?:www\.)?vimeo\.com\/(\d+)[^)]*)\)/gi,
    '<div class="video-container"><iframe src="https://player.vimeo.com/video/$3" width="560" height="315" frameborder="0" allowfullscreen></iframe></div>'
  );
  
  // Headers
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Links (not already converted)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>');
  html = html.replace(/^\*\*\*$/gim, '<hr>');
  
  // Unordered lists
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  
  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => `<ul>${match}</ul>`);
  
  // Paragraphs - wrap text lines that aren't already HTML elements
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    // Skip if empty or already an HTML tag
    if (!trimmed || trimmed.startsWith('<') || trimmed.endsWith('>')) {
      return line;
    }
    return `<p>${trimmed}</p>`;
  });
  html = processedLines.join('\n');
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  // Clean up nested paragraphs inside other elements
  html = html.replace(/<(li|h[1-6])><p>(.*?)<\/p><\/\1>/g, '<$1>$2</$1>');
  
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

// =============================================
// EXTRACT INTERACTIVE ELEMENTS (Buttons, CTAs)
// Convert detected buttons to native blocks
// =============================================

interface ExtractedButton {
  text: string;
  url: string;
  variant: 'primary' | 'secondary' | 'outline';
}

// Extract buttons from HTML content
function extractButtonsFromHtml(html: string): { buttons: ExtractedButton[]; cleanedHtml: string } {
  if (!html) return { buttons: [], cleanedHtml: html };
  
  const buttons: ExtractedButton[] = [];
  let cleanedHtml = html;
  
  // Pattern 1: <a> with button-like classes
  const buttonLinkPatterns = [
    // Shopify button patterns
    /<a[^>]*class="[^"]*(?:btn|button|cta|comprar|buy-now|add-to-cart)[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi,
    // Links with button styling
    /<a[^>]*style="[^"]*(?:background|border-radius|padding)[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi,
  ];
  
  // Pattern 2: <button> elements with text
  const buttonPatterns = [
    /<button[^>]*>([^<]+)<\/button>/gi,
  ];
  
  // Extract buttons from <a> tags
  for (const pattern of buttonLinkPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1];
      const text = match[2].trim();
      
      // Only include meaningful buttons (not just icons or empty)
      if (text && text.length > 2 && text.length < 50 && !/^[<>]+$/.test(text)) {
        // Determine variant based on styling
        const fullMatch = match[0].toLowerCase();
        let variant: 'primary' | 'secondary' | 'outline' = 'primary';
        
        if (fullMatch.includes('outline') || fullMatch.includes('secondary') || fullMatch.includes('ghost')) {
          variant = 'outline';
        } else if (fullMatch.includes('secondary') || fullMatch.includes('alt')) {
          variant = 'secondary';
        }
        
        buttons.push({ text, url: url || '#', variant });
        
        // Remove this button from HTML (it will be a separate block)
        cleanedHtml = cleanedHtml.replace(match[0], '');
      }
    }
  }
  
  // Deduplicate buttons by text
  const uniqueButtons = buttons.reduce((acc, btn) => {
    if (!acc.some(b => b.text.toLowerCase() === btn.text.toLowerCase())) {
      acc.push(btn);
    }
    return acc;
  }, [] as ExtractedButton[]);
  
  console.log(`[EXTRACT-BUTTONS] Found ${uniqueButtons.length} unique buttons`);
  
  return { buttons: uniqueButtons.slice(0, 5), cleanedHtml }; // Max 5 buttons
}

// Create blocks from custom page: CustomBlock + extracted buttons
function createCustomPageBlocks(
  mainContent: string, 
  extractedCss: string, 
  pageTitle: string,
  sourceUrl?: string // Source URL for base href
): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  // Extract buttons from the content
  const { buttons, cleanedHtml } = extractButtonsFromHtml(mainContent);
  
  // Add the main CustomBlock with cleaned HTML
  // CRITICAL: Include baseUrl for resolving relative paths in iframe
  blocks.push({
    id: generateBlockId('customblock'),
    type: 'CustomBlock',
    props: {
      htmlContent: cleanedHtml,
      cssContent: extractedCss,
      blockName: `Página: ${pageTitle}`,
      baseUrl: sourceUrl, // For <base href> in iframe
    },
    children: [],
  });
  
  // Add extracted buttons as native blocks
  for (const btn of buttons) {
    console.log(`[EXTRACT-BUTTONS] Creating Button block: "${btn.text}" -> ${btn.url}`);
    blocks.push({
      id: generateBlockId('button'),
      type: 'Button',
      props: {
        text: btn.text,
        url: btn.url,
        variant: btn.variant,
        size: 'lg',
        fullWidth: false,
        alignment: 'center',
      },
      children: [],
    });
  }
  
  return blocks;
}

// Helper: Try AI CLASSIFICATION first, fallback to regex
async function tryAIOrRegexAnalysis(
  scraped: { html: string; rawHtml?: string; markdown?: string; extractedCss?: string },
  finalTitle: string,
  sourceUrl: string, // Add source URL for base href
  useAI: boolean,
  supabase: any,
  tenantId: string
): Promise<BlockNode> {
  if (useAI) {
    console.log(`[IMPORT] Using AI CLASSIFICATION for: ${finalTitle}`);
    
    const classifyResult = await classifyPageWithAI(scraped.html, finalTitle, sourceUrl);
    
    if (classifyResult.success && classifyResult.classification) {
      console.log(`[IMPORT] AI CLASSIFICATION SUCCESS:`);
      console.log(`  - Type: ${classifyResult.classification.pageType}`);
      console.log(`  - Complexity: ${classifyResult.classification.complexity}`);
      console.log(`  - Sections: ${classifyResult.classification.sections.length}`);
      
      // Use classification to build page with sourceUrl for base href
      return buildPageFromClassification(
        classifyResult.classification,
        scraped.rawHtml || scraped.html,
        scraped.extractedCss || '',
        finalTitle,
        sourceUrl
      );
    } else {
      console.warn(`[IMPORT] AI Classification fallback: ${classifyResult.error || 'no classification'}`);
    }
  }
  
  console.log(`[IMPORT] Using regex analysis for: ${finalTitle}`);
  return createPageWithMappedBlocks(scraped.html, finalTitle);
}

// Process a single page import - NOW WITH ELEMENT-BASED PIPELINE
async function importPage(
  supabase: any,
  tenantId: string,
  page: InstitutionalPage,
  storeUrl?: string,
  useAI: boolean = true // AI is ON by default
): Promise<{ success: boolean; error?: string; pageId?: string }> {
  try {
    console.log(`[IMPORT] Processing page: ${page.title} (${page.url}) - ELEMENT-BASED PIPELINE`);
    
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
    
    // Store extracted CSS globally for pixel-perfect blocks
    const rawHtmlToCheck = scraped.rawHtml || scraped.html || '';
    globalExtractedCss = scraped.extractedCss || '';
    console.log(`[IMPORT] CSS available: ${globalExtractedCss.length} chars`);
    
    // STEP 0: Materialize videos BEFORE any processing
    const { html: videoMaterializedHtml, videosFound, patterns: videoPatterns } = materializeVideos(rawHtmlToCheck);
    console.log(`[IMPORT] Videos materialized: ${videosFound} (patterns: ${videoPatterns.join(', ') || 'none'})`);
    
    // =============================================
    // PRIORIDADE 1: SEGMENTAÇÃO DETERMINÍSTICA (section markers)
    // =============================================
    if (hasExplicitSectionMarkers(videoMaterializedHtml)) {
      console.log(`[IMPORT] Section markers detected - using DETERMINISTIC segmentation`);
      
      const segmentResult = segmentPageBySections(videoMaterializedHtml);
      console.log(`[IMPORT] Segmentation result: ${segmentResult.success ? segmentResult.totalSections + ' sections' : 'failed'}`);
      
      if (segmentResult.success && segmentResult.sections.length >= 1) {
        const sectionBlocks: BlockNode[] = [];
        
        for (const section of segmentResult.sections) {
          let combinedHtml = section.htmlDesktop || section.htmlMobile || '';
          if (section.htmlDesktop && section.htmlMobile) {
            combinedHtml = `
              <div class="section-mobile-variant" style="display: block;">
                ${section.htmlMobile}
              </div>
              <div class="section-desktop-variant" style="display: none;">
                ${section.htmlDesktop}
              </div>
              <style>
                @media (min-width: 768px) {
                  .section-mobile-variant { display: none !important; }
                  .section-desktop-variant { display: block !important; }
                }
              </style>
            `;
          }
          
          console.log(`[IMPORT] Creating block for ${section.name} (${combinedHtml.length} chars)`);
          
          sectionBlocks.push({
            id: generateBlockId('htmlsection'),
            type: 'HTMLSection',
            props: {
              htmlContent: combinedHtml,
              htmlDesktop: section.htmlDesktop || '',
              htmlMobile: section.htmlMobile || '',
              cssContent: globalExtractedCss,
              blockName: section.name,
              baseUrl: page.url,
            },
            children: [],
          });
        }
        
        pageContent = {
          id: generateBlockId('page'),
          type: 'Page',
          props: { backgroundColor: 'transparent', padding: 'none' },
          children: [{
            id: generateBlockId('section'),
            type: 'Section',
            props: { backgroundColor: 'transparent', paddingX: 0, paddingY: 0, marginTop: 0, marginBottom: 0, gap: 0, alignItems: 'stretch', fullWidth: true },
            children: sectionBlocks,
          }],
        };
        
        console.log(`[IMPORT] Created ${sectionBlocks.length} section blocks via DETERMINISTIC segmentation`);
      }
    }
    
    // =============================================
    // PRIORIDADE 2: PIPELINE DE EXTRAÇÃO POR ELEMENTOS COM VALIDAÇÃO VISUAL
    // =============================================
    if (!pageContent!) {
      console.log(`[IMPORT] Using ELEMENT-BASED PIPELINE with VISUAL VALIDATION for: ${finalTitle}`);
      
      // =============================================
      // FASE 0 (NOVA): ANÁLISE VISUAL COM IA
      // =============================================
      let visualAnalysis = null;
      
      if (scraped.screenshot) {
        console.log(`[IMPORT] Phase 0 - Visual AI Analysis (screenshot available)`);
        try {
          visualAnalysis = await analyzePageVisually(scraped.screenshot, page.url, finalTitle);
          
          if (visualAnalysis.success) {
            console.log(`[IMPORT] Visual Analysis SUCCESS:`);
            console.log(`[IMPORT]   - Sections: ${visualAnalysis.sections.length}`);
            console.log(`[IMPORT]   - Approved texts: ${visualAnalysis.approvedTexts.length}`);
            console.log(`[IMPORT]   - Rejected texts: ${visualAnalysis.rejectedTexts.length}`);
            console.log(`[IMPORT]   - Summary: ${visualAnalysis.summary.substring(0, 100)}...`);
            
            // Log approved/rejected for debugging
            if (visualAnalysis.approvedTexts.length > 0) {
              console.log(`[IMPORT]   - Sample approved: "${visualAnalysis.approvedTexts[0].substring(0, 50)}..."`);
            }
            if (visualAnalysis.rejectedTexts.length > 0) {
              console.log(`[IMPORT]   - Sample rejected: "${visualAnalysis.rejectedTexts[0].substring(0, 50)}..."`);
            }
          } else {
            console.warn(`[IMPORT] Visual Analysis failed: ${visualAnalysis.error}`);
          }
        } catch (visualError) {
          console.warn(`[IMPORT] Visual Analysis exception:`, visualError);
        }
      } else {
        console.log(`[IMPORT] Phase 0 - No screenshot available, skipping visual analysis`);
      }
      
      // IMPORTANTE: Detectar plataforma e remover header/footer ANTES de extrair elementos
      const platformDetection = detectPlatformFromHtml(videoMaterializedHtml, page.url);
      console.log(`[IMPORT] Platform detected: ${platformDetection.platform} (confidence: ${platformDetection.confidence}%)`);
      
      // Usar extração baseada na plataforma detectada
      const extractionResult = extractMainContentByPlatform(videoMaterializedHtml, platformDetection.platform);
      const mainContentHtml = extractionResult.content;
      console.log(`[IMPORT] Main content extracted via PLATFORM-BASED: ${mainContentHtml.length} chars (from ${videoMaterializedHtml.length})`);
      console.log(`[IMPORT] Sections removed: [${extractionResult.removedSections.slice(0, 5).join(', ')}${extractionResult.removedSections.length > 5 ? '...' : ''}]`);
      
      // FASE 1: Extrair TODOS os elementos com posição (do conteúdo principal apenas)
      const extractedElements = extractAllElementsInOrder(mainContentHtml);
      console.log(`[IMPORT] Phase 1 - Extracted ${extractedElements.length} elements`);
      
      if (extractedElements.length > 0) {
        // =============================================
        // FASE 1.5 (NOVA): FILTRAR ELEMENTOS PELA ANÁLISE VISUAL
        // =============================================
        let elementsToProcess = extractedElements;
        
        if (visualAnalysis && visualAnalysis.success) {
          console.log(`[IMPORT] Phase 1.5 - Filtering elements by visual analysis`);
          
          const { approved, rejected } = filterElementsByVisualAnalysis(
            extractedElements,
            visualAnalysis,
            { strictMode: false, minSimilarity: 0.5 }
          );
          
          console.log(`[IMPORT] Visual filter result: ${approved.length} approved, ${rejected.length} rejected`);
          
          // Log what was rejected
          for (const el of rejected.slice(0, 5)) {
            const text = el.metadata?.text || el.metadata?.content || '';
            console.log(`[IMPORT]   FILTERED OUT: [${el.type}] "${text.substring(0, 40)}..."`);
          }
          
          elementsToProcess = approved;
        }
        
        // FASE 2: Classificar cada elemento
        const classifiedElements = classifyAllElements(elementsToProcess);
        console.log(`[IMPORT] Phase 2 - Classified ${classifiedElements.length} elements`);
        
        // Log classified elements
        for (const el of classifiedElements) {
          console.log(`[IMPORT]   - ${el.type} -> ${el.blockType} (confidence: ${(el.confidence * 100).toFixed(0)}%, needsNewBlock: ${el.needsNewBlock})`);
        }
        
        // FASE 3: Mesclar elementos consecutivos do mesmo tipo
        const mergedElements = mergeConsecutiveElements(classifiedElements);
        console.log(`[IMPORT] Phase 3 - Merged to ${mergedElements.length} elements`);
        
        // FASE 4: Processar com criação automática de blocos
        const { page: builtPage, newBlockRequests } = await processElementsWithAutoBlockCreation(
          supabase,
          tenantId,
          mergedElements,
          {
            extractedCss: globalExtractedCss,
            sourceUrl: page.url,
            sourcePlatform: 'import',
          }
        );
        
        console.log(`[IMPORT] Phase 4 - Page built, ${newBlockRequests.length} new block requests created`);
        
        if (newBlockRequests.length > 0) {
          console.log(`[IMPORT] New block patterns detected: ${newBlockRequests.join(', ')}`);
        }
        
        pageContent = builtPage;
        
        const blockTypes = pageContent.children[0]?.children?.map((b: BlockNode) => b.type).join(', ') || 'empty';
        console.log(`[IMPORT] ELEMENT-BASED RESULT: ${blockTypes}`);
      }
    }
    
    // =============================================
    // FALLBACK: Análise híbrida/AI se pipeline falhou
    // =============================================
    if (!pageContent!) {
      console.log(`[IMPORT] FALLBACK - Using hybrid analysis`);
      
      const hybridResult = analyzeForHybridImport(videoMaterializedHtml);
      
      if (hybridResult.hasNativeContent) {
        pageContent = await tryAIOrRegexAnalysis(
          { html: videoMaterializedHtml, rawHtml: scraped.rawHtml, markdown: scraped.markdown, extractedCss: scraped.extractedCss }, 
          finalTitle, page.url, false, supabase, tenantId
        );
      } else {
        const isCustomPage = isHighlyCustomPage(videoMaterializedHtml);
        
        if (isCustomPage) {
          const responsiveImages = extractDesktopMobileImages(videoMaterializedHtml);
          // Use platform-based extraction for fallback too
          const fallbackPlatformDetection = detectPlatformFromHtml(videoMaterializedHtml, page.url);
          const fallbackExtractionResult = extractMainContentByPlatform(videoMaterializedHtml, fallbackPlatformDetection.platform);
          const mainContent = fallbackExtractionResult.content;
          
          if (mainContent.length > 500) {
            const imageBlocks = createImageBlocksFromPairs(responsiveImages);
            const customBlocks = createCustomPageBlocks(mainContent, globalExtractedCss, finalTitle, page.url);
            const allBlocks = [...imageBlocks, ...customBlocks];
            
            pageContent = {
              id: generateBlockId('page'),
              type: 'Page',
              props: { backgroundColor: 'transparent', padding: 'none' },
              children: [{
                id: generateBlockId('section'),
                type: 'Section',
                props: { backgroundColor: 'transparent', paddingX: 0, paddingY: 0, marginTop: 0, marginBottom: 0, gap: 16, alignItems: 'stretch', fullWidth: true },
                children: allBlocks,
              }],
            };
          } else {
            pageContent = await tryAIOrRegexAnalysis(scraped, finalTitle, page.url, useAI, supabase, tenantId);
          }
        } else {
          pageContent = await tryAIOrRegexAnalysis(scraped, finalTitle, page.url, useAI, supabase, tenantId);
        }
      }
    }
    
    // Process any pending complex page placeholders
    const pageSection = pageContent.children[0];
    if (pageSection && pageSection.children) {
      const newChildren: BlockNode[] = [];
      
      for (const block of pageSection.children) {
        if (block.type === '__CustomBlockPending__') {
          const customBlocks = await createComplexPageBlocks(
            supabase, tenantId, block.props.htmlContent as string, page.url,
            { patternType: block.props.patternType as string, patternName: block.props.patternName as string, confidence: block.props.confidence as number }
          );
          newChildren.push(...customBlocks);
        } else {
          newChildren.push(block);
        }
      }
      
      pageSection.children = newChildren;
    }
    
    const blockTypes = pageSection?.children?.map((b: BlockNode) => b.type).join(', ') || 'empty';
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
