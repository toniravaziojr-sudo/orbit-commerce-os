// =============================================
// AI ROUTER v1.0.0 — Roteamento Inteligente de IA
// Prioridade: Gemini Nativa → OpenAI Nativa → Lovable Gateway (fallback)
// =============================================

import { getCredential } from "./platform-credentials.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_OPENAI_COMPAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AIProvider = 'openai' | 'gemini' | 'lovable';

export interface AIEndpoint {
  url: string;
  apiKey: string;
  model: string;
  provider: AIProvider;
}

// Mapeamento de modelos Lovable Gateway → Gemini nativo (OpenAI-compat endpoint)
const GEMINI_NATIVE_MODELS: Record<string, string> = {
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash",
  "google/gemini-2.5-pro": "gemini-2.5-pro",
  "google/gemini-3-flash-preview": "gemini-2.5-flash",
  "google/gemini-3-pro-preview": "gemini-2.5-pro",
  "google/gemini-2.5-flash-image": "gemini-2.0-flash-exp",
  "google/gemini-3-pro-image-preview": "gemini-2.0-flash-exp",
  // OpenAI models → closest Gemini
  "openai/gpt-5": "gemini-2.5-pro",
  "openai/gpt-5-mini": "gemini-2.5-flash",
  "openai/gpt-5-nano": "gemini-2.5-flash",
  "openai/gpt-5.2": "gemini-2.5-pro",
};

// Mapeamento de modelos Lovable Gateway → OpenAI nativo
const OPENAI_NATIVE_MODELS: Record<string, string> = {
  "openai/gpt-5": "gpt-4o",
  "openai/gpt-5-mini": "gpt-4o-mini",
  "openai/gpt-5-nano": "gpt-4o-mini",
  "openai/gpt-5.2": "gpt-4o",
  // Gemini models → closest OpenAI
  "google/gemini-2.5-flash": "gpt-4o-mini",
  "google/gemini-2.5-flash-lite": "gpt-4o-mini",
  "google/gemini-2.5-pro": "gpt-4o",
  "google/gemini-3-flash-preview": "gpt-4o-mini",
  "google/gemini-3-pro-preview": "gpt-4o",
};

// Cache de chaves por request (evita múltiplas consultas ao DB)
let _cachedKeys: { openai: string | null; gemini: string | null; lovable: string | null } | null = null;

/**
 * Reseta o cache de chaves. Chamar no início de cada request.
 */
export function resetAIRouterCache() {
  _cachedKeys = null;
}

/**
 * Resolve as chaves de API disponíveis (DB → env var fallback).
 */
async function resolveAPIKeys(supabaseUrl?: string, supabaseServiceKey?: string): Promise<{
  openai: string | null;
  gemini: string | null;
  lovable: string | null;
}> {
  if (_cachedKeys) return _cachedKeys;

  let openaiKey: string | null = null;
  let geminiKey: string | null = null;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || null;

  if (supabaseUrl && supabaseServiceKey) {
    // Buscar do banco (platform_credentials) com fallback para env
    [openaiKey, geminiKey] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "OPENAI_API_KEY"),
      getCredential(supabaseUrl, supabaseServiceKey, "GEMINI_API_KEY"),
    ]);
  } else {
    openaiKey = Deno.env.get("OPENAI_API_KEY") || null;
    geminiKey = Deno.env.get("GEMINI_API_KEY") || null;
  }

  _cachedKeys = { openai: openaiKey, gemini: geminiKey, lovable: lovableKey };
  return _cachedKeys;
}

/**
 * Retorna o melhor endpoint de IA disponível para o modelo solicitado.
 */
export async function getAIEndpoint(
  requestedModel: string,
  options?: {
    supabaseUrl?: string;
    supabaseServiceKey?: string;
    preferProvider?: AIProvider | 'auto';
  }
): Promise<AIEndpoint> {
  const { supabaseUrl, supabaseServiceKey, preferProvider = 'auto' } = options || {};
  const keys = await resolveAPIKeys(supabaseUrl, supabaseServiceKey);

  const isOpenAIModel = requestedModel.startsWith("openai/");

  // Determinar ordem de prioridade
  let providerOrder: AIProvider[];
  if (preferProvider === 'openai') {
    providerOrder = ['openai', 'gemini', 'lovable'];
  } else if (preferProvider === 'gemini') {
    providerOrder = ['gemini', 'openai', 'lovable'];
  } else if (preferProvider === 'lovable') {
    providerOrder = ['lovable', 'gemini', 'openai'];
  } else {
    // Auto: Gemini native first (cheaper/faster), then OpenAI, then Lovable
    providerOrder = isOpenAIModel
      ? ['openai', 'gemini', 'lovable']
      : ['gemini', 'openai', 'lovable'];
  }

  for (const provider of providerOrder) {
    if (provider === 'gemini' && keys.gemini) {
      return {
        url: GEMINI_OPENAI_COMPAT_URL,
        apiKey: keys.gemini,
        model: GEMINI_NATIVE_MODELS[requestedModel] || "gemini-2.5-flash",
        provider: 'gemini',
      };
    }
    if (provider === 'openai' && keys.openai) {
      return {
        url: OPENAI_API_URL,
        apiKey: keys.openai,
        model: OPENAI_NATIVE_MODELS[requestedModel] || "gpt-4o-mini",
        provider: 'openai',
      };
    }
    if (provider === 'lovable' && keys.lovable) {
      return {
        url: LOVABLE_GATEWAY_URL,
        apiKey: keys.lovable,
        model: requestedModel,
        provider: 'lovable',
      };
    }
  }

  throw new Error("Nenhuma chave de IA configurada (GEMINI_API_KEY, OPENAI_API_KEY ou LOVABLE_API_KEY)");
}

