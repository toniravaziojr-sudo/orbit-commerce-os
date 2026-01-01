// =============================================
// EXTRATOR DE CONTEÚDO BASEADO EM PLATAFORMA
// Remove header/footer e extrai apenas conteúdo principal
// =============================================

import { getPlatformConfig, type PlatformContentConfig } from './platform-content-selectors.ts';

interface ExtractionResult {
  content: string;
  platform: string;
  removedSections: string[];
  extractedFrom: string | null;
  stats: {
    originalLength: number;
    finalLength: number;
    sectionsRemoved: number;
  };
}

/**
 * Extrai conteúdo principal de uma página baseado na plataforma detectada.
 * Remove header, footer, nav e outros elementos não-conteúdo.
 */
export function extractMainContentByPlatform(
  html: string,
  platform: string
): ExtractionResult {
  console.log(`[PLATFORM-EXTRACT] Starting extraction for platform: ${platform}`);
  console.log(`[PLATFORM-EXTRACT] INPUT: { platform: "${platform}", htmlLength: ${html.length} }`);
  
  const config = getPlatformConfig(platform);
  const removedSections: string[] = [];
  let content = html;
  const originalLength = html.length;
  
  // =============================================
  // STEP 1: Remover por COMENTÁRIOS HTML (mais preciso)
  // =============================================
  if (config.sectionComments) {
    console.log(`[PLATFORM-EXTRACT] STEP 1: Removing sections by HTML comments`);
    
    // Remover header-group
    const headerPattern = new RegExp(
      config.sectionComments.headerStart.source + 
      '[\\s\\S]*?' + 
      config.sectionComments.headerEnd.source, 
      'gi'
    );
    
    const headerMatches = content.match(headerPattern);
    if (headerMatches) {
      content = content.replace(headerPattern, '<!-- HEADER-GROUP REMOVED BY PLATFORM-EXTRACT -->');
      removedSections.push('header-group (by comment)');
      console.log(`[PLATFORM-EXTRACT]   - Removed header-group: ${headerMatches.length} matches, ${headerMatches[0]?.length || 0} chars`);
    }
    
    // Remover footer-group
    const footerPattern = new RegExp(
      config.sectionComments.footerStart.source + 
      '[\\s\\S]*?' + 
      config.sectionComments.footerEnd.source, 
      'gi'
    );
    
    const footerMatches = content.match(footerPattern);
    if (footerMatches) {
      content = content.replace(footerPattern, '<!-- FOOTER-GROUP REMOVED BY PLATFORM-EXTRACT -->');
      removedSections.push('footer-group (by comment)');
      console.log(`[PLATFORM-EXTRACT]   - Removed footer-group: ${footerMatches.length} matches, ${footerMatches[0]?.length || 0} chars`);
    }
    
    // Remover padrões adicionais de comentários (overlay-group, etc)
    if (config.additionalCommentPatterns) {
      for (const pattern of config.additionalCommentPatterns) {
        const additionalPattern = new RegExp(
          pattern.start.source + 
          '[\\s\\S]*?' + 
          pattern.end.source, 
          'gi'
        );
        
        const additionalMatches = content.match(additionalPattern);
        if (additionalMatches) {
          content = content.replace(additionalPattern, '<!-- SECTION REMOVED BY PLATFORM-EXTRACT -->');
          removedSections.push(`additional-pattern (by comment)`);
          console.log(`[PLATFORM-EXTRACT]   - Removed additional section: ${additionalMatches.length} matches, ${additionalMatches[0]?.length || 0} chars`);
        }
      }
    }
  }
  
  // =============================================
  // STEP 2: Remover por SELETORES CSS
  // =============================================
  console.log(`[PLATFORM-EXTRACT] STEP 2: Removing elements by CSS selectors`);
  
  for (const selector of config.excludeSelectors) {
    const result = removeElementBySelector(content, selector);
    if (result.removed) {
      content = result.html;
      removedSections.push(`${selector} (${result.count} elements)`);
      console.log(`[PLATFORM-EXTRACT]   - Removed: ${selector} (${result.count} elements, ~${result.charsRemoved} chars)`);
    }
  }
  
  // =============================================
  // STEP 3: Tentar extrair APENAS o conteúdo principal
  // =============================================
  console.log(`[PLATFORM-EXTRACT] STEP 3: Extracting main content area`);
  
  let extractedFrom: string | null = null;
  
  for (const mainSelector of config.mainContentSelectors) {
    const extracted = extractBySelector(content, mainSelector);
    
    // Aceitar se tiver conteúdo substancial (>300 chars)
    if (extracted && extracted.length > 300) {
      console.log(`[PLATFORM-EXTRACT]   - Found main content via: ${mainSelector} (${extracted.length} chars)`);
      content = extracted;
      extractedFrom = mainSelector;
      break;
    } else if (extracted) {
      console.log(`[PLATFORM-EXTRACT]   - Skipped ${mainSelector}: too short (${extracted.length} chars)`);
    }
  }
  
  if (!extractedFrom) {
    console.log(`[PLATFORM-EXTRACT]   - No main content selector matched, using full cleaned content`);
  }
  
  // =============================================
  // STEP 4: Limpeza final (scripts, styles, handlers)
  // =============================================
  console.log(`[PLATFORM-EXTRACT] STEP 4: Final cleanup`);
  
  // Remover scripts
  const scriptsBefore = (content.match(/<script/gi) || []).length;
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  
  // Remover noscript
  content = content.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  
  // Remover styles inline (manteremos CSS externo)
  const stylesBefore = (content.match(/<style/gi) || []).length;
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Remover links de CSS
  content = content.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
  content = content.replace(/<link[^>]*href=["'][^"']*\.css[^"']*["'][^>]*>/gi, '');
  
  // Remover event handlers
  content = content.replace(/\s*on\w+="[^"]*"/gi, '');
  
  console.log(`[PLATFORM-EXTRACT]   - Removed ${scriptsBefore} scripts, ${stylesBefore} styles`);
  
  // =============================================
  // STEP 5: Limpar elementos vazios e whitespace
  // =============================================
  content = content.replace(/<(div|span|section|p)[^>]*>\s*<\/\1>/gi, '');
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  content = content.trim();
  
  const finalLength = content.length;
  const reduction = ((originalLength - finalLength) / originalLength * 100).toFixed(1);
  
  console.log(`[PLATFORM-EXTRACT] OUTPUT: { finalLength: ${finalLength}, reduction: ${reduction}%, sectionsRemoved: ${removedSections.length}, extractedFrom: "${extractedFrom || 'none'}" }`);
  console.log(`[PLATFORM-EXTRACT] Removed sections: [${removedSections.join(', ')}]`);
  
  return {
    content,
    platform,
    removedSections,
    extractedFrom,
    stats: {
      originalLength,
      finalLength,
      sectionsRemoved: removedSections.length,
    },
  };
}

/**
 * Remove elementos que correspondem a um seletor CSS (usando regex).
 * Suporta seletores de tag, classe, ID e atributos básicos.
 */
function removeElementBySelector(
  html: string, 
  selector: string
): { html: string; removed: boolean; count: number; charsRemoved: number } {
  let result = html;
  let count = 0;
  let charsRemoved = 0;
  
  // Parse selector type
  if (selector.startsWith('#')) {
    // ID selector: #header
    const id = selector.slice(1);
    const pattern = new RegExp(`<([a-z][a-z0-9]*)[^>]*\\bid=["']${escapeRegex(id)}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
    const matches = result.match(pattern);
    if (matches) {
      count = matches.length;
      charsRemoved = matches.reduce((sum, m) => sum + m.length, 0);
      result = result.replace(pattern, '');
    }
  } else if (selector.startsWith('.')) {
    // Class selector: .header
    const className = selector.slice(1);
    const pattern = new RegExp(`<([a-z][a-z0-9]*)[^>]*\\bclass=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
    const matches = result.match(pattern);
    if (matches) {
      count = matches.length;
      charsRemoved = matches.reduce((sum, m) => sum + m.length, 0);
      result = result.replace(pattern, '');
    }
  } else if (selector.startsWith('[')) {
    // Attribute selector: [data-section-type="header"]
    const attrMatch = selector.match(/\[([^=\]]+)(?:=["']([^"']+)["'])?\]/);
    if (attrMatch) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2];
      
      let pattern: RegExp;
      if (attrValue) {
        pattern = new RegExp(`<([a-z][a-z0-9]*)[^>]*\\b${escapeRegex(attrName)}=["']${escapeRegex(attrValue)}["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
      } else {
        pattern = new RegExp(`<([a-z][a-z0-9]*)[^>]*\\b${escapeRegex(attrName)}(?:=["'][^"']*["'])?[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
      }
      
      const matches = result.match(pattern);
      if (matches) {
        count = matches.length;
        charsRemoved = matches.reduce((sum, m) => sum + m.length, 0);
        result = result.replace(pattern, '');
      }
    }
  } else if (selector.includes('[')) {
    // Tag with attribute: main[role="main"]
    const [tag, ...attrParts] = selector.split('[');
    const attrSelector = '[' + attrParts.join('[');
    const attrMatch = attrSelector.match(/\[([^=\]]+)(?:=["']([^"']+)["'])?\]/);
    
    if (attrMatch) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2];
      
      let pattern: RegExp;
      if (attrValue) {
        pattern = new RegExp(`<${escapeRegex(tag)}[^>]*\\b${escapeRegex(attrName)}=["']${escapeRegex(attrValue)}["'][^>]*>[\\s\\S]*?<\\/${escapeRegex(tag)}>`, 'gi');
      } else {
        pattern = new RegExp(`<${escapeRegex(tag)}[^>]*\\b${escapeRegex(attrName)}(?:=["'][^"']*["'])?[^>]*>[\\s\\S]*?<\\/${escapeRegex(tag)}>`, 'gi');
      }
      
      const matches = result.match(pattern);
      if (matches) {
        count = matches.length;
        charsRemoved = matches.reduce((sum, m) => sum + m.length, 0);
        result = result.replace(pattern, '');
      }
    }
  } else {
    // Simple tag selector: header, footer, nav
    const tag = selector;
    const pattern = new RegExp(`<${escapeRegex(tag)}\\b[^>]*>[\\s\\S]*?<\\/${escapeRegex(tag)}>`, 'gi');
    const matches = result.match(pattern);
    if (matches) {
      count = matches.length;
      charsRemoved = matches.reduce((sum, m) => sum + m.length, 0);
      result = result.replace(pattern, '');
    }
  }
  
  return { html: result, removed: count > 0, count, charsRemoved };
}

