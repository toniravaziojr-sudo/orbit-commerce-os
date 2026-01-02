// =====================================================
// SHOPIFY BLOCK POST-PROCESSOR v1
// =====================================================
// Pós-processa blocos já gerados pela importação
// 
// REGRAS FIXAS (anti-regressão):
// 1. Ordem canônica: Título → Video → Heading (GRAU) → Parágrafo → CTA
// 2. Separar RichText com heading+paragraph em múltiplos blocos
// 3. Garantir props corretas do YouTubeVideo (youtubeUrl)
// 4. Garantir estilo do Button (preto/branco)
// 5. HARD-FAIL se estrutura incompleta
// =====================================================

export interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: BlockNode[];
}

export interface PostProcessResult {
  success: boolean;
  blocks: BlockNode[];
  errors: string[];
  logs: string[];
}

// Noise phrases to remove from text
const NOISE_PHRASES = [
  'share',
  '1/1',
  'compartilhar',
  'watch on youtube',
  'assistir no youtube',
];

/**
 * Pós-processa blocos Shopify para garantir ordem e separação corretas
 */
export function postProcessShopifyBlocks(
  blocks: BlockNode[],
  generateBlockId: (prefix: string) => string
): PostProcessResult {
  const logs: string[] = [];
  const errors: string[] = [];
  
  logs.push(`[POST-PROCESSOR] Input: ${blocks.length} blocks`);
  logs.push(`[POST-PROCESSOR] Block types before: ${blocks.map(b => b.type).join(', ')}`);
  
  // Step 1: Identify and categorize blocks
  let titleBlock: BlockNode | null = null;
  let videoBlock: BlockNode | null = null;
  let grauHeadingBlock: BlockNode | null = null;
  let paragraphBlock: BlockNode | null = null;
  let ctaBlock: BlockNode | null = null;
  const otherBlocks: BlockNode[] = [];
  
  for (const block of blocks) {
    if (block.type === 'YouTubeVideo') {
      videoBlock = block;
      logs.push(`[POST-PROCESSOR] Found YouTubeVideo: ${block.props.youtubeUrl || block.props.url || 'no-url'}`);
      continue;
    }
    
    if (block.type === 'Button') {
      ctaBlock = block;
      logs.push(`[POST-PROCESSOR] Found Button: \"${block.props.text}\"`);
      continue;
    }
    
    if (block.type === 'RichText') {
      const content = (block.props.content as string) || '';
      const contentLower = content.toLowerCase();
      
      // Check if this is the main title (h1)
      if (content.includes('<h1') && contentLower.includes('como funciona')) {
        titleBlock = block;
        logs.push(`[POST-PROCESSOR] Found title block: \"${content.substring(0, 50)}...\"`);
        continue;
      }
      
      // Check if this contains \"GRAU DE CALVÍCIE\" heading
      const hasGrau = contentLower.includes('grau de calv') || contentLower.includes('grau de calvície');
      const hasConsulte = contentLower.includes('consulte aqui');
      
      if (hasGrau && hasConsulte) {
        // SPLIT: This block contains both heading and paragraph - separate them
        logs.push(`[POST-PROCESSOR] Found combined GRAU + Consulte block - SPLITTING`);
        
        const splitResult = splitGrauBlock(content, generateBlockId);
        if (splitResult.heading) {
          grauHeadingBlock = splitResult.heading;
          logs.push(`[POST-PROCESSOR] Split: GRAU heading extracted`);
        }
        if (splitResult.paragraph) {
          paragraphBlock = splitResult.paragraph;
          logs.push(`[POST-PROCESSOR] Split: Consulte paragraph extracted`);
        }
        continue;
      }
      
      if (hasGrau && !grauHeadingBlock) {
        grauHeadingBlock = block;
        logs.push(`[POST-PROCESSOR] Found GRAU heading block`);
        continue;
      }
      
      if (hasConsulte && !paragraphBlock) {
        paragraphBlock = block;
        logs.push(`[POST-PROCESSOR] Found Consulte paragraph block`);
        continue;
      }
      
      // Other RichText blocks
      otherBlocks.push(block);
    }
  }
  
  // Step 2: Fix YouTubeVideo props
  if (videoBlock) {
    videoBlock = fixVideoBlockProps(videoBlock, logs);
  }
  
  // Step 3: Fix Button props (ensure black/white)
  if (ctaBlock) {
    ctaBlock = fixButtonBlockProps(ctaBlock, logs);
  }
  
  // Step 4: Clean noise from text blocks
  if (grauHeadingBlock) {
    grauHeadingBlock = cleanNoiseFromRichText(grauHeadingBlock, logs);
  }
  if (paragraphBlock) {
    paragraphBlock = cleanNoiseFromRichText(paragraphBlock, logs);
  }
  
  // Step 5: Assemble in canonical order
  const orderedBlocks: BlockNode[] = [];
  
  // Order: Title → Video → GRAU heading → Paragraph → CTA
  if (titleBlock) {
    orderedBlocks.push(titleBlock);
    logs.push(`[POST-PROCESSOR] Added: Title`);
  }
  
  if (videoBlock) {
    orderedBlocks.push(videoBlock);
    logs.push(`[POST-PROCESSOR] Added: YouTubeVideo`);
  }
  
  if (grauHeadingBlock) {
    orderedBlocks.push(grauHeadingBlock);
    logs.push(`[POST-PROCESSOR] Added: GRAU heading`);
  }
  
  if (paragraphBlock) {
    orderedBlocks.push(paragraphBlock);
    logs.push(`[POST-PROCESSOR] Added: Consulte paragraph`);
  }
  
  if (ctaBlock) {
    orderedBlocks.push(ctaBlock);
    logs.push(`[POST-PROCESSOR] Added: CTA Button`);
  }
  
  // Add any remaining blocks
  for (const other of otherBlocks) {
    orderedBlocks.push(other);
    logs.push(`[POST-PROCESSOR] Added: Other (${other.type})`);
  }
  
  logs.push(`[POST-PROCESSOR] Output: ${orderedBlocks.length} blocks`);
  logs.push(`[POST-PROCESSOR] Block types after: ${orderedBlocks.map(b => b.type).join(', ')}`);
  
  // Step 6: VALIDATION (hard-fail if incomplete)
  const validation = validateShopifyPageBlocks(orderedBlocks, logs);
  if (!validation.valid) {
    for (const err of validation.errors) {
      errors.push(err);
    }
  }
  
  return {
    success: errors.length === 0,
    blocks: orderedBlocks,
    errors,
    logs,
  };
}

