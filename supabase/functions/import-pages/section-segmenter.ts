// =============================================
// SEGMENTAÇÃO DETERMINÍSTICA POR SEÇÃO
// =============================================
// Este módulo detecta e segmenta páginas que já possuem
// marcação clara de seções (SECTION 1, section1, etc.)
// ANTES de qualquer processamento de IA.
// 
// Regras:
// 1. Detectar comentários <!-- SECTION X --> ou <!-- ========== SECTION X ========== -->
// 2. Detectar <section class="sectionN"> (desktop) e <section class="sectionN tablet"> (mobile)
// 3. Agrupar desktop + mobile da mesma seção no mesmo bloco
// 4. Criar 1 CustomBlock por seção, preservando ordem
// =============================================

interface SegmentedSection {
  sectionNumber: number;
  name: string;
  htmlContent: string; // Combined desktop + mobile HTML
  hasDesktopMobile: boolean;
  startIndex: number;
}

interface SegmentationResult {
  success: boolean;
  sections: SegmentedSection[];
  method: 'comments' | 'section-classes' | 'none';
  totalSections: number;
  diagnostics: {
    commentsFound: number;
    sectionsFound: number;
    desktopMobilePairs: number;
  };
}

// Detect sections by HTML comments like <!-- ========== SECTION 1 ========== -->
function detectSectionsByComments(html: string): { sections: Map<number, { desktop: string; mobile: string }>; count: number } {
  const sections = new Map<number, { desktop: string; mobile: string }>();
  
  // Pattern: <!-- ========== SECTION X ========== --> or <!-- SECTION X -->
  const commentPattern = /<!--\s*=* SECTION\s*(\d+)\s*=*-->/gi;
  
  const matches = [...html.matchAll(commentPattern)];
  console.log(`[SEGMENTER] Found ${matches.length} section comments`);
  
  if (matches.length < 2) {
    return { sections, count: 0 };
  }
  
  // Extract content between section markers
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const sectionNum = parseInt(match[1], 10);
    const startIdx = match.index! + match[0].length;
    
    // Find end: either next SECTION comment or end of HTML
    let endIdx = html.length;
    if (i + 1 < matches.length) {
      endIdx = matches[i + 1].index!;
    }
    
    const sectionHtml = html.substring(startIdx, endIdx).trim();
    
    if (sectionHtml.length > 50) {
      // Check if this is mobile/tablet version
      const isMobile = /class="[^"]*\b(?:tablet|mobile)\b[^"]*"/i.test(sectionHtml.substring(0, 500));
      
      if (!sections.has(sectionNum)) {
        sections.set(sectionNum, { desktop: '', mobile: '' });
      }
      
      const existing = sections.get(sectionNum)!;
      if (isMobile) {
        existing.mobile = sectionHtml;
      } else {
        // If desktop already exists, append (both desktop versions)
        existing.desktop = existing.desktop ? existing.desktop + '\n' + sectionHtml : sectionHtml;
      }
    }
  }
  
  return { sections, count: matches.length };
}

// Detect sections by <section class="sectionN"> elements
function detectSectionsByClasses(html: string): { sections: Map<number, { desktop: string; mobile: string }>; count: number } {
  const sections = new Map<number, { desktop: string; mobile: string }>();
  
  // Pattern: <section ... class="... sectionN ..." ...> ... </section>
  // Need to handle nested sections properly
  const sectionPattern = /<section\s+[^>]*class="([^"]*\bsection(\d+)\b[^"]*)"[^>]*>([\s\S]*?)<\/section>/gi;
  
  let match;
  let count = 0;
  
  while ((match = sectionPattern.exec(html)) !== null) {
    count++;
    const fullClass = match[1];
    const sectionNum = parseInt(match[2], 10);
    const content = match[0]; // Full section including tags
    
    // Check if mobile/tablet version
    const isMobile = /\b(?:tablet|mobile)\b/i.test(fullClass);
    
    if (!sections.has(sectionNum)) {
      sections.set(sectionNum, { desktop: '', mobile: '' });
    }
    
    const existing = sections.get(sectionNum)!;
    if (isMobile) {
      existing.mobile = content;
    } else {
      existing.desktop = content;
    }
  }
  
  console.log(`[SEGMENTER] Found ${count} section elements with sectionN classes`);
  
  return { sections, count };
}

// Combine desktop and mobile HTML for a section
function combineSectionHtml(desktop: string, mobile: string): string {
  // Keep both versions - CSS will handle visibility via media queries
  // Mobile first (typically hidden on desktop), then desktop
  if (mobile && desktop) {
    return `${mobile}\n${desktop}`;
  }
  return desktop || mobile;
}

// Main segmentation function
export function segmentPageBySections(html: string): SegmentationResult {
  console.log(`[SEGMENTER] Starting segmentation of ${html.length} chars`);
  
  const diagnostics = {
    commentsFound: 0,
    sectionsFound: 0,
    desktopMobilePairs: 0,
  };
  
  // Try comment-based segmentation first (highest confidence)
  const commentResult = detectSectionsByComments(html);
  diagnostics.commentsFound = commentResult.count;
  
  if (commentResult.sections.size >= 2) {
    console.log(`[SEGMENTER] Using COMMENT-based segmentation (${commentResult.sections.size} sections)`);
    
    const sections: SegmentedSection[] = [];
    const sortedNums = [...commentResult.sections.keys()].sort((a, b) => a - b);
    
    for (const num of sortedNums) {
      const { desktop, mobile } = commentResult.sections.get(num)!;
      const hasDesktopMobile = !!desktop && !!mobile;
      if (hasDesktopMobile) diagnostics.desktopMobilePairs++;
      
      sections.push({
        sectionNumber: num,
        name: `Section ${num}`,
        htmlContent: combineSectionHtml(desktop, mobile),
        hasDesktopMobile,
        startIndex: num,
      });
    }
    
    return {
      success: true,
      sections,
      method: 'comments',
      totalSections: sections.length,
      diagnostics,
    };
  }
  
  // Try class-based segmentation
  const classResult = detectSectionsByClasses(html);
  diagnostics.sectionsFound = classResult.count;
  
  if (classResult.sections.size >= 2) {
    console.log(`[SEGMENTER] Using CLASS-based segmentation (${classResult.sections.size} sections)`);
    
    const sections: SegmentedSection[] = [];
    const sortedNums = [...classResult.sections.keys()].sort((a, b) => a - b);
    
    for (const num of sortedNums) {
      const { desktop, mobile } = classResult.sections.get(num)!;
      const hasDesktopMobile = !!desktop && !!mobile;
      if (hasDesktopMobile) diagnostics.desktopMobilePairs++;
      
      sections.push({
        sectionNumber: num,
        name: `Section ${num}`,
        htmlContent: combineSectionHtml(desktop, mobile),
        hasDesktopMobile,
        startIndex: num,
      });
    }
    
    return {
      success: true,
      sections,
      method: 'section-classes',
      totalSections: sections.length,
      diagnostics,
    };
  }
  
  // No clear segmentation found
  console.log(`[SEGMENTER] No clear section markers found`);
  return {
    success: false,
    sections: [],
    method: 'none',
    totalSections: 0,
    diagnostics,
  };
}

// Check if page has section markers (quick check before full segmentation)
export function hasExplicitSectionMarkers(html: string): boolean {
  // Quick check for section comments or sectionN classes
  const hasComments = /<!--\s*=* SECTION\s*\d+/i.test(html);
  const hasSectionClasses = /<section[^>]*class="[^"]*\bsection\d+\b/i.test(html);
  
  return hasComments || hasSectionClasses;
}
