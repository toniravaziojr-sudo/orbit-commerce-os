/**
 * Native Gemini Image Generation — Chamada direta à API do Google AI Studio
 * SEM intermédio do Lovable AI Gateway
 * 
 * HIERARQUIA OBRIGATÓRIA (v6.0):
 * 1. Gemini Nativa (este módulo) → usa GEMINI_API_KEY da platform_credentials
 * 2. OpenAI Nativa → usa OPENAI_API_KEY
 * 3. Lovable AI Gateway → último recurso (fallback)
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const NATIVE_GEMINI_MODELS = {
  primary: 'gemini-2.5-flash-image',
  // Fallback model se o primary não estiver disponível
  fallback: 'gemini-2.5-flash-image',
} as const;

/**
 * Gera imagem via API nativa do Google Gemini (Google AI Studio).
 * Não passa pelo Lovable Gateway — chamada direta.
 */
export async function generateWithNativeGemini(
  geminiApiKey: string,
  prompt: string,
  referenceImageBase64: string | null,
  model: string = NATIVE_GEMINI_MODELS.primary,
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  try {
    console.log(`[native-gemini] Generating with native ${model}...`);

    const parts: any[] = [{ text: prompt }];
    if (referenceImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: referenceImageBase64,
        },
      });
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[native-gemini] ${model} error: ${response.status}`, errorText.substring(0, 300));
      if (response.status === 429) return { imageBase64: null, model, error: `Rate limit Gemini nativa` };
      if (response.status === 403) return { imageBase64: null, model, error: `GEMINI_API_KEY inválida ou sem permissão` };
      if (response.status === 400) return { imageBase64: null, model, error: `Modelo ${model} não suporta geração de imagem ou request inválido` };
      return { imageBase64: null, model, error: `Gemini nativa error: ${response.status}` };
    }

    const data = await response.json();
    const candidateParts = data.candidates?.[0]?.content?.parts || [];

    for (const part of candidateParts) {
      if (part.inlineData?.data) {
        console.log(`[native-gemini] ✅ ${model} generated image OK (${part.inlineData.data.length} chars)`);
        return { imageBase64: part.inlineData.data, model: `${model} (Gemini nativa)` };
      }
    }

    console.warn(`[native-gemini] ${model} returned no image in response`);
    return { imageBase64: null, model, error: `${model} não retornou imagem` };
  } catch (error) {
    console.error(`[native-gemini] ${model} error:`, error);
    return { imageBase64: null, model, error: String(error) };
  }
}

/**
 * Tenta gerar com Gemini nativa, com retry no modelo fallback.
 * Retorna null se ambos falharem.
 */
export async function tryNativeGemini(
  geminiApiKey: string,
  prompt: string,
  referenceImageBase64: string | null,
  slotLabel: string = 'slot',
): Promise<{ imageBase64: string | null; model: string; error?: string }> {
  console.log(`[native-gemini] [${slotLabel}] Attempting native Gemini (priority 1)...`);

  // Attempt 1: Primary model
  const attempt1 = await generateWithNativeGemini(geminiApiKey, prompt, referenceImageBase64, NATIVE_GEMINI_MODELS.primary);
  if (attempt1.imageBase64) return attempt1;

  console.warn(`[native-gemini] [${slotLabel}] Primary failed: ${attempt1.error}`);

  // Se o fallback for diferente do primary, tentar
  if (NATIVE_GEMINI_MODELS.fallback !== NATIVE_GEMINI_MODELS.primary) {
    const attempt2 = await generateWithNativeGemini(geminiApiKey, prompt, referenceImageBase64, NATIVE_GEMINI_MODELS.fallback);
    if (attempt2.imageBase64) return attempt2;
    console.warn(`[native-gemini] [${slotLabel}] Fallback also failed: ${attempt2.error}`);
  }

  return { imageBase64: null, model: NATIVE_GEMINI_MODELS.primary, error: 'All native Gemini attempts failed' };
}
