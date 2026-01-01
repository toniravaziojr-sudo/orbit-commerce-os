// =============================================
// SEGMENTAÇÃO DETERMINÍSTICA POR SEÇÃO v2
// =============================================
// Este módulo detecta e segmenta páginas que possuem
// marcação clara de seções via comentários HTML.
// 
// PADRÕES SUPORTADOS:
// <!-- ========== SECTION N ========== --> (desktop)
// <!-- ========== SECTION N tablet ========== --> (mobile/tablet)
// <!-- ========== SECTION N NOME ========== --> (com nome)
// 
// REGRAS:
// 1. Cada comentário SECTION inicia um novo bloco
// 2. Variantes "tablet" são tratadas como htmlMobile
// 3. Se houver múltiplas <section class="section5">, criar 5A/5B/5C
// 4. Conteúdo entre comentários inclui TUDO (não só <section>)
// =============================================

export interface SegmentedSection {
  sectionNumber: number;
  subIndex?: string; // 'A', 'B', 'C' para seções repetidas
  name: string;
  htmlDesktop: string;
  htmlMobile: string;
  hasDesktopMobile: boolean;
  order: number; // Ordem no HTML original
  markerStart: string; // Comentário original para debug
}

export interface SegmentationResult {
  success: boolean;
  sections: SegmentedSection[];
  method: 'comments-v2' | 'section-classes' | 'none';
  totalSections: number;
  diagnostics: {
    commentsFound: number;
    desktopVariants: number;
    mobileVariants: number;
    duplicateSectionNumbers: string[];
  };
}

interface SectionMarker {
  index: number; // Posição no HTML
  fullMatch: string; // O comentário completo
  sectionNumber: number;
  isTablet: boolean; // true se "tablet" no marcador
  rawName?: string; // Nome extra no marcador (ex: "graus 1 e 2")
}

// =============================================
// PARSE SECTION COMMENTS
// =============================================
// Detecta comentários no formato:
// <!-- ========== SECTION 1 ========== -->
// <!-- ========== SECTION 1 tablet ========== -->
// =============================================
function parseSectionComments(html: string): SectionMarker[] {
  const markers: SectionMarker[] = [];
  
  // Regex mais flexível para capturar variantes
  // Grupo 1: número da seção
  // Grupo 2: opcional "tablet" ou "mobile"
  // Grupo 3: opcional nome extra
  const pattern = /<!--\s*=+\s*SECTION\s*(\d+)\s*(tablet|mobile)?\s*([^=\-]*?)\s*=*\s*-->/gi;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const sectionNum = parseInt(match[1], 10);
    const variantType = (match[2] || '').toLowerCase();
    const extraName = (match[3] || '').trim();
    
    markers.push({
      index: match.index,
      fullMatch: match[0],
      sectionNumber: sectionNum,
      isTablet: variantType === 'tablet' || variantType === 'mobile',
      rawName: extraName || undefined,
    });
    
    console.log(`[SEGMENTER-v2] Found marker: SECTION ${sectionNum}${variantType ? ` ${variantType}` : ''}${extraName ? ` (${extraName})` : ''} at ${match.index}`);
  }
  
  return markers;
}

// =============================================
// EXTRACT CONTENT BETWEEN MARKERS
// =============================================
// Pega TODO o conteúdo entre dois marcadores
// (não apenas <section>)
// =============================================
function extractContentBetweenMarkers(
  html: string,
  startMarker: SectionMarker,
  endMarkerIndex: number | null
): string {
  const startPos = startMarker.index + startMarker.fullMatch.length;
  const endPos = endMarkerIndex !== null ? endMarkerIndex : html.length;
  
  const content = html.substring(startPos, endPos).trim();
  return content;
}