/**
 * Extrai o conteúdo de um elemento que corresponde ao seletor.
 * Retorna o innerHTML do primeiro elemento encontrado.
 */
function extractBySelector(html: string, selector: string): string | null {
  let pattern: RegExp;
  
  if (selector.startsWith('#')) {
    // ID selector
    const id = selector.slice(1);
    pattern = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bid=["']${escapeRegex(id)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
  } else if (selector.startsWith('.')) {
    // Class selector
    const className = selector.slice(1);
    pattern = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bclass=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
  } else if (selector.startsWith('[')) {
    // Attribute selector
    const attrMatch = selector.match(/\[([^=\]]+)(?:=["']([^"']+)["'])?\]/);
    if (!attrMatch) return null;
    
    const attrName = attrMatch[1];
    const attrValue = attrMatch[2];
    
    if (attrValue) {
      pattern = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\b${escapeRegex(attrName)}=["']${escapeRegex(attrValue)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
    } else {
      pattern = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\b${escapeRegex(attrName)}(?:=["'][^"']*["'])?[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
    }
  } else if (selector.includes('[')) {
    // Tag with attribute: main[role="main"]
    const [tag, ...attrParts] = selector.split('[');
    const attrSelector = '[' + attrParts.join('[');
    const attrMatch = attrSelector.match(/\[([^=\]]+)(?:=["']([^"']+)["'])?\]/);
    
    if (!attrMatch) return null;
    
    const attrName = attrMatch[1];
    const attrValue = attrMatch[2];
    
    if (attrValue) {
      pattern = new RegExp(`<${escapeRegex(tag)}\\b[^>]*\\b${escapeRegex(attrName)}=["']${escapeRegex(attrValue)}["'][^>]*>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`, 'i');
    } else {
      pattern = new RegExp(`<${escapeRegex(tag)}\\b[^>]*\\b${escapeRegex(attrName)}(?:=["'][^"']*["'])?[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`, 'i');
    }
  } else {
    // Simple tag selector
    const tag = selector;
    pattern = new RegExp(`<${escapeRegex(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`, 'i');
  }
  
  const match = html.match(pattern);
  
  // Para seletores de tag com atributo, o grupo capturado é diferente
  if (match) {
    // Se tem 3 grupos, o conteúdo está no grupo 2, senão no grupo 1
    return match[2] !== undefined ? match[2] : match[1];
  }
  
  return null;
}

/**
 * Escapa caracteres especiais para uso em RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
