// =====================================================
// BLOCK BUILDER v2 - WITH DETAILED LOGGING
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
  console.log(`[FUNC:buildBlockFromClassification] INPUT: ${JSON.stringify({ 
    elementId: element.id, 
    type: element.type, 
    blockType: element.blockType,
    confidence: element.confidence 
  })}`);
  
  const block: BlockNode = {
    id: generateBlockId(element.blockType.toLowerCase()),
    type: element.blockType,
    props: element.blockProps,
    children: [],
  };
  
  console.log(`[FUNC:buildBlockFromClassification] OUTPUT: ${JSON.stringify({ 
    blockId: block.id, 
    blockType: block.type,
    propsKeys: Object.keys(block.props) 
  })}`);
  
  return block;
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
  const startTime = Date.now();
  console.log(`[FUNC:buildPageFromElements] INPUT: ${JSON.stringify({ 
    elementsCount: elements.length, 
    pageTitle,
    hasExtractedCss: !!options?.extractedCss,
    extractedCssLength: options?.extractedCss?.length || 0,
    hasSourceUrl: !!options?.sourceUrl 
  })}`);
  
  // Sort by position to maintain original order
  const sorted = [...elements].sort((a, b) => a.position - b.position);
  console.log(`[FUNC:buildPageFromElements] STEP: Sorted ${sorted.length} elements by position`);
  
  // Build blocks
  const blocks: BlockNode[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const element = sorted[i];
    console.log(`[FUNC:buildPageFromElements] BUILDING[${i}]: ${element.type} -> ${element.blockType}`);
    
    const block = buildBlockFromClassification(element);
    
    // Add CSS to CustomBlocks if available
    if (block.type === 'CustomBlock' && options?.extractedCss) {
      block.props.cssContent = options.extractedCss;
      if (options?.sourceUrl) {
        block.props.baseUrl = options.sourceUrl;
      }
      console.log(`[FUNC:buildPageFromElements] ADDED_CSS: CustomBlock got ${options.extractedCss.length} chars of CSS`);
    }
    
    blocks.push(block);
  }
  
  // If no blocks created, add fallback
  if (blocks.length === 0) {
    console.log(`[FUNC:buildPageFromElements] FALLBACK: No blocks created, adding fallback RichText`);
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
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:buildPageFromElements] OUTPUT: ${JSON.stringify({ 
    blocksCreated: blocks.length, 
    blockTypes: blocks.map(b => b.type),
    pageId: page.id,
    elapsedMs: elapsed 
  })}`);
  
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
  const startTime = Date.now();
  console.log(`[FUNC:createBlockImplementationRequest] INPUT: ${JSON.stringify({ 
    tenantId: request.tenantId, 
    patternName: request.patternName,
    htmlSampleLength: request.htmlSample.length,
    cssSampleLength: request.cssSample?.length || 0,
    sourceUrl: request.sourceUrl 
  })}`);
  
  try {
    // Check if similar pattern already exists
    console.log(`[FUNC:createBlockImplementationRequest] STEP: Checking for existing pattern...`);
    const { data: existing, error: checkError } = await supabase
      .from('block_implementation_requests')
      .select('id, occurrences_count')
      .eq('tenant_id', request.tenantId)
      .eq('pattern_name', request.patternName)
      .eq('status', 'pending')
      .maybeSingle();
    
    if (checkError) {
      console.error(`[FUNC:createBlockImplementationRequest] CHECK_ERROR: ${JSON.stringify(checkError)}`);
    }
    
    if (existing) {
      // Increment occurrences count
      console.log(`[FUNC:createBlockImplementationRequest] STEP: Updating existing request ${existing.id}`);
      const { error: updateError } = await supabase
        .from('block_implementation_requests')
        .update({ 
          occurrences_count: (existing.occurrences_count || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      
      if (updateError) {
        console.error(`[FUNC:createBlockImplementationRequest] UPDATE_ERROR: ${JSON.stringify(updateError)}`);
        return { success: false, error: updateError.message };
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[FUNC:createBlockImplementationRequest] OUTPUT: ${JSON.stringify({ 
        success: true, 
        requestId: existing.id, 
        action: 'updated',
        newCount: (existing.occurrences_count || 1) + 1,
        elapsedMs: elapsed 
      })}`);
      return { success: true, requestId: existing.id };
    }
    
    // Create new request
    console.log(`[FUNC:createBlockImplementationRequest] STEP: Creating new request...`);
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
      console.error(`[FUNC:createBlockImplementationRequest] INSERT_ERROR: ${JSON.stringify(insertError)}`);
      return { success: false, error: insertError.message };
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[FUNC:createBlockImplementationRequest] OUTPUT: ${JSON.stringify({ 
      success: true, 
      requestId: newRequest.id, 
      action: 'created',
      elapsedMs: elapsed 
    })}`);
    return { success: true, requestId: newRequest.id };
    
  } catch (error) {
    console.error(`[FUNC:createBlockImplementationRequest] EXCEPTION: ${JSON.stringify({ error: String(error) })}`);
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
  const startTime = Date.now();
  console.log(`[FUNC:processElementsWithAutoBlockCreation] INPUT: ${JSON.stringify({ 
    tenantId, 
    elementsCount: elements.length,
    hasExtractedCss: !!options?.extractedCss,
    sourceUrl: options?.sourceUrl,
    sourcePlatform: options?.sourcePlatform 
  })}`);
  
  const newBlockRequests: string[] = [];
  
  // Process elements that need new blocks
  const elementsNeedingBlocks = elements.filter(e => e.needsNewBlock && e.suggestedBlockName);
  console.log(`[FUNC:processElementsWithAutoBlockCreation] STEP: ${elementsNeedingBlocks.length} elements need new blocks`);
  
  for (const element of elementsNeedingBlocks) {
    console.log(`[FUNC:processElementsWithAutoBlockCreation] CREATING_REQUEST: ${element.suggestedBlockName}`);
    
    const requestResult = await createBlockImplementationRequest(supabase, {
      tenantId,
      patternName: element.suggestedBlockName!,
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
  
  // Build the page
  console.log(`[FUNC:processElementsWithAutoBlockCreation] STEP: Building page...`);
  const page = buildPageFromElements(elements, '', options);
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:processElementsWithAutoBlockCreation] OUTPUT: ${JSON.stringify({ 
    pageBlocksCount: page.children[0]?.children?.length || 0,
    newBlockRequestsCount: newBlockRequests.length,
    newBlockRequestIds: newBlockRequests,
    elapsedMs: elapsed 
  })}`);
  
  return {
    page,
    newBlockRequests,
  };
}