// =============================================
// MAIN SEGMENTATION FUNCTION v2
// =============================================
export function segmentPageBySections(html: string): SegmentationResult {
  console.log(`[SEGMENTER-v2] Starting segmentation of ${html.length} chars`);
  
  const diagnostics = {
    commentsFound: 0,
    desktopVariants: 0,
    mobileVariants: 0,
    duplicateSectionNumbers: [] as string[],
  };
  
  // Parse all section comments
  const markers = parseSectionComments(html);
  diagnostics.commentsFound = markers.length;
  
  if (markers.length < 2) {
    console.log(`[SEGMENTER-v2] Not enough markers (${markers.length}), falling back`);
    return {
      success: false,
      sections: [],
      method: 'none',
      totalSections: 0,
      diagnostics,
    };
  }
  
  // Sort markers by position in HTML (should already be sorted, but be safe)
  markers.sort((a, b) => a.index - b.index);
  
  // Group by section number and track order
  // Map: sectionNumber -> { desktop: [contents], mobile: [contents], order }
  const sectionMap = new Map<number, {
    desktopContents: string[];
    mobileContents: string[];
    names: string[];
    firstOrder: number;
  }>();
  
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const nextMarkerIndex = i + 1 < markers.length ? markers[i + 1].index : null;
    
    const content = extractContentBetweenMarkers(html, marker, nextMarkerIndex);
    
    // Skip empty or trivial content
    if (content.length < 50) {
      console.log(`[SEGMENTER-v2] Skipping SECTION ${marker.sectionNumber} (too short: ${content.length} chars)`);
      continue;
    }
    
    if (!sectionMap.has(marker.sectionNumber)) {
      sectionMap.set(marker.sectionNumber, {
        desktopContents: [],
        mobileContents: [],
        names: [],
        firstOrder: i,
      });
    }
    
    const entry = sectionMap.get(marker.sectionNumber)!;
    
    if (marker.isTablet) {
      entry.mobileContents.push(content);
      diagnostics.mobileVariants++;
    } else {
      entry.desktopContents.push(content);
      diagnostics.desktopVariants++;
    }
    
    if (marker.rawName && !entry.names.includes(marker.rawName)) {
      entry.names.push(marker.rawName);
    }
  }
  
  // Build final sections
  const sections: SegmentedSection[] = [];
  
  // Sort by section number
  const sortedSectionNums = [...sectionMap.keys()].sort((a, b) => a - b);
  
  for (const sectionNum of sortedSectionNums) {
    const entry = sectionMap.get(sectionNum)!;
    
    // Handle multiple desktop contents for same section number (e.g., multiple section5)
    const desktopCount = entry.desktopContents.length;
    
    if (desktopCount > 1) {
      // Multiple sections with same number - create sub-indices (A, B, C)
      diagnostics.duplicateSectionNumbers.push(`${sectionNum}x${desktopCount}`);
      
      for (let j = 0; j < desktopCount; j++) {
        const subIndex = String.fromCharCode(65 + j); // A, B, C...
        const nameSuffix = entry.names[j] || `Parte ${subIndex}`;
        
        sections.push({
          sectionNumber: sectionNum,
          subIndex,
          name: `Section ${sectionNum}${subIndex} - ${nameSuffix}`,
          htmlDesktop: entry.desktopContents[j],
          htmlMobile: entry.mobileContents[j] || '', // May not have mobile variant per sub-section
          hasDesktopMobile: !!entry.mobileContents[j],
          order: entry.firstOrder + j,
          markerStart: `<!-- SECTION ${sectionNum}${subIndex} -->`,
        });
        
        console.log(`[SEGMENTER-v2] Created Section ${sectionNum}${subIndex}: ${entry.desktopContents[j].length} desktop, ${entry.mobileContents[j]?.length || 0} mobile`);
      }
    } else {
      // Single section with this number
      const name = entry.names[0] || '';
      
      sections.push({
        sectionNumber: sectionNum,
        name: name ? `Section ${sectionNum} - ${name}` : `Section ${sectionNum}`,
        htmlDesktop: entry.desktopContents[0] || '',
        htmlMobile: entry.mobileContents[0] || '',
        hasDesktopMobile: !!entry.mobileContents[0] && !!entry.desktopContents[0],
        order: entry.firstOrder,
        markerStart: `<!-- SECTION ${sectionNum} -->`,
      });
      
      console.log(`[SEGMENTER-v2] Created Section ${sectionNum}: ${entry.desktopContents[0]?.length || 0} desktop, ${entry.mobileContents[0]?.length || 0} mobile, hasVariants=${!!entry.mobileContents[0]}`);
    }
  }
  
  // Sort by original order in HTML
  sections.sort((a, b) => a.order - b.order);
  
  console.log(`[SEGMENTER-v2] Complete: ${sections.length} sections created`);
  console.log(`[SEGMENTER-v2] Diagnostics:`, diagnostics);
  
  return {
    success: sections.length >= 1,
    sections,
    method: 'comments-v2',
    totalSections: sections.length,
    diagnostics,
  };
}

// =============================================
// QUICK CHECK FOR SECTION MARKERS
// =============================================
export function hasExplicitSectionMarkers(html: string): boolean {
  // Quick check for section comments
  return /<!--\s*=*\s*SECTION\s*\d+/i.test(html);
}

// =============================================
// COMBINE DESKTOP + MOBILE HTML
// =============================================
// For pixel-perfect rendering, we keep ONLY the appropriate variant
// based on viewport. This function returns combined HTML where
// CSS media queries will handle visibility.
// =============================================
export function combineDesktopMobileHtml(
  htmlDesktop: string, 
  htmlMobile: string,
  wrapWithClasses: boolean = true
): string {
  if (!htmlMobile) return htmlDesktop;
  if (!htmlDesktop) return htmlMobile;
  
  if (wrapWithClasses) {
    // Wrap each in a container with responsive classes
    return `
      <div class="section-variant-mobile" style="display: block;">
        ${htmlMobile}
      </div>
      <div class="section-variant-desktop" style="display: none;">
        ${htmlDesktop}
      </div>
      <style>
        @media (min-width: 768px) {
          .section-variant-mobile { display: none !important; }
          .section-variant-desktop { display: block !important; }
        }
      </style>
    `;
  }
  
  // Just concatenate (let original CSS handle visibility)
  return `${htmlMobile}\n${htmlDesktop}`;
}