/**
 * Faz uma chamada de chat completion com roteamento automático e fallback.
 * Tenta cada provedor disponível na ordem de prioridade.
 * Retorna o Response bruto (suporta streaming).
 */
export async function aiChatCompletion(
  requestedModel: string,
  body: Record<string, unknown>,
  options?: {
    supabaseUrl?: string;
    supabaseServiceKey?: string;
    preferProvider?: AIProvider | 'auto';
    logPrefix?: string;
    // Se true, não faz fallback (útil para modelos específicos)
    noFallback?: boolean;
  }
): Promise<Response> {
  const {
    supabaseUrl,
    supabaseServiceKey,
    preferProvider = 'auto',
    logPrefix = '[ai-router]',
    noFallback = false,
  } = options || {};

  const keys = await resolveAPIKeys(supabaseUrl, supabaseServiceKey);
  const isOpenAIModel = requestedModel.startsWith("openai/");

  // Determinar ordem de prioridade
  let providerOrder: AIProvider[];
  if (preferProvider === 'openai') {
    providerOrder = ['openai', 'gemini', 'lovable'];
  } else if (preferProvider === 'gemini') {
    providerOrder = ['gemini', 'openai', 'lovable'];
  } else if (preferProvider === 'lovable') {
    providerOrder = ['lovable'];
  } else {
    providerOrder = isOpenAIModel
      ? ['openai', 'gemini', 'lovable']
      : ['gemini', 'openai', 'lovable'];
  }

  // Filtrar para provedores com chave disponível
  const available = providerOrder.filter(p => {
    if (p === 'openai') return !!keys.openai;
    if (p === 'gemini') return !!keys.gemini;
    if (p === 'lovable') return !!keys.lovable;
    return false;
  });

  if (available.length === 0) {
    throw new Error("Nenhuma chave de IA configurada");
  }

  // Se noFallback, usar apenas o primeiro disponível
  const providersToTry = noFallback ? [available[0]] : available;
  let lastError = '';

  for (const provider of providersToTry) {
    try {
      let url: string;
      let apiKey: string;
      let model: string;

      if (provider === 'gemini') {
        url = GEMINI_OPENAI_COMPAT_URL;
        apiKey = keys.gemini!;
        model = GEMINI_NATIVE_MODELS[requestedModel] || "gemini-2.5-flash";
      } else if (provider === 'openai') {
        url = OPENAI_API_URL;
        apiKey = keys.openai!;
        model = OPENAI_NATIVE_MODELS[requestedModel] || "gpt-4o-mini";
      } else {
        url = LOVABLE_GATEWAY_URL;
        apiKey = keys.lovable!;
        model = requestedModel;
      }

      // Construir body com modelo correto
      const requestBody = { ...body, model };

      // Ajustar parâmetros OpenAI-específicos
      if (provider === 'openai') {
        // gpt-4o uses max_tokens, not max_completion_tokens
        // Remove max_completion_tokens if present for non-gpt-5 models
        if (requestBody.max_completion_tokens && !model.includes('gpt-5')) {
          requestBody.max_tokens = requestBody.max_completion_tokens;
          delete requestBody.max_completion_tokens;
        }
      }

      console.log(`${logPrefix} Trying ${provider} (${model})...`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        console.log(`${logPrefix} ✅ ${provider} (${model}) succeeded`);
        return response;
      }

      // Rate limit ou pagamento → tentar próximo provedor
      if (response.status === 429 || response.status === 402) {
        lastError = `${provider} (${model}): HTTP ${response.status}`;
        console.warn(`${logPrefix} ⚠️ ${provider} returned ${response.status}, trying next...`);
        await response.text(); // consume body
        continue;
      }

      // Outros erros → tentar próximo
      const errorText = await response.text();
      lastError = `${provider} (${model}): ${response.status} - ${errorText.substring(0, 200)}`;
      console.warn(`${logPrefix} ⚠️ ${provider} error: ${response.status}`, errorText.substring(0, 200));
      continue;

    } catch (err) {
      lastError = `${provider}: ${String(err)}`;
      console.warn(`${logPrefix} ⚠️ ${provider} exception:`, err);
      continue;
    }
  }

  // Todos falharam — retornar erro como Response (para não quebrar streaming consumers)
  console.error(`${logPrefix} ❌ All providers failed. Last error: ${lastError}`);
  return new Response(
    JSON.stringify({ error: `Todos os provedores de IA falharam. ${lastError}` }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Versão simplificada que retorna o JSON parseado (non-streaming).
 */
export async function aiChatCompletionJSON(
  requestedModel: string,
  body: Record<string, unknown>,
  options?: {
    supabaseUrl?: string;
    supabaseServiceKey?: string;
    preferProvider?: AIProvider | 'auto';
    logPrefix?: string;
  }
): Promise<{ data: any; provider: AIProvider; model: string }> {
  // Force stream: false
  const requestBody = { ...body, stream: false };

  const response = await aiChatCompletion(requestedModel, requestBody, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Detectar qual provider foi usado (baseado no response headers ou inferência)
  // Como não temos header específico, inferimos da última tentativa bem-sucedida
  const keys = await resolveAPIKeys(options?.supabaseUrl, options?.supabaseServiceKey);
  let usedProvider: AIProvider = 'lovable';
  let usedModel = requestedModel;

  // Heurística: checar o model no response
  const responseModel = data?.model || '';
  if (responseModel.startsWith('gpt-') || responseModel.startsWith('chatgpt-')) {
    usedProvider = 'openai';
    usedModel = responseModel;
  } else if (responseModel.startsWith('gemini-')) {
    usedProvider = 'gemini';
    usedModel = responseModel;
  }

  return { data, provider: usedProvider, model: usedModel };
}