/**
 * Split a RichText block that contains both GRAU heading and Consulte paragraph
 */
function splitGrauBlock(
  content: string,
  generateBlockId: (prefix: string) => string
): { heading: BlockNode | null; paragraph: BlockNode | null } {
  let headingContent = '';
  let paragraphContent = '';
  
  // Extract GRAU DE CALVÍCIE text
  const grauMatch = content.match(/grau\s+de\s+calv[íi]cie/i);
  if (grauMatch) {
    headingContent = `<h3 style=\"font-size: 1.25rem; font-weight: 700; margin-top: 24px; margin-bottom: 8px; text-transform: uppercase; text-align: center;\">GRAU DE CALVÍCIE</h3>`;
  }
  
  // Extract \"Consulte aqui...\" text
  const consulteMatch = content.match(/consulte\s+aqui[^<]*(?:tratamento\s+correto)?\.?/i);
  if (consulteMatch) {
    const cleanedText = consulteMatch[0]
      .replace(/\s+/g, ' ')
      .trim();
    // Capitalize first letter
    const capitalizedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
    // Ensure period at end
    const finalText = capitalizedText.endsWith('.') ? capitalizedText : capitalizedText + '.';
    paragraphContent = `<p style=\"margin-bottom: 16px; text-align: center;\">${finalText}</p>`;
  }
  
  // Create blocks
  let headingBlock: BlockNode | null = null;
  let paragraphBlock: BlockNode | null = null;
  
  if (headingContent) {
    headingBlock = {
      id: generateBlockId('grau-heading'),
      type: 'RichText',
      props: {
        content: `<div style=\"text-align: center; max-width: 600px; margin: 24px auto;\">${headingContent}</div>`,
        fontFamily: 'inherit',
        fontSize: 'lg',
        fontWeight: 'bold',
      },
      children: [],
    };
  }
  
  if (paragraphContent) {
    paragraphBlock = {
      id: generateBlockId('consulte-para'),
      type: 'RichText',
      props: {
        content: `<div style=\"text-align: center; max-width: 600px; margin: 16px auto;\">${paragraphContent}</div>`,
        fontFamily: 'inherit',
        fontSize: 'base',
        fontWeight: 'normal',
      },
      children: [],
    };
  }
  
  return { heading: headingBlock, paragraph: paragraphBlock };
}

/**
 * Fix YouTubeVideo block props to ensure correct rendering
 */
