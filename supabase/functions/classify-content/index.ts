import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// AI-POWERED CONTENT CLASSIFIER
// ============================================================
// Uses Lovable AI (gemini-2.5-flash) to semantically classify
// HTML sections into appropriate block types and layouts.
// 
// This enables the structural importer to create intelligent
// page layouts similar to manual design work.
// ============================================================

interface ClassificationResult {
  sectionType: 'hero' | 'benefits' | 'features' | 'testimonials' | 'faq' | 'cta' | 'about' | 'contact' | 'generic';
  layout: 'columns-image-left' | 'columns-image-right' | 'grid-2' | 'grid-3' | 'grid-4' | 'stacked' | 'hero-centered' | 'hero-split';
  elements: {
    hasHeading: boolean;
    hasSubheading: boolean;
    hasImage: boolean;
    hasVideo: boolean;
    hasList: boolean;
    hasButton: boolean;
    hasIcons: boolean;
    itemCount: number;
  };
  confidence: number;
  reasoning: string;
}

interface ClassifyRequest {
  html: string;
  pageContext?: {
    title?: string;
    url?: string;
    pageType?: string;
    sectionIndex?: number;
    totalSections?: number;
  };
}

const SYSTEM_PROMPT = `You are an expert web designer and content classifier. Your job is to analyze HTML fragments and classify them into semantic section types with appropriate layouts.

IMPORTANT RULES:
1. You MUST respond with valid JSON matching the specified schema
2. Be conservative - only classify as specific types when confident
3. Consider visual hierarchy and content grouping
4. Layout should match content: images + text = columns, multiple similar items = grid

SECTION TYPES:
- hero: Main banner/introduction with prominent heading, usually first section. Often has background image/video, CTA button
- benefits: List of advantages/benefits with icons or checkmarks. "Why choose us", "Vantagens", "Benefícios"
- features: Product/service features with descriptions. Similar to benefits but more detailed
- testimonials: Customer reviews, quotes, ratings, feedback
- faq: Questions and answers, accordion content
- cta: Call-to-action section with button(s), conversion focused
- about: Company info, "Quem somos", team, history, mission
- contact: Contact information, forms, addresses, WhatsApp links
- generic: Default when content doesn't fit other categories

LAYOUT OPTIONS:
- hero-centered: Hero with centered text, optional background
- hero-split: Hero with image on one side, text on other
- columns-image-left: Two columns, image on left, text on right
- columns-image-right: Two columns, text on left, image on right
- grid-2: 2-column grid for items
- grid-3: 3-column grid for items (common for benefits/features)
- grid-4: 4-column grid for items
- stacked: Vertical stack, default for text-heavy content

CLASSIFICATION TIPS:
- Benefits/Features usually have 3-6 items with icons/emoji/checkmarks
- Hero is usually the first section with large heading
- CTA sections are short with prominent buttons
- Testimonials have quotes, names, ratings
- Consider Portuguese content patterns (common in e-commerce)`;

const CLASSIFICATION_FUNCTION = {
  type: "function",
  function: {
    name: "classify_section",
    description: "Classify an HTML section into a semantic type with layout recommendation",
    parameters: {
      type: "object",
      properties: {
        sectionType: {
          type: "string",
          enum: ["hero", "benefits", "features", "testimonials", "faq", "cta", "about", "contact", "generic"],
          description: "The semantic type of this section"
        },
        layout: {
          type: "string",
          enum: ["columns-image-left", "columns-image-right", "grid-2", "grid-3", "grid-4", "stacked", "hero-centered", "hero-split"],
          description: "Recommended layout for this section"
        },
        elements: {
          type: "object",
          properties: {
            hasHeading: { type: "boolean", description: "Has a main heading (h1-h3)" },
            hasSubheading: { type: "boolean", description: "Has a subtitle or secondary heading" },
            hasImage: { type: "boolean", description: "Contains significant image(s)" },
            hasVideo: { type: "boolean", description: "Contains video (YouTube, Vimeo, mp4)" },
            hasList: { type: "boolean", description: "Has list of items (ul/ol or repeated patterns)" },
            hasButton: { type: "boolean", description: "Has CTA button(s)" },
            hasIcons: { type: "boolean", description: "Has icons or emoji as visual markers" },
            itemCount: { type: "number", description: "Number of similar repeated items (for grids)" }
          },
          required: ["hasHeading", "hasSubheading", "hasImage", "hasVideo", "hasList", "hasButton", "hasIcons", "itemCount"]
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confidence in classification (0-1)"
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of classification reasoning"
        }
      },
      required: ["sectionType", "layout", "elements", "confidence", "reasoning"],
      additionalProperties: false
    }
  }
};

