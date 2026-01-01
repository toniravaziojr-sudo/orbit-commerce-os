// =====================================================
// BLOCK BUILDER v1
// =====================================================
// Builds BlockNode structures from classified elements
// Maintains original page order
// Handles automatic block creation requests
// =====================================================

import type { ClassifiedElement } from './element-classifier.ts';

interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: BlockNode[];
}

// Generate unique ID
function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =====================================================
// BUILD BLOCK FROM CLASSIFICATION
// =====================================================
export function buildBlockFromClassification(element: ClassifiedElement): BlockNode {
  return {
    id: generateBlockId(element.blockType.toLowerCase()),
    type: element.blockType,
    props: element.blockProps,
    children: [],
  };
}

// =====================================================
// BUILD PAGE FROM ELEMENTS
// =====================================================
export function buildPageFromElements(
  elements: ClassifiedElement[],
  pageTitle: string,
  options?: {
    extractedCss?: string;
    sourceUrl?: string;
  }
): BlockNode {
  console.log(`[BUILD] Building page "${pageTitle}" from ${elements.length} elements`);
  
  // Sort by position to maintain original order
  const sorted = [...elements].sort((a, b) => a.position - b.position);
  
  // Build blocks
  const blocks: BlockNode[] = [];
  
  for (const element of sorted) {
    const block = buildBlockFromClassification(element);
    
    // Add CSS to CustomBlocks if available
    if (block.type === 'CustomBlock' && options?.extractedCss) {
      block.props.cssContent = options.extractedCss;
      if (options?.sourceUrl) {
        block.props.baseUrl = options.sourceUrl;
      }
    }
    
    blocks.push(block);
    console.log(`[BUILD] Created ${block.type} block from ${element.type}`);
  }
  
  // If no blocks created, add fallback
  if (blocks.length === 0) {
    console.log(`[BUILD] No blocks created, adding fallback RichText`);
    blocks.push({
      id: generateBlockId('richtext'),
      type: 'RichText',
      props: {
        content: '<p>Conteúdo da página...</p>',
        fontFamily: 'inherit',
        fontSize: 'base',
        fontWeight: 'normal',
      },
      children: [],
    });
  }
  
  // Wrap in page structure
  const page: BlockNode = {
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
        children: blocks,
      },
    ],
  };
  
  console.log(`[BUILD] Page created with ${blocks.length} blocks: ${blocks.map(b => b.type).join(', ')}`);
  
  return page;
}

// =====================================================
// CREATE BLOCK IMPLEMENTATION REQUEST
// =====================================================
export interface BlockImplementationRequest {
  tenantId: string;
  patternName: string;
  patternDescription?: string;
  htmlSample: string;
  cssSample?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  suggestedProps?: Record<string, unknown>;
  occurrencesCount?: number;
}

export async function createBlockImplementationRequest(
  supabase: any,
  request: BlockImplementationRequest
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    console.log(`[BLOCK-REQUEST] Creating implementation request for: ${request.patternName}`);
    
    // Check if similar pattern already exists
    const { data: existing, error: checkError } = await supabase
      .from('block_implementation_requests')
      .select('id, occurrences_count')
      .eq('tenant_id', request.tenantId)
      .eq('pattern_name', request.patternName)
      .eq('status', 'pending')
      .maybeSingle();
    
    if (checkError) {
      console.error(`[BLOCK-REQUEST] Check error:`, checkError);
    }
    
    if (existing) {
      // Increment occurrences count
      const { error: updateError } = await supabase
        .from('block_implementation_requests')
        .update({ 
          occurrences_count: (existing.occurrences_count || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      
      if (updateError) {
        console.error(`[BLOCK-REQUEST] Update error:`, updateError);
        return { success: false, error: updateError.message };
      }
      
      console.log(`[BLOCK-REQUEST] Updated existing request: ${existing.id} (count: ${(existing.occurrences_count || 1) + 1})`);
      return { success: true, requestId: existing.id };
    }
    
    // Create new request
    const { data: newRequest, error: insertError } = await supabase
      .from('block_implementation_requests')
      .insert({
        tenant_id: request.tenantId,
        pattern_name: request.patternName,
        pattern_description: request.patternDescription || `Padrão detectado: ${request.patternName}`,
        html_sample: request.htmlSample.substring(0, 10000), // Limit size
        css_sample: request.cssSample?.substring(0, 5000),
        source_url: request.sourceUrl,
        source_platform: request.sourcePlatform || 'import',
        suggested_props: request.suggestedProps,
        occurrences_count: request.occurrencesCount || 1,
        status: 'pending',
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error(`[BLOCK-REQUEST] Insert error:`, insertError);
      return { success: false, error: insertError.message };
    }
    
    console.log(`[BLOCK-REQUEST] Created new request: ${newRequest.id}`);
    return { success: true, requestId: newRequest.id };
    
  } catch (error) {
    console.error(`[BLOCK-REQUEST] Exception:`, error);
    return { success: false, error: String(error) };
  }
}

// =====================================================
// PROCESS ELEMENTS WITH AUTO BLOCK CREATION
// =====================================================
export async function processElementsWithAutoBlockCreation(
  supabase: any,
  tenantId: string,
  elements: ClassifiedElement[],
  options?: {
    extractedCss?: string;
    sourceUrl?: string;
    sourcePlatform?: string;
  }
): Promise<{
  page: BlockNode;
  newBlockRequests: string[];
}> {
  const newBlockRequests: string[] = [];
  
  // Process elements that need new blocks
  for (const element of elements) {
    if (element.needsNewBlock && element.suggestedBlockName) {
      const requestResult = await createBlockImplementationRequest(supabase, {
        tenantId,
        patternName: element.suggestedBlockName,
        patternDescription: `Padrão detectado durante importação: ${element.suggestedBlockName} (confiança: ${(element.confidence * 100).toFixed(0)}%)`,
        htmlSample: element.rawHtml,
        cssSample: options?.extractedCss,
        sourceUrl: options?.sourceUrl,
        sourcePlatform: options?.sourcePlatform,
        suggestedProps: element.blockProps,
      });
      
      if (requestResult.success && requestResult.requestId) {
        newBlockRequests.push(requestResult.requestId);
      }
    }
  }
  
  // Build the page
  const page = buildPageFromElements(elements, '', options);
  
  return {
    page,
    newBlockRequests,
  };
}

// =====================================================
// MERGE CONSECUTIVE ELEMENTS OF SAME TYPE
// =====================================================
export function mergeConsecutiveElements(elements: ClassifiedElement[]): ClassifiedElement[] {
  if (elements.length <= 1) return elements;
  
  const result: ClassifiedElement[] = [];
  let current = elements[0];
  
  for (let i = 1; i < elements.length; i++) {
    const next = elements[i];
    
    // Merge consecutive RichText blocks
    if (current.blockType === 'RichText' && next.blockType === 'RichText') {
      const currentContent = current.blockProps.content as string || '';
      const nextContent = next.blockProps.content as string || '';
      
      current = {
        ...current,
        rawHtml: current.rawHtml + next.rawHtml,
        blockProps: {
          ...current.blockProps,
          content: currentContent + '\n' + nextContent,
        },
      };
    } else {
      result.push(current);
      current = next;
    }
  }
  
  result.push(current);
  
  if (result.length < elements.length) {
    console.log(`[BUILD] Merged ${elements.length} elements into ${result.length}`);
  }
  
  return result;
}