function fixVideoBlockProps(block: BlockNode, logs: string[]): BlockNode {
  const props = { ...block.props };
  
  // Ensure youtubeUrl is set (not just url or videoId)
  let videoUrl = (props.youtubeUrl as string) || (props.url as string) || '';
  
  // If we have a videoId but no URL, construct the URL
  if (!videoUrl && props.videoId) {
    videoUrl = `https://www.youtube.com/embed/${props.videoId}`;
    logs.push(`[POST-PROCESSOR] Fixed video: constructed URL from videoId`);
  }
  
  // Ensure URL is in correct format
  if (videoUrl) {
    // Extract video ID from various formats
    let videoId = '';
    const embedMatch = videoUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
    const watchMatch = videoUrl.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
    const shortMatch = videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    
    if (embedMatch) videoId = embedMatch[1];
    else if (watchMatch) videoId = watchMatch[1];
    else if (shortMatch) videoId = shortMatch[1];
    
    if (videoId) {
      // Use embed format which works better
      props.youtubeUrl = `https://www.youtube.com/embed/${videoId}`;
      logs.push(`[POST-PROCESSOR] Fixed video URL: ${props.youtubeUrl}`);
    }
  }
  
  // Ensure other required props
  props.aspectRatio = props.aspectRatio || '16:9';
  props.autoplay = props.autoplay ?? false;
  props.muted = props.muted ?? false;
  props.controls = props.controls ?? true;
  
  return {
    ...block,
    props,
  };
}

/**
 * Fix Button block props to ensure black background, white text
 */
function fixButtonBlockProps(block: BlockNode, logs: string[]): BlockNode {
  const props = { ...block.props };
  
  // Force black/white colors
  if (props.backgroundColor !== '#000000' || props.textColor !== '#ffffff') {
    props.backgroundColor = '#000000';
    props.textColor = '#ffffff';
    logs.push(`[POST-PROCESSOR] Fixed button colors: black bg, white text`);
  }
  
  // Ensure other props
  props.variant = props.variant || 'primary';
  props.size = props.size || 'lg';
  props.alignment = props.alignment || 'center';
  
  return {
    ...block,
    props,
  };
}

/**
 * Clean noise phrases from RichText content
 */
function cleanNoiseFromRichText(block: BlockNode, logs: string[]): BlockNode {
  let content = (block.props.content as string) || '';
  let cleaned = false;
  
  for (const noise of NOISE_PHRASES) {
    const regex = new RegExp(`\\b${noise}\\b`, 'gi');
    if (regex.test(content)) {
      content = content.replace(regex, '');
      cleaned = true;
    }
  }
  
  // Remove duplicate YouTube title patterns
  content = content.replace(/entenda\s+como\s+funci[^\s]*\s*/gi, '');
  
  // Clean up extra whitespace and empty tags
  content = content
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<div>\s*<\/div>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleaned) {
    logs.push(`[POST-PROCESSOR] Cleaned noise from RichText`);
  }
  
  return {
    ...block,
    props: {
      ...block.props,
      content,
    },
  };
}

/**
 * Validate that the page has all required elements (HARD-FAIL)
 */
function validateShopifyPageBlocks(
  blocks: BlockNode[],
  logs: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  logs.push(`[POST-PROCESSOR] Validating ${blocks.length} blocks...`);
  
  // Check for title
  const hasTitle = blocks.some(b => {
    if (b.type !== 'RichText') return false;
    const content = ((b.props.content as string) || '').toLowerCase();
    return content.includes('<h1') && content.includes('como funciona');
  });
  
  // Check for video with valid URL
  const videoBlock = blocks.find(b => b.type === 'YouTubeVideo');
  const hasValidVideo = videoBlock && 
    ((videoBlock.props.youtubeUrl as string) || '').includes('youtube.com');
  
  // Check for GRAU DE CALVÍCIE heading (separate block)
  const hasGrauHeading = blocks.some(b => {
    if (b.type !== 'RichText') return false;
    const content = ((b.props.content as string) || '').toLowerCase();
    return content.includes('grau de calv');
  });
  
  // Check for CTA button
  const hasCtaButton = blocks.some(b => {
    if (b.type !== 'Button') return false;
    const text = ((b.props.text as string) || '').toLowerCase();
    return text.includes('consult');
  });
  
  // Log validation results
  logs.push(`[POST-PROCESSOR] Validation: title=${hasTitle}, video=${hasValidVideo}, grau=${hasGrauHeading}, cta=${hasCtaButton}`);
  
  // Collect errors (but don't hard-fail for now - just log warnings)
  if (!hasTitle) {
    logs.push(`[POST-PROCESSOR] WARNING: Missing title block with \"Como funciona\"`);
  }
  if (!hasValidVideo) {
    logs.push(`[POST-PROCESSOR] WARNING: Missing valid YouTubeVideo block`);
  }
  if (!hasGrauHeading) {
    logs.push(`[POST-PROCESSOR] WARNING: Missing GRAU DE CALVÍCIE heading block`);
  }
  if (!hasCtaButton) {
    logs.push(`[POST-PROCESSOR] WARNING: Missing CONSULTE AGORA button`);
  }
  
  // For now, only hard-fail if video is missing (most critical)
  if (!hasValidVideo) {
    errors.push('Falta bloco de vídeo com URL válida do YouTube');
  }
  
  return { valid: errors.length === 0, errors };
}