function stripHtmlForAnalysis(html: string): string {
  // Remove scripts, styles, comments
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  
  // Truncate if too long (keep first ~8000 chars)
  if (cleaned.length > 8000) {
    cleaned = cleaned.substring(0, 8000) + '... [truncated]';
  }
  
  return cleaned;
}

function createUserPrompt(html: string, context?: ClassifyRequest['pageContext']): string {
  let prompt = 'Analyze this HTML section and classify it:\n\n';
  
  if (context) {
    if (context.title) prompt += `Page Title: ${context.title}\n`;
    if (context.sectionIndex !== undefined && context.totalSections) {
      prompt += `Section: ${context.sectionIndex + 1} of ${context.totalSections}\n`;
      if (context.sectionIndex === 0) {
        prompt += `(This is the FIRST section - likely hero or main intro)\n`;
      }
    }
    prompt += '\n';
  }
  
  prompt += '```html\n' + html + '\n```\n\n';
  prompt += 'Classify this section using the classify_section function.';
  
  return prompt;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { html, pageContext } = await req.json() as ClassifyRequest;
    
    if (!html || html.length < 50) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'HTML content is required and must be at least 50 characters' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[CLASSIFY] LOVABLE_API_KEY not configured');
      // Return fallback classification
      return new Response(
        JSON.stringify({
          success: true,
          classification: {
            sectionType: 'generic',
            layout: 'stacked',
            elements: {
              hasHeading: html.includes('<h1') || html.includes('<h2'),
              hasSubheading: html.includes('<h3') || html.includes('<h4'),
              hasImage: html.includes('<img'),
              hasVideo: html.includes('youtube') || html.includes('vimeo'),
              hasList: html.includes('<ul') || html.includes('<ol'),
              hasButton: html.includes('button') || html.includes('btn'),
              hasIcons: false,
              itemCount: 0,
            },
            confidence: 0.3,
            reasoning: 'Fallback classification - AI not available',
          },
          fallback: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLASSIFY] Classifying section: ${html.length} chars`);
    
    const cleanedHtml = stripHtmlForAnalysis(html);
    const userPrompt = createUserPrompt(cleanedHtml, pageContext);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [CLASSIFICATION_FUNCTION],
        tool_choice: { type: 'function', function: { name: 'classify_section' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CLASSIFY] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, try again later' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    // Extract function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'classify_section') {
      console.error('[CLASSIFY] Unexpected AI response format:', JSON.stringify(aiResponse));
      throw new Error('AI did not return expected function call');
    }

    let classification: ClassificationResult;
    try {
      classification = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[CLASSIFY] Failed to parse AI response:', toolCall.function.arguments);
      throw new Error('Failed to parse AI classification');
    }

    console.log(`[CLASSIFY] Result: type=${classification.sectionType}, layout=${classification.layout}, confidence=${classification.confidence}`);

    return new Response(
      JSON.stringify({
        success: true,
        classification,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLASSIFY] Error:', error);
    
    // Return fallback on any error
    return new Response(
      JSON.stringify({
        success: true,
        classification: {
          sectionType: 'generic',
          layout: 'stacked',
          elements: {
            hasHeading: false,
            hasSubheading: false,
            hasImage: false,
            hasVideo: false,
            hasList: false,
            hasButton: false,
            hasIcons: false,
            itemCount: 0,
          },
          confidence: 0.1,
          reasoning: `Error classification fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        fallback: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