// =====================================================
// MERGE CONSECUTIVE ELEMENTS OF SAME TYPE
// =====================================================
export function mergeConsecutiveElements(elements: ClassifiedElement[]): ClassifiedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:mergeConsecutiveElements] INPUT: ${JSON.stringify({ elementsCount: elements.length })}`);
  
  if (elements.length <= 1) {
    console.log(`[FUNC:mergeConsecutiveElements] OUTPUT: ${JSON.stringify({ 
      result: 'no_merge_needed', 
      count: elements.length 
    })}`);
    return elements;
  }
  
  const result: ClassifiedElement[] = [];
  let current = elements[0];
  let mergeCount = 0;
  
  for (let i = 1; i < elements.length; i++) {
    const next = elements[i];
    
    // Merge consecutive RichText blocks
    if (current.blockType === 'RichText' && next.blockType === 'RichText') {
      const currentContent = current.blockProps.content as string || '';
      const nextContent = next.blockProps.content as string || '';
      
      console.log(`[FUNC:mergeConsecutiveElements] MERGING: RichText[${i-1}] + RichText[${i}]`);
      
      current = {
        ...current,
        rawHtml: current.rawHtml + next.rawHtml,
        blockProps: {
          ...current.blockProps,
          content: currentContent + '\n' + nextContent,
        },
      };
      mergeCount++;
    } else {
      result.push(current);
      current = next;
    }
  }
  
  result.push(current);
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:mergeConsecutiveElements] OUTPUT: ${JSON.stringify({ 
    beforeCount: elements.length, 
    afterCount: result.length, 
    mergedCount: mergeCount,
    elapsedMs: elapsed 
  })}`);
  
  return result;
}
