// =============================================
// AI BLOCK FILL v1.0.0 — Preenchimento estruturado de blocos do builder por IA
// Fase 2.2: Backend-only, sem UI/hook
// Recebe blockType + fillableSchema + currentProps → retorna conteúdo textual gerado
// =============================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allowed HTML tags for richtext fields
const ALLOWED_HTML_TAGS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'br', 'span'];

// =============================================
// Types
// =============================================

interface FillableField {
  hint: string;
  format?: 'text' | 'html' | 'cta' | 'label' | 'feedback';
  minItems?: number;
  maxItems?: number;
  itemSchema?: Record<string, { hint: string; enabled: boolean }>;
}

interface RequestPayload {
  tenantId: string;
  blockType: string;
  currentProps: Record<string, unknown>;
  fillableSchema: Record<string, FillableField>;
  pageContext?: {
    pageName?: string;
    pageType?: string;
    pageDescription?: string;
  };
}

// =============================================
// Helpers
// =============================================

function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Build regex that strips any tag not in the allowlist
  const tagPattern = ALLOWED_HTML_TAGS.join('|');
  // Remove all tags except allowed ones
  let result = html.replace(new RegExp(`<(?!\/?(?:${tagPattern})\\b)[^>]*>`, 'gi'), '');
  // Remove inline event handlers
  result = result.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '');
  result = result.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '');
  // Remove style attributes
  result = result.replace(/\s*style\s*=\s*"[^"]*"/gi, '');
  result = result.replace(/\s*style\s*=\s*'[^']*'/gi, '');
  // Remove class attributes
  result = result.replace(/\s*class\s*=\s*"[^"]*"/gi, '');
  result = result.replace(/\s*class\s*=\s*'[^']*'/gi, '');
  return result.trim();
}

/**
 * Validate fillableSchema keys against currentProps keys.
 * Only keys that exist in currentProps are accepted.
 */
function validateAndFilterSchema(
  fillableSchema: Record<string, FillableField>,
  currentProps: Record<string, unknown>
): Record<string, FillableField> {
  const validKeys = new Set(Object.keys(currentProps));
  const filtered: Record<string, FillableField> = {};

  for (const [key, config] of Object.entries(fillableSchema)) {
    if (validKeys.has(key)) {
      filtered[key] = config;
    }
  }

  return filtered;
}

/**
 * Build a JSON Schema tool parameter from the validated fillableSchema.
 */
function buildToolSchema(schema: Record<string, FillableField>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, config] of Object.entries(schema)) {
    if (config.minItems !== undefined || config.maxItems !== undefined) {
      // Array field
      const itemProps: Record<string, unknown> = {};
      const itemRequired: string[] = [];

      if (config.itemSchema) {
        for (const [subKey, sub] of Object.entries(config.itemSchema)) {
          if (sub.enabled) {
            itemProps[subKey] = { type: 'string', description: sub.hint };
            itemRequired.push(subKey);
          }
        }
      }

      properties[key] = {
        type: 'array',
        description: config.hint,
        items: Object.keys(itemProps).length > 0
          ? { type: 'object', properties: itemProps, required: itemRequired }
          : { type: 'string' },
        minItems: config.minItems ?? 1,
        maxItems: config.maxItems ?? 6,
      };
    } else {
      // Scalar string field
      properties[key] = {
        type: 'string',
        description: config.hint,
      };
    }
    required.push(key);
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Validate and sanitize the AI output against the fillableSchema.
 */
function validateOutput(
  output: Record<string, unknown>,
  schema: Record<string, FillableField>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, config] of Object.entries(schema)) {
    const value = output[key];
    if (value === undefined || value === null) continue;

    if (config.minItems !== undefined || config.maxItems !== undefined) {
      // Array field — validate it's actually an array
      if (!Array.isArray(value)) continue;

      const maxItems = config.maxItems ?? 6;
      const truncated = value.slice(0, maxItems);

      // If itemSchema, sanitize sub-fields
      if (config.itemSchema) {
        const enabledKeys = new Set(
          Object.entries(config.itemSchema)
            .filter(([, sub]) => sub.enabled)
            .map(([k]) => k)
        );

        result[key] = truncated.map((item: unknown) => {
          if (typeof item !== 'object' || item === null) return item;
          const sanitizedItem: Record<string, unknown> = {};
          for (const [subKey, subValue] of Object.entries(item as Record<string, unknown>)) {
            if (!enabledKeys.has(subKey)) continue;
            // Find if any sub-field's parent format is html
            sanitizedItem[subKey] = typeof subValue === 'string' ? subValue : String(subValue ?? '');
          }
          return sanitizedItem;
        });
      } else {
        result[key] = truncated;
      }
    } else {
      // Scalar — ensure it's a string
      if (typeof value !== 'string') continue;

      // Sanitize HTML fields
      if (config.format === 'html') {
        result[key] = sanitizeHtml(value);
      } else {
        // Plain text — strip any HTML
        result[key] = value.replace(/<[^>]*>/g, '').trim();
      }
    }
  }

  return result;
}

/**
 * Build the system prompt for content generation.
 */
function buildSystemPrompt(
  blockType: string,
  storeContext: { store_name?: string; store_description?: string; seo_title?: string; seo_description?: string } | null,
  pageContext?: RequestPayload['pageContext']
): string {
  const storeName = storeContext?.store_name || 'a loja';
  const storeDesc = storeContext?.store_description || storeContext?.seo_description || '';

  let contextSection = `Você está gerando conteúdo para o bloco "${blockType}" da loja "${storeName}".`;
  if (storeDesc) {
    contextSection += `\nDescrição da loja: ${storeDesc}`;
  }
  if (pageContext?.pageName) {
    contextSection += `\nPágina: ${pageContext.pageName}`;
  }
  if (pageContext?.pageType) {
    contextSection += `\nTipo da página: ${pageContext.pageType}`;
  }
  if (pageContext?.pageDescription) {
    contextSection += `\nDescrição da página: ${pageContext.pageDescription}`;
  }

  return `${contextSection}

## REGRAS OBRIGATÓRIAS

1. Gere conteúdo EXCLUSIVAMENTE em PT-BR (Português do Brasil).
2. O conteúdo deve ser específico para "${storeName}" — NÃO use textos genéricos como "Lorem ipsum" ou "Empresa XYZ".
3. Para campos com format "html", retorne APENAS estas tags: <p>, <strong>, <em>, <ul>, <ol>, <li>, <h2>, <h3>, <br>. Nenhum script, style, class ou atributo inline.
4. Para campos de texto simples (sem format "html"), retorne texto puro sem HTML.
5. Para arrays, respeite os limites minItems e maxItems definidos no schema.
6. NÃO invente URLs, emails, telefones ou dados de contato. Use placeholders descritivos se necessário.
7. NÃO gere conteúdo repetitivo — cada item de array deve ser único e variado.
8. Use tom profissional e persuasivo adequado para e-commerce.
9. Preencha TODOS os campos solicitados na tool call — não omita nenhum.

## INSTRUÇÕES POR FORMATO
- "text": texto curto e direto (títulos, labels, CTAs)
- "html": HTML semântico com parágrafos, listas e destaques
- "cta": texto de botão, curto e orientado à ação (2-5 palavras)
- "label": rótulo curto e descritivo (1-3 palavras)
- "feedback": texto de feedback/resposta para o usuário`;
}

// =============================================
// Main Handler
// =============================================

Deno.serve(async (req) => {
  console.log(`[ai-block-fill][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth: validate JWT manually ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // ---- Parse and validate payload ----
    const payload: RequestPayload = await req.json();
    const { tenantId, blockType, currentProps, fillableSchema, pageContext } = payload;

    if (!tenantId || !blockType || !currentProps || !fillableSchema) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId, blockType, currentProps e fillableSchema são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof fillableSchema !== 'object' || Object.keys(fillableSchema).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'fillableSchema deve conter pelo menos um campo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Validate tenant access ----
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: hasAccess } = await serviceClient.rpc('user_has_tenant_access', {
      p_tenant_id: tenantId,
    });

    // user_has_tenant_access uses auth.uid() internally, so we need to call it with the user's token
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: accessResult } = await userClient.rpc('user_has_tenant_access', {
      p_tenant_id: tenantId,
    });

    if (!accessResult) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado ao tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Validate fillableSchema against currentProps ----
    const validatedSchema = validateAndFilterSchema(fillableSchema, currentProps);
    if (Object.keys(validatedSchema).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum campo válido no fillableSchema (keys devem existir em currentProps)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-block-fill][${VERSION}] Block: ${blockType}, Fields: ${Object.keys(validatedSchema).join(', ')}, Tenant: ${tenantId}`);

    // ---- Fetch store context ----
    const { data: storeSettings } = await serviceClient
      .from('store_settings')
      .select('store_name, store_description, seo_title, seo_description')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // ---- Build AI request ----
    const systemPrompt = buildSystemPrompt(blockType, storeSettings, pageContext);
    const toolSchema = buildToolSchema(validatedSchema);

    const userPrompt = `Gere o conteúdo para o bloco "${blockType}" usando a tool "fill_block_content". Preencha todos os campos conforme as instruções de cada um.`;

    resetAIRouterCache();

    const { data: aiResponse, provider, model } = await aiChatCompletionJSON(
      "google/gemini-3-flash-preview",
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fill_block_content",
              description: `Preenche o conteúdo textual do bloco ${blockType}. Cada campo tem uma instrução específica no description.`,
              parameters: toolSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fill_block_content" } },
        temperature: 0.7,
      },
      {
        supabaseUrl: SUPABASE_URL,
        supabaseServiceKey: SUPABASE_SERVICE_KEY,
        logPrefix: `[ai-block-fill][${VERSION}]`,
      }
    );

    // ---- Extract tool call result ----
    const toolCalls = aiResponse?.choices?.[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      console.error(`[ai-block-fill][${VERSION}] No tool call in AI response`);
      return new Response(
        JSON.stringify({ success: false, error: 'A IA não retornou conteúdo estruturado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rawOutput: Record<string, unknown>;
    try {
      const args = toolCalls[0].function?.arguments;
      rawOutput = typeof args === 'string' ? JSON.parse(args) : args;
    } catch (parseErr) {
      console.error(`[ai-block-fill][${VERSION}] Failed to parse tool call arguments:`, parseErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao processar resposta da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Validate and sanitize output ----
    const filledProps = validateOutput(rawOutput, validatedSchema);

    console.log(`[ai-block-fill][${VERSION}] ✅ Generated ${Object.keys(filledProps).length} props via ${provider} (${model})`);

    return new Response(
      JSON.stringify({ success: true, filledProps }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error(`[ai-block-fill][${VERSION}] Error:`, err);
    const message = err instanceof Error ? err.message : 'Erro interno';

    // Surface rate limit / payment errors
    if (message.includes('429')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (message.includes('402')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Créditos de IA insuficientes.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
